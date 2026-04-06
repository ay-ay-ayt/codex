export type WindowMode = "compact" | "expanded";
export type CloseBehavior = "confirm-before-exit";

export type WindowSize = {
  width: number;
  height: number;
};

export type StudySession = {
  id: string;
  sessionDate: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type ActiveTimer = {
  sessionDate: string;
  startedAt: string;
  accumulatedMs: number;
  lastResumedAt: string | null;
  lastPausedAt: string | null;
  running: boolean;
} | null;

export type StudyDayRecord = {
  date: string;
  totalDurationMs: number;
  sessions: StudySession[];
  count: number;
};

export type AppSettings = {
  alwaysOnTop: boolean;
  closeBehavior: CloseBehavior;
  compactSize: WindowSize;
  expandedSize: WindowSize;
};
