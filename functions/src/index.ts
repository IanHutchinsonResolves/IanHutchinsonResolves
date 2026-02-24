import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import {
  generateDailyToken,
  todayTokenDate,
  verifyToken,
  TOKEN_TZ
} from "./lib/token";
import {
  BOARD_SIZE,
  FREE_SPACE_INDEX,
  computeCompletedRows,
  isBoardComplete,
  normalizeEarnedIndices
} from "./lib/board";
import { isRateLimited } from "./lib/rateLimit";
import { buildSeasonSquares } from "./lib/season";

admin.initializeApp();
const db = admin.firestore();

const REGION = "us-central1";

function getTokenSecret(): string {
  const configSecret = functions.config()?.token?.secret as string | undefined;
  const envSecret = process.env.TOKEN_SECRET;
  const secret = envSecret || configSecret;
  if (!secret) {
    throw new Error("TOKEN_SECRET is not configured");
  }
  return secret;
}

function getAdminUids(): string[] {
  const configUids = (functions.config()?.app?.admin_uids as string | undefined) || "";
  const envUids = process.env.ADMIN_UIDS || "";
  return `${envUids},${configUids}`
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean);
}

function assertAuthed(context: functions.https.CallableContext): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return context.auth.uid;
}

function assertAdmin(uid: string): void {
  if (!getAdminUids().includes(uid)) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
}

async function getActiveSeason(): Promise<
  | (admin.firestore.DocumentData & { id: string })
  | null
> {
  const snap = await db
    .collection("seasons")
    .where("active", "==", true)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

function seasonProgressRef(userId: string, seasonId: string) {
  return db.collection("userSeasonProgress").doc(`${userId}_${seasonId}`);
}

function weekBoundsLA(now = DateTime.now()) {
  const laNow = now.setZone(TOKEN_TZ);
  const start = laNow
    .startOf("day")
    .minus({ days: (laNow.weekday - 1) % 7 });
  const end = start.plus({ days: 7 });
  return { start, end };
}

async function createSeasonWithBoard(businessIds: string[]) {
  const { start, end } = weekBoundsLA();
  const seasonRef = db.collection("seasons").doc();
  const createdAt = admin.firestore.Timestamp.now();
  const seasonData = {
    city: "Ventura",
    startsAt: admin.firestore.Timestamp.fromDate(start.toJSDate()),
    endsAt: admin.firestore.Timestamp.fromDate(end.toJSDate()),
    active: true,
    createdAt
  };

  const boardRef = db.collection("seasonBoard").doc(seasonRef.id);
  const squares = buildSeasonSquares(businessIds);

  const batch = db.batch();
  batch.set(seasonRef, seasonData);
  batch.set(boardRef, {
    seasonId: seasonRef.id,
    size: BOARD_SIZE,
    freeSpaceIndex: FREE_SPACE_INDEX,
    createdAt
  });
  squares.forEach((square) => {
    const squareRef = db
      .collection("seasonSquares")
      .doc(`${seasonRef.id}_${square.index}`);
    batch.set(squareRef, {
      seasonId: seasonRef.id,
      index: square.index,
      businessId: square.businessId,
      createdAt
    });
  });

  const rewardBatch = buildRewardsBatch(seasonRef.id, createdAt);
  rewardBatch.ops.forEach((op) => batch.set(op.ref, op.data, { merge: true }));

  await batch.commit();
  return { seasonId: seasonRef.id };
}

function buildRewardsBatch(seasonId: string, createdAt: admin.firestore.Timestamp) {
  const ops: Array<{ ref: admin.firestore.DocumentReference; data: any }> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rewardRef = db.collection("rewards").doc(`${seasonId}_ROW_${row}`);
    ops.push({
      ref: rewardRef,
      data: {
        seasonId,
        type: "ROW",
        title: `Row ${row + 1} Reward`,
        description: "Show this reward to redeem your in-store freebie.",
        rule: `ROW_${row}`,
        active: true,
        createdAt
      }
    });
  }

  const raffleRef = db.collection("rewards").doc(`${seasonId}_BOARD_RAFFLE`);
  ops.push({
    ref: raffleRef,
    data: {
      seasonId,
      type: "BOARD_RAFFLE",
      title: "Full Board Raffle Entry",
      description: "You earned one raffle entry for this season.",
      rule: "BOARD_COMPLETE",
      active: true,
      createdAt
    }
  });

  return { ops };
}

