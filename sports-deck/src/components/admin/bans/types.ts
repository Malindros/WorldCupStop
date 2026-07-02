export type BanAppealQueueItem = {
  id: number;
  message: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
  ban: {
    id: number;
    reason: string;
    until: string | null;
    createdAt: string;
    bannedBy: {
      id: number;
      username: string;
    } | null;
  };
};

export type BanAppealsResponse = {
  appeals: BanAppealQueueItem[];
  status: "PENDING" | "APPROVED" | "DENIED";
};
