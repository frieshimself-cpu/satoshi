"use client";

import { useState } from "react";

const BADGES = [
  { ca: process.env.NEXT_PUBLIC_TOKEN_CA, label: process.env.NEXT_PUBLIC_TOKEN_CA_LABEL || "CA" },
  {
    ca: process.env.NEXT_PUBLIC_TOKEN_CA2,
    label: process.env.NEXT_PUBLIC_TOKEN_CA2_LABEL || "CA2",
  },
].filter((b): b is { ca: string; label: string } => !!b.ca);

function Chip({ ca, label }: { ca: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${ca.slice(0, 5)}…${ca.slice(-5)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={copy}
      title={ca}
      className="flex items-center gap-1.5 border border-amber-dim/60 px-2 py-0.5 text-[10px] tracking-widest text-amber-glow hover:bg-amber-dim/10"
    >
      <span className="text-amber-glow/70">{label}</span>
      <span className="font-bold">
        <span className="hidden xl:inline">{ca}</span>
        <span className="xl:hidden">{short}</span>
      </span>
      <span className="text-amber-glow/70">{copied ? "COPIED ✓" : "[COPY]"}</span>
    </button>
  );
}

/** Optional token contract-address chips. Renders nothing unless configured. */
export default function TokenBadge() {
  if (!BADGES.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BADGES.map((b) => (
        <Chip key={b.ca} ca={b.ca} label={b.label} />
      ))}
    </div>
  );
}
