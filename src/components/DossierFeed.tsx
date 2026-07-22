"use client";

import { useState } from "react";
import type { PublicDossier } from "@/lib/types";
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

export default function DossierFeed({ dossiers }: { dossiers: PublicDossier[] }) {
  return (
    <div className="space-y-3">
      {dossiers.map((d) =>
        d.released ? (
          <ReleasedCard key={d.index} dossier={d} />
        ) : (
          <SealedCard key={d.index} dossier={d} />
        )
      )}
    </div>
  );
}
