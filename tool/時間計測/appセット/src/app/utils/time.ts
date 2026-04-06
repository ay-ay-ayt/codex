import type { ActiveTimer, StudyDayRecord, StudySession } from "../types";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getLocalDateString(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getElapsedMs(timer: ActiveTimer, nowMs = Date.now()) {
  if (!timer) {
    return 0;
  }

  if (!timer.running || !timer.lastResumedAt) {
    return timer.accumulatedMs;
  }

  return timer.accumulatedMs + Math.max(0, nowMs - new Date(timer.lastResumedAt).getTime());
}

export function formatDigitalDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatCompactDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes}m`;
  }

  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${seconds}s`;
}

export function formatClockTime(isoString: string) {
  const date = new Date(isoString);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildDayRecords(sessions: StudySession[]): StudyDayRecord[] {
  const grouped = new Map<string, StudySession[]>();

  for (const session of sessions) {
    const list = grouped.get(session.sessionDate) ?? [];
    list.push(session);
    grouped.set(session.sessionDate, list);
  }

  return Array.from(grouped.entries())
    .map(([date, daySessions]) => {
      const sortedSessions = [...daySessions].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      const totalDurationMs = sortedSessions.reduce((sum, session) => sum + session.durationMs, 0);

      return {
        date,
        totalDurationMs,
        sessions: sortedSessions,
        count: sortedSessions.length
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}
