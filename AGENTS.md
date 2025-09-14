# Repository Guidelines

This guide helps contributors work productively and consistently across the repo.

## Project Structure & Module Organization
- `app/` — Next.js 14 (TypeScript) UI.
  - `pages/` routes and `pages/api/` endpoints.
  - `components/`, `lib/`, `styles/`, `assets/` (includes zk artifacts).
- `circuit/` — Noir circuit and build tooling (`build.sh`, `Nargo.toml`).
- `schema.sql` — Database schema (used with Supabase/Postgres).
- `.github/` — GitHub configs and workflows (if any).

## Build, Test, and Development Commands
- UI (run inside `app/`):
  - `yarn dev` — Start local dev server at `http://localhost:3000`.
  - `yarn build` — Production build.
  - `yarn start` — Serve production build.
  - `yarn lint` — ESLint (Next.js config).
- Circuit (run at repo root):
  - `bash circuit/build.sh` — Compile Noir circuit and generate `app/assets/jwt/circuit*.json`.
    Requires `nargo`, `bb` (Barretenberg), `jq`, and Node.
- Env: `cp app/.env.example app/.env.local` and fill values (Supabase, OAuth).

## Coding Style & Naming Conventions
- TypeScript, strict where practical; prefer explicit types at module boundaries.
- ESLint extends `next/core-web-vitals`; max line length 120 enforced.
- Indentation: 2 spaces; semicolons required; single quotes preferred where possible.
- React components: PascalCase names; file names kebab-case (e.g., `message-form.tsx`).
- SCSS files use kebab-case in `app/styles/`.

## Testing Guidelines
- No formal test suite yet. For changes in `app/lib/` or API routes, add lightweight unit tests (e.g., Jest/Vitest) under `app/**/__tests__` with `*.test.ts` and document setup in your PR.
- At minimum, verify locally via `yarn dev`: sign-in flow, message posting, and API endpoints.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, etc. (matches history).
- Keep PRs focused and linked to an issue. Include:
  - What changed and why; steps to reproduce/verify.
  - Screenshots/GIFs for UI changes.
  - Note circuit changes and commit generated artifacts in `app/assets/jwt/`.
- Ensure `yarn lint` passes; run `bash circuit/build.sh` if the circuit changed.

## Security & Configuration
- Never commit secrets. `.env*` and `circuit/target/` are git-ignored.
- Use service keys only server-side (API routes); avoid logging sensitive data.

