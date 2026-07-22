# WHO IS SATOSHI? — Live AI Investigation Dashboard

An AI investigator ("ANALYST", Claude via the Anthropic API) reasons publicly about the
identity of Bitcoin's creator from staged evidence dossiers, maintaining a live,
animated **probability leaderboard** — and, by hard design constraint, **never names a
single answer**.

## Editorial standards (read this first)

This app investigates an **unsolved question about real people, some living**. These
rules are the product's spine — do not weaken them:

- The AI must **never** output a definitive "Satoshi is [Name]" conclusion. Its output
  is always a probability distribution summing to ~100%.
- The **"Unknown / Not Listed" bucket never drops below 15%.** This floor is enforced
  three times: in the system prompt, in the extraction prompt, and — decisively — in
  server-side renormalization code (`src/lib/renormalize.ts`). Even if the model
  misbehaves, the floor holds.
- Every claim about a living person is phrased as **evidence-weighted likelihood**
  ("the public evidence is consistent with...") tied to publicly documented,
  non-defamatory sources. The dossiers and candidate files contain only sourced,
  public evidence — including candidates' own denials and the 2024 UK High Court
  finding that Craig Wright is *not* Satoshi.
- A **non-dismissable disclaimer** renders on every page.
- The finale is a **synthesis, not a reveal**: it summarizes what the evidence
  collectively supports and steelmans "we cannot know."

If you're contributing: do not edit the system prompt's ABSOLUTE RULES, do not remove
the renormalization floor, and do not add evidence to `data/*.json` that isn't publicly
documented with a source.

These rules extend to **community submissions** (see below): every submission passes an
AI screener enforcing the same standards (public, sourced, non-defamatory, no private
information, no prompt injection) before it can ever reach the analyst, borderline cases
require human approval, and the analyst is instructed to treat all submissions as
untrusted data whose unverifiable claims move the board little or not at all.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `@anthropic-ai/sdk`, model `claude-sonnet-4-6`, streaming
- `better-sqlite3` persistence (releases, transcripts, leaderboard snapshots)
- Server-Sent Events + in-memory pub/sub; clients replay from the DB on refresh

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY and ADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

Pages:

- `/` — public live dashboard (dossier feed · live reasoning · probability board)
- `/submit` — public evidence submission form (AI-screened)
- `/admin` — password-gated control room (release, synthesis, community drops,
  review queue, reset, live preview)
- `/synthesis` — hidden until the synthesis is triggered

## Community evidence submissions

Anyone can submit evidence at `/submit`: a claim (required), a public source, optional
context, and an optional PDF/image attachment (public material only, max 4 MB).

Pipeline:

1. **AI screening (synchronous).** Each submission is reviewed by a Claude screener
   against the editorial rules. Verdicts: `approve` (enters the pool), `reject`
   (with reason, shown to the submitter), or `review` (held for the operator). If the
   screener is unreachable or returns garbage, the submission is **held for review** —
   nothing is ever auto-published on failure. Per-IP rate limit: 5/hour.
2. **Operator queue.** `/admin` shows held submissions with the screener's reasoning
   (approve/reject buttons), plus the approved pool — any approved item can be pulled
   before release.
3. **Community drop.** "RELEASE COMMUNITY DROP" batches all approved submissions into
   one evidence release that runs through the exact same live pipeline as a dossier:
   streamed analysis (attachments included as PDF/image blocks), extraction,
   renormalization (sum = 100, Unknown ≥ 15% — enforced in code), animated board
   update. Drops can happen at any point before the synthesis; after the synthesis the
   board is final and community releases are refused.

Injection/abuse posture: submissions are wrapped as untrusted data in both the
screener and analyst prompts; the analyst can only assign probability to the fixed
candidate list plus Unknown (a claim about an unlisted person can only feed the
Unknown bucket); and the code-level floor holds regardless of what any submission
says. Uploaded files are stored outside the web root, size- and type-restricted, and
deleted on reset.

## Run of show

1. **Before doors open**
   - `.env.local` has the real `ANTHROPIC_API_KEY`, a strong `ADMIN_PASSWORD`, and
     `REHEARSAL_MODE` unset or `0`.
   - Visit `/admin`, log in, confirm the header does **not** show "REHEARSAL MODE".
   - Confirm the dashboard shows "EVIDENCE SEALED — analysis begins soon" and all five
     dossiers as SEALED.
