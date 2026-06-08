# Project Rules

## Deployment
- This is a TanStack Start / Nitro SSR app built with Vite.
- Vercel should use the project root as the Root Directory.
- Vercel should use the Other framework preset, `npm install` as the Install Command, `npm run build` as the Build Command, and `.vercel/output` as the Output Directory.
- Keep `vercel.json` explicit so Vercel uses npm even though `bun.lock` also exists.
- Nitro must build for Vercel output. Keep `NITRO_PRESET=vercel` in Vercel configuration.

## Environment Safety
- Never commit real `.env`, `.env.local`, or generated local Vercel handoff files.
- Always keep `.env.example` committed with variable names only.
- Public browser variables may use `VITE_*`, but private secrets must never use `VITE_*`.
- `VERCEL_ENV_IMPORT.local.env` and `VERCEL_ENV_VALUES.local.md` are local-only files for importing/copying env values into Vercel.

## Supabase
- `SUPABASE_URL` and `VITE_SUPABASE_URL` must be the base project URL, for example `https://PROJECT_REF.supabase.co`; do not append `/rest/v1`.
- `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` are anon/public keys. They may be used by browser code.
- `VITE_SUPABASE_PROJECT_ID` is the Supabase project ref, the part before `.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` is secret and server-only. Never place it in `VITE_*`, frontend code, `.env.example` values, or copy-paste files meant for public client variables.
- Do not require a service-role key unless backend/server code must bypass RLS or perform admin writes. Public reads and normal auth should use anon/public keys.

## Database And Migrations
- Migrations are SQL files that create or update database tables.
- The Supabase project ref is the part of `https://PROJECT_REF.supabase.co` before `.supabase.co`.
- If runtime errors say a table was not found in the schema cache, apply the SQL migration to the target Supabase project.
- If a table exists but the app needs starter rows, add an idempotent seed migration or document the seed SQL.

## Gemini
- `GEMINI_API_KEY` is secret backend/server-only and must never be exposed as `VITE_*`.
- `GEMINI_MODEL` should default to `gemini-2.5-flash-lite` for student projects unless the user explicitly requests another model.

## Before Deploy
- Confirm `.env` is ignored and not tracked by git.
- Confirm `.env.example` is committed with names only.
- Confirm Vercel env vars are configured for Production, Preview, and Development as needed.
- Run `npm run build` and confirm `.vercel/output` is created.
- Confirm required Supabase migrations, if any, are applied to the target project.
