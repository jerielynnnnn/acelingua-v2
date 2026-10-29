# Phase 3F.1 — AI Course Creator

Open `/admin/curriculum/ai-course` as an administrator. Select one of ten languages,
generate with local Ollama, edit the complete hierarchy and objectives, confirm
review, then explicitly **Save Course as Draft**. The returned Supabase course ID
links to the existing roadmap and language-filtered builder. New languages are
inactive; existing activation is preserved. All new courses, units and lessons
are drafts. Existing lesson generation and publishing remain separate workflows.

## Files

| Path | Change |
| --- | --- |
| `app/admin/curriculum/ai-course/page.tsx` | Dynamic admin-only page using the existing shell and Suspense convention. |
| `components/admin/curriculum/AICourseCreator.tsx` | Language selection, generation, editable/collapsible preview, explicit review, safe save/retry and returned-ID links. |
| `components/admin/curriculum/LanguageFlagCard.tsx` | Reusable keyboard-accessible native radio card, local PNG, native name and globe fallback. |
| `lib/curriculum/course-creator.ts` | Language/country mapping, structured schema, exact 3×3 validation and supported-field conversion; reuses existing outline validation. |
| `lib/curriculum/course-generation.ts` | Beginner course prompt using the existing server-only bounded Ollama transport, configuration and timeout. |
| `lib/curriculum/course-creator-actions.ts` | Independent admin checks, input validation, generation and one atomic save RPC; uncertain responses require identical retry. |
| `lib/admin/navigation.ts` | Registers the tool in Studio and breadcrumbs. |
| `components/admin/AdminShell.tsx` | Adds the course creator to existing curriculum navigation. |
| `supabase/migrations/20261029060000_ai_multilingual_courses.sql` | Admin-only transactional RPC, language reuse, duplicate-title guard and private idempotency receipts. |
| `supabase/tests/20261029_ai_course_creator_tests.sql` | Rollback-only database checks for authorization, JSON, draft hierarchy, retries, activation and existing learner records. |
| `tests/ai-course-creator.test.mjs` | Validation, authorization boundaries, persisted fields, flags, edited save, uncertain retries and AI failure tests; opt-in real Ollama smoke test. |
| `components/learn/LessonCompletionRewards.tsx` | Escapes one existing apostrophe to resolve lint; rendered wording and reward logic are unchanged. |
| `public/icons/flags/README.md` | Records FlagCDN asset source and fallback behavior. |
| `public/icons/flags/jp.png`, `kr.png`, `it.png`, `es.png`, `fr.png`, `de.png`, `cn.png`, `th.png`, `ph.png`, `gb.png` | Ten vendored PNG flags, used without external runtime requests. Korean language `ko` correctly maps to country `kr`. |
| `docs/ai-course-creator.md` | Deployment instructions, design decisions and verification record. |

No `flag_image_url` column is necessary: the reusable component resolves local
assets by an explicit country mapping. Objectives and suggested difficulty are
appended to the existing lesson description; the course difficulty is beginner.
No answer keys, learner records, rewards, existing lessons or snapshots are written.

## Database boundary

`create_ai_course_draft(uuid,text,jsonb)` rejects unauthenticated/non-admin calls
inside PostgreSQL even though `authenticated` has EXECUTE permission. It validates
JSON types, allowed keys, text limits, unique titles and exact hierarchy before
insertion. It creates only new curriculum records and calls the existing
`import_ai_curriculum_outline` within the same transaction. Failure rolls everything
back. Receipt ownership and exact payload equality prevent request-key reuse with
different content. Advisory locks serialize identical requests and this workflow's
same-language creation. Same-title courses are rejected rather than overwritten.
This does not impose a new uniqueness constraint on unrelated/manual course edits.

The private receipt table has RLS enabled and no public/anon/authenticated table
access. It is accessed through the admin-checked function only. Existing publishing
RPC source already checks `auth.uid()` and `private.is_admin()` internally. No Phase
3E functions, RLS policies or grants are replaced by this migration.

## Apply only the new migration

