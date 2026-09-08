"use client";

import DecryptText from "./DecryptText";
import TokenBadge from "./TokenBadge";

export default function TopBar({
  releasedCount,
  totalDossiers,
  isStreaming,
  connected,
  synthesisTriggered,
  demo,
}: {
  releasedCount: number;
  totalDossiers: number;
  isStreaming: boolean;
  connected: boolean;
  synthesisTriggered: boolean;
  demo: boolean;
}) {
  return (
    <header className="border-b border-charcoal-600 bg-charcoal-950/95 sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-phosphor text-glow text-lg sm:text-xl font-bold tracking-[0.18em]">
          <DecryptText text="WHO IS SATOSHI?" />
        </h1>

        <div className="flex items-center gap-1.5 text-[11px] tracking-widest">
          <span className="text-phosphor-dim mr-1">DOSSIERS</span>
          {Array.from({ length: totalDossiers }, (_, i) => (
            <span
              key={i}
              className={
                "w-5 h-5 grid place-items-center border text-[10px] " +
                (i < releasedCount
                  ? "border-phosphor-dim text-phosphor bg-phosphor-faint/40"
                  : "border-charcoal-600 text-charcoal-600")
              }
            >
              {i + 1}
            </span>
          ))}
          {synthesisTriggered && (
            <a
              href="/synthesis"
              className="ml-2 text-amber-glow text-glow-amber hover:underline"
            >
              [SYNTHESIS]
            </a>
          )}
          <a href="/submit" className="ml-2 text-phosphor-dim hover:text-phosphor hover:underline">
            [SUBMIT EVIDENCE]
          </a>
        </div>

        <div className="flex items-center gap-4 ml-auto text-[11px] tracking-widest">
          {demo && (
            <span className="border border-alert/70 text-alert px-2 py-0.5 font-bold animate-pulseglow">
              DEMO MODE — SIMULATED ANALYSIS
            </span>
          )}
          {isStreaming ? (
            <span className="text-amber-glow text-glow-amber animate-pulseglow">
              ● ANALYZING
            </span>
          ) : (
            <span className="text-phosphor-dim">○ STANDBY</span>
          )}
          <span className={connected ? "text-phosphor-dim" : "text-alert animate-pulseglow"}>
            {connected ? "LINK OK" : "SIGNAL LOST — resuming..."}
          </span>
        </div>

        <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <p className="text-[10.5px] leading-snug text-charcoal-600 sm:text-phosphor-dim/70">
            The AI reasons only from the evidence shown. It cannot and will not name a single
            answer — only weigh probabilities. This is a reasoning exercise, not an accusation.
          </p>
          <span className="flex items-center gap-2">
            <TokenBadge />
            {process.env.NEXT_PUBLIC_TOKEN_CA && (
              <span className="text-[9px] text-charcoal-600 tracking-widest">
                NOT FINANCIAL ADVICE
              </span>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
