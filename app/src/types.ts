export type Business = {
  id: string;
  name: string;
  address: string;
  category: string;
  imageUrl?: string | null;
  active: boolean;
};

export type Season = {
  id: string;
  city: string;
  startsAt: any;
  endsAt: any;
  active: boolean;
};

export type SeasonSquare = {
  id: string;
  seasonId: string;
  index: number;
  businessId: string | null;
};

export type UserSeasonProgress = {
  userId: string;
  seasonId: string;
  earnedIndices: number[];
  earnedByBusiness: Record<string, any>;
  completedRows: number[];
  boardComplete: boolean;
};

export type Reward = {
  id: string;
  type: "ROW" | "BOARD_RAFFLE";
  seasonId: string;
  title: string;
  description: string;
  rule: string;
  active: boolean;
};

export type UserReward = {
  id: string;
  userId: string;
  seasonId: string;
  rewardId: string;
  title?: string;
  description?: string;
  type: "ROW" | "BOARD_RAFFLE";
  status: "AVAILABLE" | "REDEEMED";
  issuedAt: any;
  redeemedAt?: any;
  metadata?: any;
};
