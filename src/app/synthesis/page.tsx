import DisclaimerFooter from "@/components/DisclaimerFooter";
import Leaderboard from "@/components/Leaderboard";
import TokenBadge from "@/components/TokenBadge";
import { getCandidates } from "@/lib/data";
import { getSnapshots, getTranscripts } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWING_ITEMS = [
  {
    heading: "Movement of the dormant coins",
    body: "The ~1M BTC mined by the 'Patoshi' miner in 2009–2010 has never moved. A spend from those addresses — with an accompanying signed message — would be near-conclusive proof of key control by whoever authorized it.",
  },
  {
    heading: "A verified signature from an early block key",
    body: "A message cryptographically signed with a private key from one of Satoshi's known early blocks (e.g. block 9, used in the first transaction to Hal Finney) is the gold standard. Every public 'proof' offered to date has failed this test.",
  },
  {
    heading: "The GMX / Vistomail accounts or PGP key",
    body: "Demonstrated, verifiable control of satoshin@gmx.com, satoshi@vistomail.com, or Satoshi's original PGP key would be strong (though weaker than a block-key signature, since email accounts can be compromised).",
  },
  {
    heading: "Primary documents",
    body: "Contemporaneous drafts, code, or correspondence from 2007–2010 with a verifiable chain of custody — the kind of evidence courts weigh — could settle it. Note that forged documents have already been judicially exposed in this saga.",
  },
  {
    heading: "Why nothing less suffices",
    body: "Stylometry, timezones, and circumstance can narrow a candidate pool but cannot identify a person. They are probabilistic by nature — which is exactly why this investigation ends in a probability distribution, not a name.",
  },
];

export default function SynthesisPage() {
  const transcripts = getTranscripts();
  const synthesis = transcripts.find((t) => t.kind === "synthesis" && t.status === "complete");
  const snapshots = getSnapshots();
  const candidates = getCandidates();

  if (!synthesis) {
    return (
      <main className="min-h-screen grid place-items-center px-4 pb-24">
        <div className="text-center max-w-md">
          <h1 className="text-phosphor text-glow tracking-[0.3em] text-lg">SYNTHESIS SEALED</h1>
          <p className="text-phosphor-dim text-sm mt-4 leading-relaxed">
            The closing analysis has not been triggered yet. It unlocks only after all five
            dossiers have been released and analyzed — and even then, it will not name an
            answer.
          </p>
          <a
            href="/"
            className="inline-block mt-6 border border-phosphor-dim text-phosphor text-xs tracking-[0.25em] px-5 py-2.5 hover:bg-phosphor-faint/40"
          >
            ← BACK TO THE LIVE BOARD
          </a>
        </div>
        <DisclaimerFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      <header className="border-b border-charcoal-600 bg-charcoal-950/95 px-4 sm:px-6 py-4">
        <div className="max-w-[1200px] mx-auto">
          <h1 className="text-phosphor text-glow tracking-[0.25em] text-lg sm:text-xl">
            WHO IS SATOSHI? — CLOSING SYNTHESIS
          </h1>
          <p className="text-[11px] text-amber-glow/90 tracking-widest mt-1.5">
            THE QUESTION REMAINS OPEN. THIS IS A WEIGHING OF EVIDENCE, NOT A REVEAL.
          </p>
          <div className="mt-2">
            <TokenBadge />
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <section className="panel">
          <div className="panel-title">▙ THE ANALYST&apos;S FINAL REASONING</div>
          <div className="transcript-body p-4 text-[#a8d8b4]">{synthesis.content}</div>
        </section>

        <div className="space-y-5">
          <div className="h-[520px]">
            <Leaderboard snapshots={snapshots} candidates={candidates} />
          </div>

          <section className="panel">
            <div className="panel-title">▙ WHAT WOULD IT TAKE TO ACTUALLY KNOW?</div>
            <div className="p-4 space-y-4">
              {KNOWING_ITEMS.map((item) => (
                <div key={item.heading}>
                  <div className="text-[11px] tracking-widest text-amber-glow uppercase">
                    » {item.heading}
                  </div>
                  <p className="text-xs leading-relaxed text-[#a8d8b4] mt-1">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <a
            href="/"
            className="inline-block border border-phosphor-dim text-phosphor text-xs tracking-[0.25em] px-5 py-2.5 hover:bg-phosphor-faint/40"
          >
            ← BACK TO THE LIVE BOARD
          </a>
        </div>
      </div>

      <DisclaimerFooter />
    </main>
  );
}