export const getDailyToken = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    try {
      const businessId = String(req.query.businessId || "").trim();
      if (!businessId) {
        res.status(400).json({ error: "Missing businessId" });
        return;
      }
      const businessDoc = await db.collection("businesses").doc(businessId).get();
      if (!businessDoc.exists) {
        res.status(404).json({ error: "Business not found" });
        return;
      }
      const tokenDate = todayTokenDate();
      const token = generateDailyToken(businessId, tokenDate, getTokenSecret());
      res.json({ token, businessId, tokenDate });
    } catch (error) {
      console.error("getDailyToken error", error);
      res.status(500).json({ error: "Internal error" });
    }
  });

export const validateCheckIn = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const userId = assertAuthed(context);
    const token = String(data?.token || "");
    const deviceHash = String(data?.deviceHash || "");

    if (!token || !deviceHash) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "token and deviceHash are required."
      );
    }

    let payload;
    try {
      payload = verifyToken(token, getTokenSecret());
    } catch (error) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid token.");
    }

    const today = todayTokenDate();
    if (payload.tokenDate !== today) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Token is expired for today."
      );
    }

    const season = await getActiveSeason();
    if (!season) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No active season."
      );
    }

    const lastCheckInSnap = await db
      .collection("checkIns")
      .where("userId", "==", userId)
      .where("businessId", "==", payload.businessId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let lastCheckInAt: Date | null = null;
    if (!lastCheckInSnap.empty) {
      const ts = lastCheckInSnap.docs[0].get("createdAt");
      if (ts?.toDate) {
        lastCheckInAt = ts.toDate();
      }
    }

    if (isRateLimited(lastCheckInAt, new Date())) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "You can only check in once per business every 24 hours."
      );
    }

    const squaresSnap = await db
      .collection("seasonSquares")
      .where("seasonId", "==", season.id)
      .orderBy("index", "asc")
      .get();

    const businessIndexMap = new Map<string, number>();
    squaresSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.businessId) {
        businessIndexMap.set(data.businessId, data.index);
      }
    });

    const earnedIndex = businessIndexMap.get(payload.businessId);

    const progressRef = seasonProgressRef(userId, season.id);
    const progressSnap = await progressRef.get();

    let earnedIndices: number[] = [FREE_SPACE_INDEX];
    let earnedByBusiness: Record<string, admin.firestore.Timestamp> = {};
    let completedRows: number[] = [];
    let boardComplete = false;

    if (progressSnap.exists) {
      const data = progressSnap.data();
      earnedIndices = Array.isArray(data?.earnedIndices)
        ? data?.earnedIndices
        : earnedIndices;
      earnedByBusiness = data?.earnedByBusiness || earnedByBusiness;
      completedRows = Array.isArray(data?.completedRows)
        ? data?.completedRows
        : completedRows;
      boardComplete = Boolean(data?.boardComplete);
    }

    if (!earnedIndices.includes(FREE_SPACE_INDEX)) {
      earnedIndices.push(FREE_SPACE_INDEX);
    }

    const now = admin.firestore.Timestamp.now();
    let earnedSquare = false;
    if (typeof earnedIndex === "number" && !earnedIndices.includes(earnedIndex)) {
      earnedIndices.push(earnedIndex);
      earnedByBusiness[payload.businessId] = now;
      earnedSquare = true;
    }

    earnedIndices = normalizeEarnedIndices(earnedIndices);

    const nextCompletedRows = computeCompletedRows(earnedIndices);
    const newCompletedRows = nextCompletedRows.filter(
      (row) => !completedRows.includes(row)
    );
    const nextBoardComplete = isBoardComplete(earnedIndices);
    const becameBoardComplete = nextBoardComplete && !boardComplete;

    const rewardsSnap = await db
      .collection("rewards")
      .where("seasonId", "==", season.id)
      .where("active", "==", true)
      .get();

    const rowRewards = new Map<string, any>();
    let boardReward: any = null;
    rewardsSnap.docs.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.type === "ROW") {
        rowRewards.set(data.rule, data);
      }
      if (data.type === "BOARD_RAFFLE") {
        boardReward = data;
      }
    });

    const batch = db.batch();
    const checkInRef = db.collection("checkIns").doc();
    batch.set(checkInRef, {
      userId,
      seasonId: season.id,
      businessId: payload.businessId,
      createdAt: now,
      deviceHash,
      tokenDate: payload.tokenDate
    });

    if (!progressSnap.exists) {
      batch.set(progressRef, {
        userId,
        seasonId: season.id,
        earnedIndices,
        earnedByBusiness,
        completedRows: nextCompletedRows,
        boardComplete: nextBoardComplete,
        createdAt: now,
        updatedAt: now
      });
    } else {
      batch.set(
        progressRef,
        {
          earnedIndices,
          earnedByBusiness,
          completedRows: nextCompletedRows,
          boardComplete: nextBoardComplete,
          updatedAt: now
        },
        { merge: true }
      );
    }

    const issuedRewards: Array<{ rewardId: string; title: string; row: number }> = [];

    for (const row of newCompletedRows) {
      const reward = rowRewards.get(`ROW_${row}`);
      if (!reward) {
        continue;
      }
      const userRewardRef = db
        .collection("userRewards")
        .doc(`${userId}_${season.id}_${reward.id}`);
      const userRewardSnap = await userRewardRef.get();
      if (!userRewardSnap.exists) {
        batch.set(userRewardRef, {
          userId,
          seasonId: season.id,
          rewardId: reward.id,
          title: reward.title,
          description: reward.description,
          type: reward.type,
          status: "AVAILABLE",
          issuedAt: now,
          metadata: { row }
        });
        issuedRewards.push({ rewardId: reward.id, title: reward.title, row });
      }
    }

    let raffleEntryCreated = false;
    if (becameBoardComplete) {
      const raffleRef = db
        .collection("raffleEntries")
        .doc(`${userId}_${season.id}`);
      const raffleSnap = await raffleRef.get();
      if (!raffleSnap.exists) {
        batch.set(raffleRef, {
          userId,
          seasonId: season.id,
          createdAt: now
        });
        raffleEntryCreated = true;
      }

      if (boardReward) {
        const boardRewardRef = db
          .collection("userRewards")
          .doc(`${userId}_${season.id}_${boardReward.id}`);
        const boardRewardSnap = await boardRewardRef.get();
        if (!boardRewardSnap.exists) {
          batch.set(boardRewardRef, {
            userId,
            seasonId: season.id,
            rewardId: boardReward.id,
            title: boardReward.title,
            description: boardReward.description,
            type: boardReward.type,
            status: "AVAILABLE",
            issuedAt: now,
            metadata: { boardComplete: true }
          });
        }
      }
    }

    await batch.commit();

    return {
      success: true,
      earnedSquare,
      earnedIndex: earnedSquare ? earnedIndex : null,
      newRowRewards: issuedRewards,
      boardComplete: nextBoardComplete,
      raffleEntryCreated
    };
  });

