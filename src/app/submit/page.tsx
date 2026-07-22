import SubmitForm from "@/components/SubmitForm";
import DisclaimerFooter from "@/components/DisclaimerFooter";

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  return (
    <main className="min-h-screen pb-24">
      <header className="border-b border-charcoal-600 bg-charcoal-950/95 px-4 sm:px-6 py-4">
        <div className="max-w-[820px] mx-auto">
          <h1 className="text-phosphor text-glow tracking-[0.25em] text-lg">
            SUBMIT EVIDENCE
          </h1>
          <p className="text-[11px] text-phosphor-dim tracking-widest mt-1.5">
            POINT THE ANALYST AT SOMETHING PUBLIC IT SHOULD WEIGH
          </p>
        </div>
      </header>

      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <section className="panel p-4 text-xs leading-relaxed space-y-2">
          <p className="text-amber-glow tracking-widest text-[11px]">THE RULES</p>
          <ul className="list-disc pl-4 space-y-1.5 text-[#a8d8b4]">
            <li>
              <span className="text-phosphor">Public evidence only.</span> Published articles,
              archived posts, blockchain data, court records, published analyses. If it isn&apos;t
              already part of the public record, it doesn&apos;t belong here.
            </li>
            <li>
              <span className="text-phosphor">No private information about anyone.</span>{" "}
              Addresses, employers, family details, photos of private individuals — instant
              rejection.
            </li>
            <li>
              <span className="text-phosphor">No accusations.</span> Submissions are weighed
              probabilistically by the analyst; nothing here declares anyone to be Satoshi.
            </li>
            <li>
              Every submission is screened by an AI reviewer against these rules before it can
              reach the analyst; borderline cases go to a human operator. Accepted evidence is
              released in batches as a live &quot;Community Evidence&quot; drop.
            </li>
          </ul>
        </section>

        <SubmitForm />

        <a
          href="/"
          className="inline-block border border-phosphor-dim text-phosphor text-xs tracking-[0.25em] px-5 py-2.5 hover:bg-phosphor-faint/40"
        >
          ← BACK TO THE LIVE BOARD
        </a>
      </div>

      <DisclaimerFooter />
    </main>
  );
}
