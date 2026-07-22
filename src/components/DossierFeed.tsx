"use client";

import { useState } from "react";
import type { CommunityBatch, PublicDossier } from "@/lib/types";
import DecryptText from "./DecryptText";

function SealedCard({ dossier }: { dossier: Extract<PublicDossier, { released: false }> }) {
  return (
    <div className="panel p-3 opacity-70 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.25em] text-charcoal-600">
          DOSSIER {dossier.index} — {dossier.codename}
        </span>
        <span className="text-[10px] tracking-[0.3em] text-alert/70 border border-alert/40 px-1.5 py-0.5">
          SEALED
        </span>
      </div>
      <div className="mt-3 space-y-2 blur-[3px]">
        <span className="redacted-bar w-11/12" />
        <span className="redacted-bar w-3/4" />
        <span className="redacted-bar w-5/6" />
        <span className="redacted-bar w-2/3" />
      </div>
    </div>
  );
}

function ReleasedCard({
  dossier,
}: {
  dossier: Extract<PublicDossier, { released: true }>;
}) {
  const [open, setOpen] = useState(true);
  const time = new Date(dossier.releasedAt).toUTCString().replace("GMT", "UTC");

  return (
    <div className="panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2.5 hover:bg-charcoal-800/60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tracking-[0.25em] text-amber-glow text-glow-amber">
            DOSSIER {dossier.index} — <DecryptText text={dossier.codename} />
          </span>
          <span className="text-phosphor-dim text-xs">{open ? "▾" : "▸"}</span>
        </div>
        <div className="text-phosphor text-sm mt-1">{dossier.title}</div>
        <div className="text-[10px] text-phosphor-dim/70 mt-0.5">RELEASED {time}</div>
      </button>
      {open && (
        <div className="border-t border-charcoal-700 px-3 py-2.5 space-y-3">
          <p className="text-xs text-phosphor-dim italic">{dossier.summary}</p>
          {dossier.items.map((item) => (
            <div key={item.heading}>
              <div className="text-[11px] tracking-widest text-phosphor uppercase">
                » {item.heading}
              </div>
              <p className="text-xs leading-relaxed mt-1 text-[#a8d8b4]">{item.content}</p>
              <p className="text-[10px] text-charcoal-600 mt-1">SOURCE: {item.source}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityCard({ batch }: { batch: CommunityBatch }) {
  const [open, setOpen] = useState(true);
  const time = new Date(batch.releasedAt).toUTCString().replace("GMT", "UTC");

  return (
    <div className="panel border-amber-dim/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2.5 hover:bg-charcoal-800/60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tracking-[0.25em] text-amber-glow text-glow-amber">
            COMMUNITY DROP #{batch.id} — <DecryptText text="CROWDSOURCE" />
          </span>
          <span className="text-phosphor-dim text-xs">{open ? "▾" : "▸"}</span>
        </div>
        <div className="text-phosphor text-sm mt-1">
          Community-Submitted Evidence ({batch.submissions.length} item
          {batch.submissions.length === 1 ? "" : "s"})
        </div>
        <div className="text-[10px] text-phosphor-dim/70 mt-0.5">RELEASED {time}</div>
      </button>
      {open && (
        <div className="border-t border-charcoal-700 px-3 py-2.5 space-y-3">
          <p className="text-[10px] text-amber-glow/70 leading-relaxed">
            AI-screened public submissions. Claims are as submitted — the analyst weighs them
            skeptically and unverifiable claims move the board little or not at all.
          </p>
          {batch.submissions.map((s, i) => (
            <div key={i}>
              <div className="text-[11px] tracking-widest text-phosphor uppercase">
                » SUBMISSION {i + 1}
              </div>
              <p className="text-xs leading-relaxed mt-1 text-[#a8d8b4]">
                {s.screenerSummary || s.claim}
              </p>
              {s.sourceUrl && (
                <p className="text-[10px] text-charcoal-600 mt-1 break-all">
                  CLAIMED SOURCE: {s.sourceUrl}
                </p>
              )}
              {s.fileName && (
                <p className="text-[10px] text-charcoal-600 mt-0.5">ATTACHMENT: {s.fileName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DossierFeed({
  dossiers,
  communityBatches = [],
}: {
  dossiers: PublicDossier[];
  communityBatches?: CommunityBatch[];
}) {
  // Interleave chronologically: dossiers by release time, community drops by theirs.
  type Entry =
    | { at: number; el: React.ReactNode }
    | { at: number; el: React.ReactNode };
  const entries: Entry[] = [];

  for (const d of dossiers) {
    entries.push({
      at: d.released ? new Date(d.releasedAt).getTime() : Number.MAX_SAFE_INTEGER,
      el: d.released ? (
        <ReleasedCard key={`d${d.index}`} dossier={d} />
      ) : (
        <SealedCard key={`d${d.index}`} dossier={d} />
      ),
    });
  }
  for (const b of communityBatches) {
    entries.push({
      at: new Date(b.releasedAt).getTime(),
      el: <CommunityCard key={`c${b.id}`} batch={b} />,
    });
  }
  entries.sort((a, b) => a.at - b.at);

  return <div className="space-y-3">{entries.map((e) => e.el)}</div>;
}