export const redeemReward = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const userId = assertAuthed(context);
    const userRewardId = String(data?.userRewardId || "");
    if (!userRewardId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userRewardId is required."
      );
    }

    const rewardRef = db.collection("userRewards").doc(userRewardId);
    const rewardSnap = await rewardRef.get();

    if (!rewardSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Reward not found.");
    }

    const reward = rewardSnap.data();
    if (reward?.userId !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your reward."
      );
    }

    if (reward?.type === "BOARD_RAFFLE") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Raffle entries are auto-recorded and not redeemable."
      );
    }

    if (reward?.status === "REDEEMED") {
      return { success: true, alreadyRedeemed: true };
    }

    await rewardRef.set(
      {
        status: "REDEEMED",
        redeemedAt: admin.firestore.Timestamp.now()
      },
      { merge: true }
    );

    return { success: true, redeemed: true };
  });

export const adminSeed = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    const userId = assertAuthed(context);
    assertAdmin(userId);

    const businessesSnap = await db.collection("businesses").limit(1).get();
    let createdBusinesses = 0;

    if (businessesSnap.empty) {
      const sampleBusinesses = buildSampleBusinesses();
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();
      sampleBusinesses.forEach((biz) => {
        const ref = db.collection("businesses").doc();
        batch.set(ref, {
          ...biz,
          active: true,
          createdAt: now
        });
      });
      await batch.commit();
      createdBusinesses = sampleBusinesses.length;
    }

    await seedAdmins(getAdminUids());

    await deactivateActiveSeasons();
    const businessIds = await getActiveBusinessIds();
    const { seasonId } = await createSeasonWithBoard(businessIds);

    return {
      success: true,
      createdBusinesses,
      seasonId
    };
  });

