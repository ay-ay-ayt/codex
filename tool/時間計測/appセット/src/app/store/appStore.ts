import localforage from "localforage";
import { create } from "zustand";
import { defaultSettings } from "../data/defaultState";
import type { ActiveTimer, AppSettings, CloseBehavior, StudySession, WindowSize } from "../types";
import { getElapsedMs, getLocalDateString } from "../utils/time";

type Snapshot = {
  activeTimer: ActiveTimer;
  sessions: StudySession[];
  settings: AppSettings;
};

type StopTimerOptions = {
  endedAt?: string;
};

type AppState = Snapshot & {
  hydrated: boolean;
  saving: boolean;
  hydrate: () => Promise<void>;
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: (options?: StopTimerOptions) => Promise<StudySession | null>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

const storage = localforage.createInstance({
  name: "study-timer-store",
  storeName: "sessions"
});

const STORAGE_KEY = "study-timer-v1";

function createInitialSnapshot(): Snapshot {
  return {
    activeTimer: null,
    sessions: [],
    settings: defaultSettings
  };
}

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeWindowSize(value: unknown, fallback: WindowSize): WindowSize {
  if (!isRecord(value)) {
    return fallback;
  }

  const width = typeof value.width === "number" ? value.width : fallback.width;
  const height = typeof value.height === "number" ? value.height : fallback.height;
  return { width, height };
}

function normalizeCompactSize(value: unknown): WindowSize {
  const size = normalizeWindowSize(value, defaultSettings.compactSize);

  if ((size.width === 360 && size.height === 240) || size.width > 340 || size.height > 180) {
    return defaultSettings.compactSize;
  }

  return {
    width: Math.max(300, size.width),
    height: Math.max(128, size.height)
  };
}

function normalizeExpandedSize(value: unknown): WindowSize {
  const size = normalizeWindowSize(value, defaultSettings.expandedSize);

  return {
    width: Math.max(380, size.width),
    height: Math.max(560, size.height)
  };
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return defaultSettings;
  }

  const closeBehavior: CloseBehavior =
    value.closeBehavior === "confirm-before-exit" ? value.closeBehavior : defaultSettings.closeBehavior;

  return {
    alwaysOnTop: typeof value.alwaysOnTop === "boolean" ? value.alwaysOnTop : defaultSettings.alwaysOnTop,
    closeBehavior,
    compactSize: normalizeCompactSize(value.compactSize),
    expandedSize: normalizeExpandedSize(value.expandedSize)
  };
}

function normalizeActiveTimer(value: unknown): ActiveTimer {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.sessionDate !== "string" || typeof value.startedAt !== "string") {
    return null;
  }

  return {
    sessionDate: value.sessionDate,
    startedAt: value.startedAt,
    accumulatedMs: typeof value.accumulatedMs === "number" ? value.accumulatedMs : 0,
    lastResumedAt: typeof value.lastResumedAt === "string" ? value.lastResumedAt : null,
    lastPausedAt: typeof value.lastPausedAt === "string" ? value.lastPausedAt : null,
    running: Boolean(value.running)
  };
}

function normalizeSessions(value: unknown): StudySession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.sessionDate === "string" &&
        typeof item.startedAt === "string" &&
        typeof item.endedAt === "string" &&
        typeof item.durationMs === "number"
    )
    .map((item) => ({
      id: item.id as string,
      sessionDate: item.sessionDate as string,
      startedAt: item.startedAt as string,
      endedAt: item.endedAt as string,
      durationMs: Math.max(0, item.durationMs as number)
    }))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function pickSnapshot(state: AppState): Snapshot {
  return {
    activeTimer: state.activeTimer,
    sessions: state.sessions,
    settings: state.settings
  };
}

async function persistSnapshot(snapshot: Snapshot) {
  await storage.setItem(STORAGE_KEY, snapshot);
}

function mergeSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...patch,
    compactSize: {
      ...current.compactSize,
      ...patch.compactSize
    },
    expandedSize: {
      ...current.expandedSize,
      ...patch.expandedSize
    }
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  saving: false,
  ...createInitialSnapshot(),
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    try {
      const saved = await storage.getItem<Partial<Snapshot>>(STORAGE_KEY);

      if (!saved) {
        set({ hydrated: true });
        return;
      }

      set({
        hydrated: true,
        activeTimer: normalizeActiveTimer(saved.activeTimer),
        sessions: normalizeSessions(saved.sessions),
        settings: normalizeSettings(saved.settings)
      });
    } catch (error) {
      console.error("Failed to hydrate study timer state", error);
      set({
        hydrated: true,
        ...createInitialSnapshot()
      });
    }
  },
  startTimer: async () => {
    if (get().activeTimer) {
      return;
    }

    set({ saving: true });
    const now = new Date();
    const nowIso = now.toISOString();
    const activeTimer = {
      sessionDate: getLocalDateString(now),
      startedAt: nowIso,
      accumulatedMs: 0,
      lastResumedAt: nowIso,
      lastPausedAt: null,
      running: true
    } satisfies NonNullable<ActiveTimer>;

    set({ activeTimer });
    await persistSnapshot({
      ...pickSnapshot(get()),
      activeTimer
    });
    set({ saving: false });
  },
  pauseTimer: async () => {
    const current = get().activeTimer;
    if (!current || !current.running) {
      return;
    }

    set({ saving: true });
    const pausedAt = new Date().toISOString();
    const nextTimer = {
      ...current,
      accumulatedMs: getElapsedMs(current, new Date(pausedAt).getTime()),
      lastResumedAt: null,
      lastPausedAt: pausedAt,
      running: false
    } satisfies NonNullable<ActiveTimer>;

    set({ activeTimer: nextTimer });
    await persistSnapshot({
      ...pickSnapshot(get()),
      activeTimer: nextTimer
    });
    set({ saving: false });
  },
  resumeTimer: async () => {
    const current = get().activeTimer;
    if (!current || current.running) {
      return;
    }

    set({ saving: true });
    const resumedAt = new Date().toISOString();
    const nextTimer = {
      ...current,
      lastResumedAt: resumedAt,
      lastPausedAt: null,
      running: true
    } satisfies NonNullable<ActiveTimer>;

    set({ activeTimer: nextTimer });
    await persistSnapshot({
      ...pickSnapshot(get()),
      activeTimer: nextTimer
    });
    set({ saving: false });
  },
  stopTimer: async (options) => {
    const current = get().activeTimer;
    if (!current) {
      return null;
    }

    set({ saving: true });
    const endedAt = options?.endedAt ?? new Date().toISOString();
    const finalEndedAt = current.running ? endedAt : current.lastPausedAt ?? endedAt;
    const durationMs = Math.max(0, getElapsedMs(current, new Date(endedAt).getTime()));
    const session =
      durationMs > 0
        ? {
            id: createSessionId(),
            sessionDate: current.sessionDate,
            startedAt: current.startedAt,
            endedAt: finalEndedAt,
            durationMs
          }
        : null;
    const nextSessions = session
      ? [session, ...get().sessions].sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      : get().sessions;

    set({
      activeTimer: null,
      sessions: nextSessions
    });
    await persistSnapshot({
      ...pickSnapshot(get()),
      activeTimer: null,
      sessions: nextSessions
    });
    set({ saving: false });

    return session;
  },
  updateSettings: async (patch) => {
    const nextSettings = mergeSettings(get().settings, patch);
    set({ settings: nextSettings });
    await persistSnapshot({
      ...pickSnapshot(get()),
      settings: nextSettings
    });
  }
}));
