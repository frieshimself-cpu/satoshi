export default function DisclaimerFooter() {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-amber-dim/60 bg-charcoal-950/97 backdrop-blur-sm">
      <p className="max-w-[1600px] mx-auto px-3 sm:px-5 py-2 text-[10.5px] leading-snug text-amber-glow/80">
        <span className="font-bold tracking-widest mr-2">DISCLAIMER</span>
        This is a speculative reasoning exercise about publicly documented evidence. Nothing on
        this page is an accusation, nor a factual claim that any person is Satoshi Nakamoto.
        Satoshi&apos;s identity is unconfirmed; every named living candidate has publicly denied
        it, and the probabilities shown are one AI&apos;s evidence-weighted estimates — not
        conclusions.
      </p>
    </footer>
  );
}