export const adminCreateSeasonBoard = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    const userId = assertAuthed(context);
    assertAdmin(userId);

    await deactivateActiveSeasons();

    const businessIds = await getActiveBusinessIds();
    const { seasonId } = await createSeasonWithBoard(businessIds);

    return { success: true, seasonId };
  });

export const adminGetAnalytics = functions
  .region(REGION)
  .https.onCall(async (_data, context) => {
    const userId = assertAuthed(context);
    assertAdmin(userId);

    const season = await getActiveSeason();
    if (!season) {
      return { success: false, message: "No active season." };
    }

    const businessesSnap = await db.collection("businesses").get();
    const businessMap = new Map<string, any>();
    const perBusiness: Record<
      string,
      { total: number; uniqueUsers: number; repeat: number }
    > = {};
    businessesSnap.docs.forEach((doc) => {
      businessMap.set(doc.id, doc.data());
      perBusiness[doc.id] = { total: 0, uniqueUsers: 0, repeat: 0 };
    });

    const checkInsSnap = await db
      .collection("checkIns")
      .where("seasonId", "==", season.id)
      .get();

    checkInsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const bizId = data.businessId;
      if (!perBusiness[bizId]) {
        perBusiness[bizId] = { total: 0, uniqueUsers: 0, repeat: 0 };
      }
      perBusiness[bizId].total += 1;
    });

    const usersByBusiness = new Map<string, Set<string>>();
    checkInsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (!usersByBusiness.has(data.businessId)) {
        usersByBusiness.set(data.businessId, new Set());
      }
      usersByBusiness.get(data.businessId)?.add(data.userId);
    });

    usersByBusiness.forEach((users, bizId) => {
      const unique = users.size;
      perBusiness[bizId] = perBusiness[bizId] || {
        total: 0,
        uniqueUsers: 0,
        repeat: 0
      };
      perBusiness[bizId].uniqueUsers = unique;
      perBusiness[bizId].repeat = perBusiness[bizId].total - unique;
    });

    const progressSnap = await db
      .collection("userSeasonProgress")
      .where("seasonId", "==", season.id)
      .get();

    let boardCompletions = 0;
    let rowCompletions = 0;
    progressSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.boardComplete) {
        boardCompletions += 1;
      }
      if (Array.isArray(data.completedRows)) {
        rowCompletions += data.completedRows.length;
      }
    });

    const rewardsSnap = await db
      .collection("userRewards")
      .where("seasonId", "==", season.id)
      .get();

    let rewardsIssued = rewardsSnap.size;
    let rewardsRedeemed = 0;
    rewardsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.status === "REDEEMED") {
        rewardsRedeemed += 1;
      }
    });

    const raffleSnap = await db
      .collection("raffleEntries")
      .where("seasonId", "==", season.id)
      .get();

    const businessAnalytics = Object.entries(perBusiness).map(
      ([businessId, metrics]) => ({
        businessId,
        name: businessMap.get(businessId)?.name || "Unknown",
        totalCheckIns: metrics.total,
        uniqueUsers: metrics.uniqueUsers,
        repeatCheckIns: metrics.repeat
      })
    );

    return {
      success: true,
      seasonId: season.id,
      businessAnalytics,
      boardCompletions,
      rowCompletions,
      rewardsIssued,
      rewardsRedeemed,
      raffleEntries: raffleSnap.size
    };
  });

