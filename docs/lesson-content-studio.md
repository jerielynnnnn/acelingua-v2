# AI-assisted Lesson Content Studio

## Audit findings and design

The previous editor exposed teaching steps, dialogues, and activity answer configuration primarily as JSON. It offered four record-oriented tabs, put repetition checks above every editing session, and provided no integrated section-level AI proposals. The existing full-package generator rejects lessons that already contain steps and creates the same sequence, including audio-only repetitions. Its save function cannot atomically fill gaps in a populated lesson.

The enhanced `/admin/curriculum/lesson-editor` keeps the existing Admin layout, authentication guard, selected-lesson URL, course/unit/lesson hierarchy, underlying tables, and dedicated activity/assessment tools. It now offers Overview, Vocabulary, Teaching Flow, Conversation, Practice & Assessment, and Review & Preview tabs. Tab controls support arrow keys, Home, and End. Individual record forms preserve compatible unknown keys; raw JSON maintenance remains optional under Advanced.

Vocabulary cards show pronunciation, meaning, usage notes, locale, current-lesson duplicates, and matches in genuinely earlier lessons (ordered by unit and lesson number). Listening is manual. Target-language and English dialogue fields remain separate. Legacy combined translations are preserved until the administrator replaces them. New per-line translations also produce the combined translation required by existing review and publishing functions.

The teaching timeline displays actual saved step numbers and never renumbers existing records. Missing-content additions use a readable append order, with one vocabulary card per newly added expression and no redundant listening-only slide. Existing listening records are retained. Objectives and teaching explanations use compatible introduction JSON fields. Complete readable teaching text is also maintained in `content.text`, which the existing snapshot serializer already whitelists, so future publication does not silently omit these sections.

## AI modes

- **Generate Missing Content:** proposes supported absent teaching sections and incomplete vocabulary (three to seven total entries). Existing sections are never automatically replaced. Dialogue and application suggestions depend on the topic rather than a mandatory identical package sequence.
- **Vocabulary Suggestions / Generate Conversation:** focused missing-section proposals.
- **Improve Selected Section:** proposes exactly one replacement for a selected supported saved record, with original-versus-suggested content.
- **Generate Alternative:** uses the same selected-record boundary to propose a different suitable version.
- **Review Content with AI:** advisory findings only; it cannot save changes.
- **Suggest Practice Activities:** advisory recommendations based on the saved teaching content. Actual activities and Knowledge Checks still use their existing dedicated tools and validation.

All modes reuse the local transport and model configuration in `lesson-ai.ts`. Requests run through Admin-protected server actions. Context includes the actual language/locale, course, difficulty, unit, lesson topic and objectives, existing content, earlier vocabulary, assessment, and optional instructions. The transport restricts requests to local Ollama, bounds prompt/response size, uses structured JSON, and reports connection and timeout failures. Model output and edited candidates are validated again before saving. Unsupported kinds, unrelated record IDs, duplicate phrases, oversized fields, and invalid structures are rejected. Linguistic correctness still requires human review.

Generation never writes content. An administrator chooses candidate changes, can edit them through forms, explicitly acknowledges review, and confirms saving. Source versions reject stale proposals. Approved or previously published lessons require a separate draft-revision acknowledgement. The Studio does not publish or withdraw lessons.

## Database change and deployment requirement

`supabase/migrations/20261028020000_lesson_studio_safe_apply.sql` is an additive function migration. It adds no tables, columns, table policies, or storage formats:

- `get_lesson_studio_version` exposes the existing private content fingerprint only to authorized administrators.
- `apply_lesson_studio_changes` locks the lesson/unit/course, compares the reviewed fingerprint, checks draft status and revision acknowledgement, and atomically applies a reviewed batch.
- Existing record edits reuse `edit_lesson_content` and its validation. Exact matching draft teaching cards are synchronized when their vocabulary source is edited.
- New records append safely; existing records are not deleted or renumbered. Existing approvals become stale through the unchanged fingerprint comparison.
- Both functions independently enforce Admin authorization and restrict executable privileges. They contain no writes to approvals or published snapshots.

This function is necessary because the existing package importer rejects populated lessons and cannot atomically apply a partial proposal or reject a stale reviewed batch. **The migration was prepared but not applied to Supabase.** Deploy it after the existing approval/editor/publishing migrations to enable safe AI suggestion saving. Until then the UI explains that AI suggestion saving is unavailable, while existing record editing continues through the original protected RPC (with explicit draft-revision confirmation where required). That fallback does not offer the new optimistic-lock/card-synchronization guarantees.

## Published content and existing systems

When a snapshot exists, the Studio shows “Published Snapshot Exists”, its status, and an expandable read-only overview. Draft edits do not update the live version. A fresh approval is required for legitimate source changes. Existing publishing limitations and controlled publication rules remain unchanged; replacement/republishing support is not introduced here.

No migration was executed and no curriculum-save, approval, publication, or withdrawal action was invoked against real data. The current Saying Hello snapshot was not modified by this work. A live database equality comparison remains unverified.

Existing full-package AI generation, Activity Builder, assessment generation, readiness engine, consistency engine, approval implementation, published snapshot reader, authentication, proxy, RLS, and learner account/profile flows remain in place. The Admin preview additionally displays objectives, explanations, context and per-line dialogue translations, with target-language locale handling rather than treating every Latin-script dialogue as English.

## Files changed in this enhancement

Modified:

- `app/admin/curriculum/lesson-editor/page.tsx`
- `components/admin/LessonContentManager.tsx`
- `components/learn/LessonExperiencePreview.tsx`
- `lib/admin/navigation.ts`
- `lib/curriculum/lesson-ai.ts`
- `lib/curriculum/lesson-editor-actions.ts`

Created:

- `components/admin/StudioRecordFields.tsx`
- `lib/curriculum/lesson-studio.ts`
- `lib/curriculum/lesson-studio-actions.ts`
- `lib/curriculum/lesson-studio-context.ts`
- `supabase/migrations/20261028020000_lesson_studio_safe_apply.sql`
- `tests/lesson-studio.test.cjs`
- `docs/lesson-content-studio.md`

## Verification

- `node --test tests/lesson-studio.test.cjs`: 23 tests passed, covering field validation, duplicate normalization, legacy compatibility, snapshot-text compatibility, read-only generation, source context, one-record improvement, explicit review confirmation, stale-source rejection, tampering, transactional RPC usage, mocked learner denial, and transport bounds/errors.
- The SQL test checks independent authorization/locking and absence of snapshot writes from source; it does not execute the migration or prove live RLS behavior.
- Type generation, TypeScript, and ESLint passed during implementation; final check results are recorded after completion.
- `npm run build` ran inside and outside the sandbox. Both failed in `app/globals.css` with the existing Tailwind/Turbopack loader subprocess packet-receive timeout (`deadline has elapsed`). A successful production build is not claimed.
- Local Ollama was reachable and reported `llama3.2:3b`. An unsaved real-model numbers-vocabulary smoke test was run separately from application data; its outcome is recorded after completion.
- No authenticated browser or real learner credentials were available. Live content loading/saving, browser navigation, keyboard/mobile behavior, real learner rejection, approval fingerprint changes after actual saves, and live snapshot comparisons remain unverified. No SQL CLI/database test environment was available for migration execution.
