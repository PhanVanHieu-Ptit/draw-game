// Shapes of the Live Operations API (see shared/live-ops/ and admin/server/liveops.mjs).
export type Kind = "daily" | "weekly" | "seasonal" | "random";
export type Status =
  | "draft"
  | "scheduled"
  | "active"
  | "completed"
  | "archived"
  | "cancelled";

export type Reward = {
  id: string;
  type: "cosmetic" | "badge";
  ref: string;
  label: string;
  condition: {
    metric: "runs" | "bestScore" | "bestWave" | "bestCombo";
    threshold: number;
  };
};

export type EventContent = {
  id: string;
  kind: Kind;
  name: string;
  description: string;
  timeZone: string;
  schedule: { startLocal: string; endLocal: string };
  announcement: {
    enabled: boolean;
    title: string;
    body: string;
    leadHours: number;
    tone: "info" | "event" | "urgent";
  };
  eligibility: {
    modes: string[];
    difficulties: string[];
    minStoryLevelsCleared: number;
    allowAssisted: boolean;
  };
  rules: {
    difficulty: string;
    scoreVersion: number;
    seedSalt: string;
    enemy: { speedMultiplier: number; runes: string[]; noHearts: boolean };
    spawn: { intervalMultiplier: number; surpriseMultiplier: number };
    player: { maxHp: number };
    score: { multiplier: number };
    visual: { theme: string; ambient: string };
  };
  rewards: Reward[];
};

export type EventRecord = {
  id: string;
  kind: Kind;
  status: Status;
  effectiveStatus: Status;
  version: number;
  content: EventContent;
  startsAt: string;
  endsAt: string;
  challengeKey: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  scheduledAt?: string;
  cancelReason?: string;
  versions: { version: number; savedAt: string; author: string; changed: string[] }[];
};

export type Conflict = {
  type: "overlap" | "rules";
  severity: "error";
  eventIds: string[];
  message: string;
};

export type HistoryEntry = {
  seq: number;
  id: string;
  at: string;
  recordedAt: string;
  type: string;
  eventId: string | null;
  version: number | null;
  actor: string;
  from?: string;
  to?: string;
  note?: string;
};

export type Flags = Record<string, { enabled: boolean; rolloutPercent: number }>;

export type Workspace = {
  environment: string;
  revision: number;
  serverTime: string;
  events: EventRecord[];
  archivedCount: number;
  flags: Flags;
  conflicts: Conflict[];
  history: HistoryEntry[];
};

export type Preview = {
  ok: boolean;
  errors: string[];
  window: { startsAt: string; endsAt: string; challengeKey: string } | null;
  conflicts: Conflict[];
};
