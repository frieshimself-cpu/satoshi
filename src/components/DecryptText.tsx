"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEF0123456789$#@%&▓▒░";

/** Typewriter/decrypt effect: characters resolve left-to-right from noise. */
export default function DecryptText({
  text,
  className,
  speed = 28,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    frame.current = 0;
    const total = text.length;
    const id = setInterval(() => {
      frame.current += 1;
      const resolved = Math.min(frame.current, total);
      if (resolved >= total) {
        setDisplay(text);
        clearInterval(id);
        return;
      }
      let out = text.slice(0, resolved);
      for (let i = resolved; i < total; i++) {
        const c = text[i];
        out += c === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(out);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
}
