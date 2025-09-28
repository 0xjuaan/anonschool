# Network School Anonymous Forum — Phased Architecture Plan

Goal: let Network School (NS) users prove membership using their NS acceptance email, then post anonymously to a public forum. Start with server‑side DKIM verification against d=ns.com; later swap to zk‑email. Posts are stored in Postgres (Supabase) and rendered via the existing Next.js UI.

## Phase 1 — Membership via DKIM (MVP)
- Flow
  - User submits the entire acceptance email as a `.eml` file (raw RFC822) to the server.
  - Server verifies DKIM (d=ns.com) and checks Subject equals exactly `"Welcome to Network School!"`. If valid, user is added to the NS group.
  - For forward‑compatibility, client may also provide a Semaphore `idCommitment` during registration; we store it now.
- API (Next.js API routes)
  - `POST /api/register/dkim` → body: `{ eml | emlBase64, idCommitment? }` → returns `{ ok, groupId: "ns.com", pubkey }`.
- Data
  - Reuse `memberships` table with `provider: 'dkim'`, `group_id: 'ns.com'`, `proof` (DKIM verification result), `proof_args` (selector, message-id, subject, domain, optional `idCommitment`).
- Implementation notes
  - Use `mailauth.authenticate(eml)` for DKIM verification.
  - Add replay protection: persist `Message-Id`/hash and reject duplicates.

## Phase 2 — Anonymous Posting with Semaphore
- Flow
  - Maintain an off‑chain Semaphore group of NS `idCommitment`s (Merkle tree) and publish current roots.
  - Client fetches latest `groupRoot`, creates a `fullProof` for `signal=hash(message)` with an `externalNullifier` (e.g., `ns-forum-v1`), and posts anonymously.
  - Server verifies proof and nullifier uniqueness, then stores the post.
- API
  - `GET /api/group/root` → latest tree root (+ depth/size if helpful).
  - `POST /api/post` → `{ signal, fullProof, merkleRoot, nullifierHash, externalNullifier }` → `{ ok, id }`.
  - `GET /api/feed` → returns recent posts for the forum.
- Data (new tables recommended, keep legacy intact)
  - `semaphore_members(id_commitment, group_id, created_at)` — source of truth for the tree.
  - `group_roots(root, depth, size, created_at)` — rolling published roots.
  - `nullifiers(hash PRIMARY KEY, external_nullifier, created_at)` — enforce one‑post/period.
  - `posts_v2(id, text, group_root, nullifier_hash, proof jsonb, created_at)` — anonymous posts.
- Libraries
  - `@semaphore-protocol/group`, `@semaphore-protocol/proof` (published circuits, wasm/zkey).

## Phase 3 — Forum UI & Flows
- Join page: upload `.eml` or paste raw headers; on success, persist `idCommitment` locally and call `/api/register/dkim`.
- Compose: fetch `groupRoot` → generate Semaphore proof → `POST /api/post`.
- Feed: reuse current list UI; wire to `/api/feed`. Keep character limits and like functionality (optional, no identity linkage).

## Phase 4 — Hardening, Ops, Migration
- Environment: `NS_DOMAIN=networkschool.org`, `FEATURE_SEMAPHORE=true` to toggle posting path.
- Moderation/rate limit: choose `externalNullifier` cadence (global/day/thread); throttle by IP, size, and cooldown.
- Logging/observability: log verification outcomes and proof checks (no PII). Add health checks.
- Swap DKIM → zk‑email later: replace `POST /api/register/dkim` verifier with zk‑email verification; schema stays compatible.

## Deliverables per Phase
- P1: `/api/register/dkim`, DKIM verifier util, minimal join UI, membership insert.
- P2: group manager (Merkle), `/api/group/root`, `/api/post`, `/api/feed`, DB tables, nullifier checks.
- P3: UI wiring for join/post/feed; copy and onboarding for NS.
- P4: flags, moderation, metrics; optional migration from legacy tables.
