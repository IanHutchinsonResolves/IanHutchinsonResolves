import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import { BOARD_SIZE, FREE_SPACE_INDEX } from "../src/lib/board";
import { buildSeasonSquares } from "../src/lib/season";
import { TOKEN_TZ } from "../src/lib/token";

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((uid) => uid.trim())
  .filter(Boolean);

function weekBoundsLA(now = DateTime.now()) {
  const laNow = now.setZone(TOKEN_TZ);
  const start = laNow
    .startOf("day")
    .minus({ days: (laNow.weekday - 1) % 7 });
  const end = start.plus({ days: 7 });
  return { start, end };
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });

  const db = admin.firestore();
  const businessesSnap = await db.collection("businesses").limit(1).get();
  if (businessesSnap.empty) {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    buildSampleBusinesses().forEach((biz) => {
      const ref = db.collection("businesses").doc();
      batch.set(ref, { ...biz, active: true, createdAt: now });
    });
    await batch.commit();
    console.log("Seeded sample businesses.");
  } else {
    console.log("Businesses already exist. Skipping business seed.");
  }

  if (ADMIN_UIDS.length) {
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    ADMIN_UIDS.forEach((uid) => {
      const ref = db.collection("admins").doc(uid);
      batch.set(ref, { userId: uid, createdAt: now }, { merge: true });
    });
    await batch.commit();
    console.log("Seeded admin UIDs.");
  }

  const businessIds = await getActiveBusinessIds(db);
  await deactivateActiveSeasons(db);
  const { start, end } = weekBoundsLA();
  const seasonRef = db.collection("seasons").doc();
  const createdAt = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.set(seasonRef, {
    city: "Ventura",
    startsAt: admin.firestore.Timestamp.fromDate(start.toJSDate()),
    endsAt: admin.firestore.Timestamp.fromDate(end.toJSDate()),
    active: true,
    createdAt
  });

  const boardRef = db.collection("seasonBoard").doc(seasonRef.id);
  batch.set(boardRef, {
    seasonId: seasonRef.id,
    size: BOARD_SIZE,
    freeSpaceIndex: FREE_SPACE_INDEX,
    createdAt
  });

  const squares = buildSeasonSquares(businessIds);
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

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rewardRef = db.collection("rewards").doc(`${seasonRef.id}_ROW_${row}`);
    batch.set(rewardRef, {
      seasonId: seasonRef.id,
      type: "ROW",
      title: `Row ${row + 1} Reward`,
      description: "Show this reward to redeem your in-store freebie.",
      rule: `ROW_${row}`,
      active: true,
      createdAt
    });
  }

  const raffleRef = db.collection("rewards").doc(`${seasonRef.id}_BOARD_RAFFLE`);
  batch.set(raffleRef, {
    seasonId: seasonRef.id,
    type: "BOARD_RAFFLE",
    title: "Full Board Raffle Entry",
    description: "You earned one raffle entry for this season.",
    rule: "BOARD_COMPLETE",
    active: true,
    createdAt
  });

  await batch.commit();
  console.log(`Seeded season ${seasonRef.id}.`);
}

async function getActiveBusinessIds(db: admin.firestore.Firestore) {
  const snap = await db
    .collection("businesses")
    .where("active", "==", true)
    .get();
  return snap.docs.map((doc) => doc.id);
}

async function deactivateActiveSeasons(db: admin.firestore.Firestore) {
  const snap = await db.collection("seasons").where("active", "==", true).get();
  if (snap.empty) {
    return;
  }
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.set(doc.ref, { active: false }, { merge: true });
  });
  await batch.commit();
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
