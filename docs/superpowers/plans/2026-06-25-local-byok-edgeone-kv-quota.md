# Local BYOK And EdgeOne KV Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local user API settings, remove Supabase auth/key storage paths, and enforce a 20/day/IP default API quota through EdgeOne KV.

**Architecture:** The browser stores BYOK settings in localStorage and attaches them to model requests. Agent endpoints resolve model config from request BYOK first; when absent, they use platform env and enforce daily IP quota through EdgeOne KV. A lightweight `/usage` cloud function reports current quota for the header display.

**Tech Stack:** Next.js 16, React 19, TypeScript, EdgeOne Makers agent/cloud function runtime, EdgeOne KV binding `LINGMO_USAGE_KV`, Node test runner.

---

### Task 1: Quota and BYOK shared helpers

**Files:**
- Create: `lib/quota.mjs`
- Create: `test/quota.test.mjs`
- Modify: `package.json`

- [ ] Write failing tests for daily limit defaults, local BYOK header parsing, and KV quota behavior.
- [ ] Run `node --test test/quota.test.mjs` and verify failure because helper does not exist.
- [ ] Implement `lib/quota.mjs` with request-model parsing, IP hashing, limit resolution, and EdgeOne KV get/put enforcement.
- [ ] Run `node --test test/quota.test.mjs` and existing tests.

### Task 2: Backend model resolution and usage endpoint

**Files:**
- Modify: `agents/_shared.ts`
- Create: `cloud-functions/usage/index.ts`
- Modify: agent endpoint imports only as needed

- [ ] Write backend behavior around shared helper through tests from Task 1.
- [ ] Update `resolveModelEnv` to prefer request-provided BYOK config and remove Supabase user-key lookup.
- [ ] Update `enforceDailyQuota` / `recordTokenUsage` to use EdgeOne KV quota only for platform API requests.
- [ ] Add `/usage` cloud function that returns quota status for the current IP.

### Task 3: Frontend local API settings and quota display

**Files:**
- Create: `app/lib/local-api-settings.ts`
- Create: `app/components/api-settings-controls.tsx`
- Modify: `app/page.tsx`
- Modify: `app/components/refine-bar.tsx`
- Modify: `app/components/topic-form.tsx` if needed

- [ ] Write browser-safe utilities for localStorage settings and request headers.
- [ ] Replace `AuthControls` with `ApiSettingsControls` in the header.
- [ ] Attach local API settings headers to outline/create/refine/suggest-keywords requests.
- [ ] Refresh quota display after generation/refine actions.

### Task 4: Remove Supabase dependency paths

**Files:**
- Modify: `cloud-functions/articles/index.ts`
- Modify: `cloud-functions/preferences/index.ts`
- Delete: `cloud-functions/model-settings/index.ts`
- Delete: `app/auth/callback/route.ts`
- Delete: `lib/supabase/client.ts`
- Delete: `lib/supabase/server.ts`
- Delete: `lib/server/supabase-admin.ts`
- Delete: `supabase/migrations/...`
- Modify: `package.json`, lockfile

- [ ] Remove Supabase imports and auth-dependent branching.
- [ ] Remove Supabase packages from dependencies and regenerate lockfile.
- [ ] Verify `rg supabase` only finds historical docs if any.

### Task 5: Verification

**Files:**
- All touched files

- [ ] Run `node --test test/*.test.mjs`.
- [ ] Run `npm run build`.
- [ ] Inspect `git status` and summarize.
