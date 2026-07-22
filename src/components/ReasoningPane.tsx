"use client";

import { useEffect, useRef, useState } from "react";
import type { Transcript } from "@/lib/types";

function ElapsedTimer({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return <span className="tabular-nums">{mm}:{ss}</span>;
}

function TranscriptSection({
  title,
  content,
  status,
  defaultOpen,
}: {
  title: string;
  content: string;
  status: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-charcoal-700 rounded-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-charcoal-800/60"
      >
        <span className="text-[11px] tracking-[0.2em] text-phosphor uppercase">{title}</span>
        <span className="flex items-center gap-2">
          {status === "error" && (
            <span className="text-[10px] text-alert tracking-widest">INTERRUPTED</span>
          )}
          <span className="text-phosphor-dim text-xs">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div className="transcript-body border-t border-charcoal-700 px-3 py-2.5 text-[#a8d8b4]">
          {content}
        </div>
      )}
    </div>
  );
}

export default function ReasoningPane({
  transcripts,
  liveText,
  liveKind,
  liveDossierIndex,
  isStreaming,
  lastError,
}: {
  transcripts: Transcript[];
  liveText: string;
  liveKind: "dossier" | "community" | "synthesis" | null;
  liveDossierIndex: number | null;
  isStreaming: boolean;
  lastError: string | null;
}) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamStartRef = useRef<number>(Date.now());
  const wasStreaming = useRef(false);

  useEffect(() => {
    if (isStreaming && !wasStreaming.current) streamStartRef.current = Date.now();
    wasStreaming.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveText, transcripts.length, autoScroll]);

  const completed = transcripts.filter((t) => t.status !== "streaming");
  const liveTitle =
    liveKind === "synthesis"
      ? "CLOSING SYNTHESIS"
      : liveKind === "community"
        ? `ANALYSIS — COMMUNITY DROP #${liveDossierIndex ?? ""}`
        : liveDossierIndex !== null
          ? `ANALYSIS — DOSSIER ${liveDossierIndex}`
          : "ANALYSIS";

  return (
    <div className="panel flex flex-col h-full min-h-0">
      <div className="panel-title justify-between">
        <span>▙ LIVE REASONING</span>
        <span className="flex items-center gap-3 normal-case tracking-normal">
          {isStreaming && (
            <span className="text-amber-glow">
              <ElapsedTimer since={streamStartRef.current} />
            </span>
          )}
          <button
            onClick={() => setAutoScroll((s) => !s)}
            className={
              "text-[10px] tracking-widest border px-1.5 py-0.5 " +
              (autoScroll
                ? "border-phosphor-dim text-phosphor"
                : "border-charcoal-600 text-charcoal-600")
            }
          >
            AUTOSCROLL {autoScroll ? "ON" : "OFF"}
          </button>
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {completed.length === 0 && !isStreaming && (
          <div className="h-full grid place-items-center py-16">
            <div className="text-center">
              <div className="text-phosphor-dim text-glow text-sm tracking-[0.3em]">
                EVIDENCE SEALED
              </div>
              <div className="text-charcoal-600 text-xs mt-2 tracking-widest">
                — analysis begins soon —
              </div>
            </div>
          </div>
        )}

        {completed.map((t) => (
          <TranscriptSection
            key={t.id}
            title={
              t.kind === "synthesis"
                ? "CLOSING SYNTHESIS"
                : t.kind === "community"
                  ? `ANALYSIS — COMMUNITY DROP #${t.dossierIndex}`
                  : `ANALYSIS — DOSSIER ${t.dossierIndex}`
            }
            content={t.content}
            status={t.status}
            defaultOpen={t.id === completed[completed.length - 1]?.id && !isStreaming}
          />
        ))}

        {isStreaming && (
          <div className="border border-amber-dim/50 rounded-sm">
            <div className="px-3 py-2 text-[11px] tracking-[0.2em] text-amber-glow text-glow-amber uppercase border-b border-charcoal-700 animate-pulseglow">
              {liveTitle} — STREAMING
            </div>
            <div className="transcript-body px-3 py-2.5 text-[#c9f0d2]">
              {liveText}
              <span className="inline-block w-2.5 h-4 bg-phosphor align-text-bottom animate-blink ml-0.5" />
            </div>
          </div>
        )}

        {lastError && !isStreaming && (
          <div className="border border-alert/50 rounded-sm px-3 py-2.5">
            <div className="text-[11px] tracking-[0.25em] text-alert animate-pulseglow">
              SIGNAL LOST — resuming...
            </div>
            <p className="text-xs text-alert/80 mt-1.5">
              The analysis stream was interrupted ({lastError}). Partial transcript preserved.
              The operator can retry from the control room — nothing is lost.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