async function seedAdmins(uids: string[]) {
  if (!uids.length) {
    return;
  }
  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  uids.forEach((uid) => {
    const ref = db.collection("admins").doc(uid);
    batch.set(ref, { userId: uid, createdAt: now }, { merge: true });
  });
  await batch.commit();
}

async function deactivateActiveSeasons() {
  const activeSeasonSnap = await db
    .collection("seasons")
    .where("active", "==", true)
    .get();

  if (!activeSeasonSnap.empty) {
    const batch = db.batch();
    activeSeasonSnap.docs.forEach((doc) => {
      batch.set(doc.ref, { active: false }, { merge: true });
    });
    await batch.commit();
  }
}

async function getActiveBusinessIds(): Promise<string[]> {
  const snap = await db
    .collection("businesses")
    .where("active", "==", true)
    .get();
  return snap.docs.map((doc) => doc.id);
}

function buildSampleBusinesses() {
  return [
    {
      name: "Harbor Bean Coffee",
      address: "123 Main St, Ventura, CA",
      category: "Cafe"
    },
    {
      name: "Coastal Threads",
      address: "45 Oak Ave, Ventura, CA",
      category: "Apparel"
    },
    {
      name: "Seaside Book Nook",
      address: "78 Harbor Blvd, Ventura, CA",
      category: "Books"
    },
    {
      name: "Ventura Vinyl",
      address: "210 Palm St, Ventura, CA",
      category: "Music"
    },
    {
      name: "Citrus Bowl Eatery",
      address: "15 Citrus Dr, Ventura, CA",
      category: "Food"
    },
    {
      name: "Downtown Craft Co.",
      address: "98 Santa Clara St, Ventura, CA",
      category: "Gifts"
    },
    {
      name: "Pierview Florals",
      address: "6 Pier Ave, Ventura, CA",
      category: "Florist"
    },
    {
      name: "Channel Island Outfitters",
      address: "300 Coast Hwy, Ventura, CA",
      category: "Outdoor"
    },
    {
      name: "Mission Bicycle",
      address: "52 Mission Ave, Ventura, CA",
      category: "Bikes"
    },
    {
      name: "Sunset Smoothies",
      address: "19 Sunset Blvd, Ventura, CA",
      category: "Juice"
    },
    {
      name: "Starlight Toy Box",
      address: "87 California St, Ventura, CA",
      category: "Toys"
    },
    {
      name: "Pacific Plant Shop",
      address: "12 Thompson Blvd, Ventura, CA",
      category: "Plants"
    },
    {
      name: "Boardwalk Bakes",
      address: "201 Seaward Ave, Ventura, CA",
      category: "Bakery"
    },
    {
      name: "Surfside Gallery",
      address: "33 Figueroa St, Ventura, CA",
      category: "Art"
    },
    {
      name: "Lighthouse Leather",
      address: "9 Ventura Ave, Ventura, CA",
      category: "Accessories"
    },
    {
      name: "Marina Pet Supply",
      address: "1410 Harbor Blvd, Ventura, CA",
      category: "Pets"
    },
    {
      name: "Rincon Roasters",
      address: "77 Rincon St, Ventura, CA",
      category: "Cafe"
    },
    {
      name: "Seaside Soapery",
      address: "65 Poli St, Ventura, CA",
      category: "Bath"
    },
    {
      name: "Ventura Vintage",
      address: "220 Chestnut St, Ventura, CA",
      category: "Vintage"
    },
    {
      name: "Channel Chocolates",
      address: "5 Thompson Blvd, Ventura, CA",
      category: "Sweets"
    },
    {
      name: "Harbor Hardware",
      address: "410 East Main St, Ventura, CA",
      category: "Hardware"
    },
    {
      name: "Oceanview Yoga",
      address: "27 Cedar St, Ventura, CA",
      category: "Wellness"
    },
    {
      name: "Downtown Deli Co.",
      address: "18 Oak St, Ventura, CA",
      category: "Deli"
    },
    {
      name: "Ventura Game Loft",
      address: "70 Santa Clara St, Ventura, CA",
      category: "Games"
    }
  ];
}