2. **The show** — from `/admin`, click **RELEASE DOSSIER N** (confirm prompt) for
   N = 1…5, in order (the server enforces order). Each release:
   - streams the analysis live to every open dashboard (~1–2 min each),
   - then animates the leaderboard to the new snapshot.
   Let each analysis fully land (status returns to STANDBY) before the next drop.
3. **Community drops (optional, any time before the finale)** — when the approved
   pool has material worth airing, click **RELEASE COMMUNITY DROP**. Check the review
   queue between dossiers; approve or reject held submissions as they come in.
4. **The finale** — click **TRIGGER SYNTHESIS**. This produces the closing reasoning
   (explicitly not a reveal) and unlocks `/synthesis`. Community drops are disabled
   from this point on.
5. **If a stream dies mid-analysis** — the dashboard shows "SIGNAL LOST — resuming...",
   the partial transcript is preserved, and `/admin` shows a retry button (for the
   failed dossier or community drop). Click it; the failed attempt is discarded and
   re-run. No transcript from completed releases is ever lost.

### Rehearsal

Set `REHEARSAL_MODE=1` in `.env.local` and restart. The full pipeline runs with a
deterministic simulated analyst and screener — zero API calls, zero cost — so you can
practice the entire run of show, watch the bars animate, and test reset/retry. The
simulated screener approves everything except submissions containing the markers
`SIM-REJECT` (rejected) or `SIM-REVIEW` (held for review), so all three submission
paths can be rehearsed. The admin header shows a pulsing "REHEARSAL MODE" badge so you
can't confuse it with the live show. **Reset and set `REHEARSAL_MODE=0` before going
live.**

### Reset workflow

1. `/admin` → **RESET INVESTIGATION** → confirm twice (the API additionally requires
   the exact phrase `RESET THE INVESTIGATION`, which the UI sends).
2. This erases releases, transcripts, and snapshots, and broadcasts a reset to all
   connected viewers. It is refused while an analysis is streaming.
3. The database file lives at `data/satoshi.db` (or `DB_PATH`); deleting it with the
   server stopped is an equivalent hard reset.

## Deploying to Vercel

The app deploys on Vercel as-is (`better-sqlite3` is marked as a server external
package; API routes are Node runtime). Two platform caveats to know:

1. **Persistence** — Vercel's filesystem is ephemeral, so the SQLite file defaults to
   `/tmp/satoshi.db`: state survives within a warm instance but not across cold starts
   or deploys. For a one-evening live show on a single warm instance this is usually
   fine; for durable persistence, run it on a VM/container host (Railway, Fly.io, a
   VPS) or point `DB_PATH` at a mounted volume. The SSE pub/sub is likewise in-memory
   and assumes a single server instance — which is also what makes SQLite correct here.
2. **Function duration** — a release runs a full streamed analysis (1–3 min). The
   routes declare `maxDuration = 300`; on Vercel make sure your plan/fluid-compute
   settings allow ≥300s for `/api/admin/release` and `/api/admin/synthesis`.

Set `ANTHROPIC_API_KEY` and `ADMIN_PASSWORD` in the Vercel project's environment
variables. Do **not** set `REHEARSAL_MODE` in production.

## Data files

- `data/candidates.json` — candidate profiles with sourced public evidence, plus the
  permanent "Unknown / Not Listed" entry. Do not remove the unknown entry.
- `data/dossiers.json` — five neutral, non-pre-attributed evidence dossiers.

## Architecture notes

- `POST /api/admin/release` → validates session + strict order → rebuilds the full
  conversation from the DB (system prompt + all prior dossier/analysis exchanges) →
  streams Claude's analysis (tokens broadcast over SSE + buffered for mid-stream
  joins) → persists the transcript → runs a second non-streamed JSON-extraction call →
  renormalizes defensively → stores + broadcasts the leaderboard snapshot.
- `GET /api/stream` — SSE: `token`, `dossier_started`, `dossier_complete`,
  `synthesis_started`, `synthesis_complete`, `leaderboard_update`, `analysis_error`,
  `reset`, plus heartbeats.
- `GET /api/state` — full replayable state (including the in-flight stream buffer),
  so refreshes lose nothing.
