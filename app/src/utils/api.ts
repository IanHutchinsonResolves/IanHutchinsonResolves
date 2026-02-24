import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function validateCheckIn(token: string, deviceHash: string) {
  const callable = httpsCallable(functions, "validateCheckIn");
  const result = await callable({ token, deviceHash });
  return result.data as {
    success: boolean;
    earnedSquare: boolean;
    earnedIndex: number | null;
    newRowRewards: Array<{ rewardId: string; title: string; row: number }>;
    boardComplete: boolean;
    raffleEntryCreated: boolean;
  };
}

export async function redeemReward(userRewardId: string) {
  const callable = httpsCallable(functions, "redeemReward");
  const result = await callable({ userRewardId });
  return result.data as { success: boolean; redeemed?: boolean };
}

export async function adminSeed() {
  const callable = httpsCallable(functions, "adminSeed");
  const result = await callable({});
  return result.data as { success: boolean; createdBusinesses: number; seasonId: string };
}

export async function adminCreateSeasonBoard() {
  const callable = httpsCallable(functions, "adminCreateSeasonBoard");
  const result = await callable({});
  return result.data as { success: boolean; seasonId: string };
}

export async function adminGetAnalytics() {
  const callable = httpsCallable(functions, "adminGetAnalytics");
  const result = await callable({});
  return result.data as {
    success: boolean;
    seasonId?: string;
    businessAnalytics?: Array<{
      businessId: string;
      name: string;
      totalCheckIns: number;
      uniqueUsers: number;
      repeatCheckIns: number;
    }>;
    boardCompletions?: number;
    rowCompletions?: number;
    rewardsIssued?: number;
    rewardsRedeemed?: number;
    raffleEntries?: number;
    message?: string;
  };
}
