import { History, Pause, Pin, PinOff, Play, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { useAppStore } from "./store/appStore";
import type { WindowMode } from "./types";
import { buildDayRecords, formatClockTime, formatCompactDuration, formatDigitalDuration, getElapsedMs } from "./utils/time";

export function App() {
  useAppBootstrap();

  const hydrated = useAppStore((state) => state.hydrated);
  const saving = useAppStore((state) => state.saving);
  const activeTimer = useAppStore((state) => state.activeTimer);
  const sessions = useAppStore((state) => state.sessions);
  const settings = useAppStore((state) => state.settings);
  const startTimer = useAppStore((state) => state.startTimer);
  const pauseTimer = useAppStore((state) => state.pauseTimer);
  const resumeTimer = useAppStore((state) => state.resumeTimer);
  const stopTimer = useAppStore((state) => state.stopTimer);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [windowMode, setWindowMode] = useState<WindowMode>("compact");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!activeTimer?.running) {
      setNowMs(Date.now());
      return;
    }

    setNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeTimer?.running, activeTimer?.lastResumedAt]);

  useEffect(() => {
    window.__studyTimerHasRunningSession = () => Boolean(useAppStore.getState().activeTimer);
    window.__studyTimerFinalizeAndClose = async () => {
      const state = useAppStore.getState();
      if (!state.activeTimer) {
        return true;
      }

      await state.stopTimer({
        endedAt: new Date().toISOString()
      });

      return true;
    };

    return () => {
      delete window.__studyTimerHasRunningSession;
      delete window.__studyTimerFinalizeAndClose;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !window.electronWindow) {
      return;
    }

    void window.electronWindow.setAlwaysOnTop(settings.alwaysOnTop);
  }, [hydrated, settings.alwaysOnTop]);

  useEffect(() => {
    if (!hydrated || !window.electronWindow) {
      return;
    }

    const size = windowMode === "compact" ? settings.compactSize : settings.expandedSize;
    void window.electronWindow.setWindowMode(windowMode, size);
  }, [
    hydrated,
    settings.compactSize.height,
    settings.compactSize.width,
    settings.expandedSize.height,
    settings.expandedSize.width,
    windowMode
  ]);

  const elapsedMs = getElapsedMs(activeTimer, nowMs);
  const dayRecords = useMemo(() => buildDayRecords(sessions), [sessions]);
  const statusText = !activeTimer ? "Ready" : activeTimer.running ? "Running" : "Paused";
  const primaryLabel = !activeTimer ? "Start" : activeTimer.running ? "Pause" : "Resume";
  const statusTone = !activeTimer ? "is-idle" : activeTimer.running ? "is-running" : "is-paused";

  const handlePrimaryAction = async () => {
    if (!activeTimer) {
      await startTimer();
      return;
    }

    if (activeTimer.running) {
      await pauseTimer();
      return;
    }

    await resumeTimer();
  };

  const handleToggleHistory = () => {
    setWindowMode((current) => (current === "compact" ? "expanded" : "compact"));
  };

  const handleToggleAlwaysOnTop = async () => {
    await updateSettings({
      alwaysOnTop: !settings.alwaysOnTop
    });
  };

  const handleClose = async () => {
    if (window.electronWindow) {
      await window.electronWindow.close();
      return;
    }

    window.close();
  };

  if (!hydrated) {
    return <div className="boot-screen">Preparing study timer...</div>;
  }

  if (windowMode === "compact") {
    return (
      <div className="app-shell mode-compact">
        <section className="compact-shell">
          <header className="compact-bar drag-region">
            <div className="compact-readout">
              <div className={`status-dot ${statusTone}`} />
              <div className="compact-copy">
                <div className="compact-time">{formatDigitalDuration(elapsedMs)}</div>
                <div className="compact-status">{statusText}</div>
              </div>
            </div>

            <div className="compact-tools no-drag">
              <button
                aria-label={settings.alwaysOnTop ? "Disable always on top" : "Enable always on top"}
                className="icon-button"
                onClick={() => void handleToggleAlwaysOnTop()}
                title={settings.alwaysOnTop ? "Pinned" : "Normal"}
                type="button"
              >
                {settings.alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
              <button
                aria-label="Open history"
                className="icon-button"
                onClick={handleToggleHistory}
                title="History"
                type="button"
              >
                <History size={14} />
              </button>
              <button aria-label="Close window" className="icon-button" onClick={() => void handleClose()} title="Close" type="button">
                <X size={14} />
              </button>
            </div>
          </header>

          <div className="compact-actions no-drag">
            <button className="primary-button" onClick={() => void handlePrimaryAction()} type="button" disabled={saving}>
              {activeTimer?.running ? <Pause size={15} /> : <Play size={15} />}
              <span>{primaryLabel}</span>
            </button>
            <button className="secondary-button compact-stop" onClick={() => void stopTimer()} type="button" disabled={!activeTimer || saving}>
              <Square size={14} />
              <span>Stop</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell mode-expanded">
      <section className="expanded-shell">
        <header className="expanded-bar drag-region">
          <div className="expanded-title">
            <div className={`status-dot ${statusTone}`} />
            <div>
              <h1>Study Timer</h1>
              <p>
                {statusText} - {formatDigitalDuration(elapsedMs)}
              </p>
            </div>
          </div>

          <div className="expanded-tools no-drag">
            <button className="text-button" onClick={() => void handleToggleAlwaysOnTop()} type="button">
              {settings.alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
              <span>{settings.alwaysOnTop ? "Pinned" : "Pin"}</span>
            </button>
            <button className="text-button" onClick={handleToggleHistory} type="button">
              <History size={14} />
              <span>Compact</span>
            </button>
            <button aria-label="Close window" className="icon-button" onClick={() => void handleClose()} type="button">
              <X size={14} />
            </button>
          </div>
        </header>

        <section className="history-panel">
          <div className="panel-head">
            <div>
              <h2>History</h2>
              <p>Daily totals and saved session details.</p>
            </div>
          </div>

          {dayRecords.length === 0 ? (
            <div className="empty-state">No saved sessions yet.</div>
          ) : (
            <div className="history-list">
              {dayRecords.map((record) => (
                <article className="day-card" key={record.date}>
                  <div className="day-head">
                    <div>
                      <h3>{record.date}</h3>
                      <p>{record.count} sessions</p>
                    </div>
                    <strong>{formatCompactDuration(record.totalDurationMs)}</strong>
                  </div>

                  <div className="session-list">
                    {record.sessions.map((session) => (
                      <div className="session-row" key={session.id}>
                        <div>
                          <span className="session-time">
                            {formatClockTime(session.startedAt)} - {formatClockTime(session.endedAt)}
                          </span>
                          <span className="session-date-label">Start date {session.sessionDate}</span>
                        </div>
                        <strong>{formatCompactDuration(session.durationMs)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
