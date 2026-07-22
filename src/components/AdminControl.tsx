"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInvestigation } from "./useInvestigation";
import Leaderboard from "./Leaderboard";

export default function AdminControl({ rehearsalMode }: { rehearsalMode: boolean }) {
  const inv = useInvestigation();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<number | null>(null);
  const [resetStage, setResetStage] = useState(0);

  const call = async (label: string, url: string, body?: unknown) => {
    setBusyAction(label);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(`✗ ${data.error ?? `${label} failed`}`);
      } else {
        setMessage(`✓ ${label} complete`);
      }
      await inv.refresh();
    } catch {
      setMessage(`✗ ${label} — network error (stream may still be running; watch the preview)`);
    } finally {
      setBusyAction(null);
    }
  };

  if (!inv.state) {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="text-phosphor-dim tracking-[0.35em] text-sm animate-pulseglow">
          ESTABLISHING LINK...
        </div>
      </main>
    );
  }

  const s = inv.state;
  const nextIndex = s.releasedCount + 1;
  const failedDossier = s.transcripts.find(
    (t) => t.kind === "dossier" && t.status === "error"
  );
  const retryIndex = failedDossier?.dossierIndex ?? null;
  const allReleased = s.releasedCount >= s.totalDossiers;
  const busy = busyAction !== null || inv.isStreaming;

  return (
    <main className="min-h-screen pb-10">
      <header className="border-b border-charcoal-600 bg-charcoal-950/95 px-4 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="text-phosphor text-glow tracking-[0.25em] text-sm">▙ CONTROL ROOM</h1>
        {rehearsalMode && (
          <span className="text-[10px] tracking-[0.25em] text-amber-glow border border-amber-dim px-2 py-0.5 animate-pulseglow">
            REHEARSAL MODE — NO API CALLS
          </span>
        )}
        <span className="text-[11px] text-phosphor-dim tracking-widest">
          DOSSIERS {s.releasedCount}/{s.totalDossiers}
          {s.synthesis.triggered && " · SYNTHESIS DONE"}
        </span>
        <span
          className={
            "text-[11px] tracking-widest " +
            (inv.connected ? "text-phosphor-dim" : "text-alert animate-pulseglow")
          }
        >
          {inv.connected ? "LINK OK" : "SIGNAL LOST"}
        </span>
        <div className="ml-auto flex gap-3">
          <a href="/" target="_blank" className="text-[11px] text-phosphor-dim hover:text-phosphor tracking-widest">
            [DASHBOARD]
          </a>
          <a href="/synthesis" target="_blank" className="text-[11px] text-phosphor-dim hover:text-phosphor tracking-widest">
            [SYNTHESIS]
          </a>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.refresh();
            }}
            className="text-[11px] text-charcoal-600 hover:text-alert tracking-widest"
          >
            [LOGOUT]
          </button>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-4 py-5 grid lg:grid-cols-[360px_1fr_400px] gap-4">
        {/* --- Controls --- */}
        <div className="space-y-4">
          <section className="panel p-4 space-y-3">
            <h2 className="text-[11px] tracking-[0.25em] text-phosphor-dim uppercase">
              Release sequence
            </h2>

            {retryIndex !== null ? (
              <button
                disabled={busy}
                onClick={() => call(`Retry dossier ${retryIndex}`, "/api/admin/release", { index: retryIndex })}
                className="w-full border border-alert/60 text-alert tracking-[0.2em] text-xs py-3 hover:bg-alert/10 disabled:opacity-40"
              >
                ⟳ RETRY DOSSIER {retryIndex} (stream failed)
              </button>
            ) : !allReleased ? (
              confirmRelease === nextIndex ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-glow">
                    Release Dossier {nextIndex} and start the live analysis?
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setConfirmRelease(null);
                        void call(`Release dossier ${nextIndex}`, "/api/admin/release", { index: nextIndex });
                      }}
                      className="flex-1 border border-phosphor-dim text-phosphor tracking-[0.2em] text-xs py-2.5 hover:bg-phosphor-faint/40 disabled:opacity-40"
                    >
                      CONFIRM — DROP IT
                    </button>
                    <button
                      onClick={() => setConfirmRelease(null)}
                      className="flex-1 border border-charcoal-600 text-charcoal-600 tracking-[0.2em] text-xs py-2.5 hover:text-phosphor-dim"
                    >
                      ABORT
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => setConfirmRelease(nextIndex)}
                  className="w-full border border-phosphor-dim text-phosphor tracking-[0.2em] text-xs py-3 hover:bg-phosphor-faint/40 disabled:opacity-40"
                >
                  ► RELEASE DOSSIER {nextIndex}
                </button>
              )
            ) : (
              <p className="text-xs text-phosphor-dim">All dossiers released.</p>
            )}

            <div className="text-[10px] text-charcoal-600 leading-relaxed">
              Dossiers release strictly in order. Each release streams the analysis live to
              every viewer, then updates the board.
            </div>
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="text-[11px] tracking-[0.25em] text-phosphor-dim uppercase">
              Closing synthesis
            </h2>
            <button
              disabled={busy || !allReleased || s.synthesis.triggered}
              onClick={() => call("Synthesis", "/api/admin/synthesis")}
              className="w-full border border-amber-dim text-amber-glow tracking-[0.2em] text-xs py-3 hover:bg-amber-dim/10 disabled:opacity-40"
            >
              ◆ TRIGGER SYNTHESIS
            </button>
            <div className="text-[10px] text-charcoal-600 leading-relaxed">
              The finale. A closing argument with a final board — explicitly NOT a reveal.
              Unlocks /synthesis. Requires all {s.totalDossiers} dossiers analyzed.
            </div>
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="text-[11px] tracking-[0.25em] text-alert/80 uppercase">Danger</h2>
            {resetStage === 0 && (
              <button
                disabled={busy}
                onClick={() => setResetStage(1)}
                className="w-full border border-charcoal-600 text-charcoal-600 tracking-[0.2em] text-xs py-2.5 hover:border-alert/60 hover:text-alert disabled:opacity-40"
              >
                RESET INVESTIGATION
              </button>
            )}
            {resetStage === 1 && (
              <div className="space-y-2">
                <p className="text-xs text-alert">
                  This erases all releases, transcripts, and snapshots. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResetStage(2)}
                    className="flex-1 border border-alert/60 text-alert tracking-widest text-xs py-2"
                  >
                    YES, CONTINUE
                  </button>
                  <button
                    onClick={() => setResetStage(0)}
                    className="flex-1 border border-charcoal-600 text-charcoal-600 tracking-widest text-xs py-2"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
            {resetStage === 2 && (
              <div className="space-y-2">
                <p className="text-xs text-alert font-bold">
                  FINAL CONFIRMATION — this cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setResetStage(0);
                      void call("Reset", "/api/admin/reset", { confirm: "RESET THE INVESTIGATION" });
                    }}
                    className="flex-1 border border-alert text-alert bg-alert/10 tracking-widest text-xs py-2"
                  >
                    ERASE EVERYTHING
                  </button>
                  <button
                    onClick={() => setResetStage(0)}
                    className="flex-1 border border-charcoal-600 text-charcoal-600 tracking-widest text-xs py-2"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </section>

          {message && (
            <div className="panel p-3 text-xs tracking-widest text-phosphor-dim">{message}</div>
          )}
          {busyAction && (
            <div className="panel p-3 text-xs tracking-widest text-amber-glow animate-pulseglow">
              ● {busyAction.toUpperCase()} IN PROGRESS — watch the preview
            </div>
          )}
        </div>

        {/* --- Live preview --- */}
        <div className="panel flex flex-col min-h-[60vh] max-h-[calc(100vh-140px)]">
          <div className="panel-title">▙ LIVE STREAM PREVIEW</div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {inv.isStreaming ? (
              <div className="transcript-body text-[#c9f0d2]">
                {inv.liveText}
                <span className="inline-block w-2.5 h-4 bg-phosphor align-text-bottom animate-blink ml-0.5" />
              </div>
            ) : (
              <div className="transcript-body text-phosphor-dim/70">
                {s.transcripts.length
                  ? s.transcripts[s.transcripts.length - 1].content
                  : "No analysis yet. Release Dossier 1 to begin."}
              </div>
            )}
          </div>
        </div>

        {/* --- Board preview --- */}
        <div className="min-h-[60vh] max-h-[calc(100vh-140px)]">
          <Leaderboard snapshots={s.snapshots} candidates={s.candidates} />
        </div>
      </div>
    </main>
  );
}
