import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ),
  title: "WHO IS SATOSHI? — Live AI Investigation",
  description:
    "An AI analyst weighs public evidence about Bitcoin's creator, live — probabilities only, never a verdict. A speculative reasoning exercise, not an accusation.",
  openGraph: {
    title: "WHO IS SATOSHI? — Live AI Investigation",
    description:
      "Staged evidence dossiers. A live probability leaderboard. An AI that will never name a single answer.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WHO IS SATOSHI? — Live AI Investigation",
    description:
      "Staged evidence dossiers. A live probability leaderboard. An AI that will never name a single answer.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="crt-vignette" />
        {children}
      </body>
    </html>
  );
}