No migration was applied to a live database during implementation. Existing
Supabase credentials in the app do not provide an authenticated admin SQL session.
Use the SQL Editor of the intended project; do not reset or bulk-reapply history.

```powershell
Set-Location 'C:\Users\user\acelingua-v2'
Get-Content -Raw -LiteralPath '.\supabase\migrations\20261029060000_ai_multilingual_courses.sql' | Set-Clipboard
```

Paste the clipboard into Supabase SQL Editor and run it once. The migration checks
that existing admin authorization and outline-import functions are installed and
notifies PostgREST to reload its schema. Then copy and run the rollback-only test:

```powershell
Get-Content -Raw -LiteralPath '.\supabase\tests\20261029_ai_course_creator_tests.sql' | Set-Clipboard
```

That test needs an existing admin profile and Phase 3E completion/attempt tables.
It checks existing profiles (including wallets), completions, attempts and the
protected Saying Hello lesson before/after draft creation without displaying them.
It rolls back all new test records. It is not a substitute for real-account RLS
and published-player checks in the existing Phase 3E security test suite.

Repository history also contains an empty `20261029030000_learner_security_hardening.sql`
and an extensionless `20261029050000_immutable_assessment_snapshots`. These existing
files were preserved. Their presence does not prove those protections are deployed;
verify actual project security objects rather than assuming a bulk CLI push will
install them.

## Local operation and checks

The existing transport defaults to `http://127.0.0.1:11434` and `llama3.2:3b`.
Optional `.env.local` settings use `OLLAMA_BASE_URL` and `OLLAMA_MODEL`; clients
cannot select arbitrary URLs or models. Start Ollama if it is not already running:

```powershell
ollama serve
```

In another PowerShell terminal, if the model is missing:

```powershell
ollama pull llama3.2:3b
```

Then run:

```powershell
npm.cmd run dev
# Sign in as admin, then open http://localhost:3000/admin/curriculum/ai-course
npx.cmd tsc --noEmit
npm.cmd run lint
node --test tests/ai-course-creator.test.mjs tests/lesson-studio.test.mjs
$env:ACELINGUA_TEST_OLLAMA = '1'
node --test --test-name-pattern='real Korean' tests/ai-course-creator.test.mjs
Remove-Item Env:ACELINGUA_TEST_OLLAMA
npm.cmd run build
# Alternate compilation diagnostic if the existing Turbopack loader times out:
npx.cmd next build --webpack
```

For acceptance, generate Korean, change a title and objective, review and save.
Open the returned roadmap: confirm 3 draft units and 9 draft lessons. Refresh and
check the course in the existing language-filtered builder. Use a learner account
to verify the tool is inaccessible and the new drafts are not playable. Re-run
the existing Phase 3E tests and verify Saying Hello still has its existing 100%
completion, 10 XP and 5 coins; course creation never targets that lesson ID.

## Verification record

- TypeScript: passed.
- Lint: passed, with two pre-existing unused-variable warnings in
  `PublishedKnowledgeCheck.tsx` and `consistency.ts`.
- Automated course + existing lesson Studio tests: 32 passed, 2 opt-in live tests skipped.
- Separate real local Ollama run: passed in about 179 seconds. Returned
  **Korean for Beginners A1**, three units and nine validated lessons/objectives.
  No database writes were performed by the smoke test. No fake production fallback exists.
- All ten assets have valid PNG signatures; the Korean image was visually inspected.
- Offline, timeout, malformed JSON, unreviewed save and learner-denial paths were
  exercised with controlled mocks, not by modifying live accounts or stopping Ollama.
- Standard production build: failed inside and outside the sandbox at the existing
  Tailwind/Turbopack loader for `app/globals.css` (subprocess packet-receive timeout).
- Alternate `npx.cmd next build --webpack`: passed, including TypeScript, page
  generation and the new `/admin/curriculum/ai-course` route. Network access was
  needed for the project's existing Google fonts. Default build configuration
  was preserved; this diagnostic does not establish browser styling correctness.
- Live SQL/RLS, real-account UI editing/saving, mobile/browser rendering, learner
  discovery and saved Japanese rewards were not verified here. The new migration
  and rollback checks still need execution in the intended Supabase project.
