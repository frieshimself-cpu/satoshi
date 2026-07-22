"use client";

import { useRef, useState } from "react";

const MAX_FILE_MB = 4;

export default function SubmitForm() {
  const [claim, setClaim] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ verdict: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("claim", claim);
      fd.set("sourceUrl", sourceUrl);
      fd.set("context", context);
      const file = fileRef.current?.files?.[0];
      if (file) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          setError(`File too large (max ${MAX_FILE_MB} MB)`);
          setBusy(false);
          return;
        }
        fd.set("file", file);
      }
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
      } else {
        setResult({ verdict: data.verdict, message: data.message });
        if (data.verdict !== "reject") {
          setClaim("");
          setSourceUrl("");
          setContext("");
          if (fileRef.current) fileRef.current.value = "";
        }
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-charcoal-950 border border-charcoal-600 focus:border-phosphor-dim outline-none px-3 py-2 text-sm text-[#c9f0d2] placeholder:text-charcoal-600";

  return (
    <form onSubmit={submit} className="panel p-4 space-y-4">
      <div>
        <label className="block text-[11px] tracking-widest text-phosphor-dim mb-1.5">
          THE EVIDENCE *
        </label>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          rows={4}
          maxLength={4000}
          required
          minLength={20}
          placeholder="Describe the publicly documented evidence and why it bears on the question…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[11px] tracking-widest text-phosphor-dim mb-1.5">
          PUBLIC SOURCE (URL or citation)
        </label>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          maxLength={500}
          placeholder="https://… or 'COPA v. Wright judgment, 2024'"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[11px] tracking-widest text-phosphor-dim mb-1.5">
          CONTEXT (optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Anything the analyst should know when weighing this…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[11px] tracking-widest text-phosphor-dim mb-1.5">
          ATTACHMENT (optional — PDF or image of PUBLIC material, max {MAX_FILE_MB} MB)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
          className="block w-full text-xs text-phosphor-dim file:mr-3 file:border file:border-charcoal-600 file:bg-charcoal-900 file:text-phosphor-dim file:text-[11px] file:tracking-widest file:px-3 file:py-1.5 file:cursor-pointer"
        />
      </div>

      {error && <p className="text-alert text-xs tracking-wide">{error}</p>}
      {result && (
        <div
          className={
            "border px-3 py-2.5 text-xs leading-relaxed " +
            (result.verdict === "approve"
              ? "border-phosphor-dim text-phosphor"
              : result.verdict === "review"
                ? "border-amber-dim text-amber-glow"
                : "border-alert/60 text-alert")
          }
        >
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || claim.trim().length < 20}
        className="w-full border border-phosphor-dim text-phosphor tracking-[0.25em] text-xs py-3 hover:bg-phosphor-faint/40 disabled:opacity-40"
      >
        {busy ? "SCREENING — the AI reviewer is reading your submission…" : "SUBMIT FOR SCREENING"}
      </button>
    </form>
  );
}
