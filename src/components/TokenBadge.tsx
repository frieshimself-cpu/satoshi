"use client";

import { useState } from "react";

const CA = process.env.NEXT_PUBLIC_TOKEN_CA;

/** Optional token contract-address chip. Renders nothing unless configured. */
export default function TokenBadge() {
  const [copied, setCopied] = useState(false);
  if (!CA) return null;

  const short = `${CA.slice(0, 5)}…${CA.slice(-5)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      onClick={copy}
      title={CA}
      className="flex items-center gap-1.5 border border-amber-dim/60 px-2 py-0.5 text-[10px] tracking-widest text-amber-glow hover:bg-amber-dim/10"
    >
      <span className="text-amber-glow/70">CA</span>
      <span className="font-bold">
        <span className="hidden xl:inline">{CA}</span>
        <span className="xl:hidden">{short}</span>
      </span>
      <span className="text-amber-glow/70">{copied ? "COPIED ✓" : "[COPY]"}</span>
    </button>
  );
}
