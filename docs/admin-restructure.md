# Admin navigation audit and implementation

## Route inventory

Inspected the existing Admin layout, page files, module components, authentication guard, curriculum server actions, publishing SQL, global styles, and installed Next.js guides. All 15 existing Admin pages remain. Presence and guards were checked from source; this table does not claim authenticated browser verification.

| Route | Existing implementation | Navigation and selection |
| --- | --- | --- |
| `/admin` | Supabase dashboard | Overview, six real KPIs, three quick actions plus Studio primary action, eight-course overview, twelve-draft attention sample, six recent publications |
| `/admin/curriculum` | Studio | Four tool groups; preview, approval, and publishing require a database-verified lesson |
| `/admin/curriculum/builder` | LanguageCourseBuilder | Languages and courses; parent Studio |
| `/admin/curriculum/roadmap` | UnitLessonBuilder | Course roadmap; resolves course from a lesson URL; parent Studio |
| `/admin/curriculum/ai` | AICurriculumGenerator | Existing local Ollama outline generation; parent Studio |
| `/admin/curriculum/lesson-ai` | AILessonStudio | Explicit lesson selection, synchronized course/unit, URL context and workflow |
| `/admin/curriculum/lesson-editor` | LessonContentManager | Explicit draft selection, existing editor and save actions, workflow |
| `/admin/curriculum/lesson-preview` | LessonExperiencePreview | Selected lesson required; parent selected editor; preview step controls preserved |
| `/admin/curriculum/activities` | ActivityBuilder | Explicit lesson selection; existing activity records/forms; manual authoring separated from AI entry point |
| `/admin/curriculum/practice-ai` | AIPracticeGenerator | Selected lesson honored; context retained in Activity Builder link |
| `/admin/curriculum/assessment-ai` | AIAssessmentGenerator | Selected lesson honored; assessment generation/save actions preserved |
| `/admin/curriculum/consistency` | LessonConsistencyPanel | Hardcoded lesson fallback removed; explicit selection and workflow |
| `/admin/curriculum/review` | CurriculumReadinessPanel | Explicit selection; existing checks; selected approval destination replaces obsolete publishing placeholder |
| `/admin/curriculum/approve` | LessonApprovalPanel | Existing readiness and fingerprint logic; parent selected Review |
| `/admin/curriculum/publish` | LessonPublishingPanel | Existing publication/withdrawal actions; parent selected Review |

All Admin pages and the shared layout retain `requireAccount("admin")`. Existing server-action and database authorization remain intact. Learner management and Admin settings are absent and are omitted from navigation.

One additional broken destination was found: the existing published snapshot page lived under `components/learn/published/[lessonId]/page.tsx`, which does not register an App Router route. A thin `app/learn/published/[lessonId]/page.tsx` entry now reuses it, including its existing learner-only guard and snapshot query. The Admin publishing panel no longer links an Admin into this learner-only route. The existing snapshot reader is unchanged.

## Problems corrected

- Dashboard and Studio repeated large tool grids and development-phase messaging.
- Return links used inconsistent parents, including Activity Builder to roadmap and consistency to Admin.
- Consistency silently preferred a hardcoded lesson. Editor and review also silently fell back to another lesson.
- Practice and assessment generators ignored URL lesson selection.
- Review shortcuts discarded lesson IDs and advertised publishing as unimplemented.
- Preview had duplicate parent navigation around its actual preview step controls.
- No persistent Admin sidebar or universal breadcrumb existed.

## Resulting hierarchy

The dashboard provides an overview. Curriculum Studio groups Curriculum Management, Lesson Content, Activities & Assessments, and Quality Assurance & Publishing. The persistent shell exposes only the principal workspaces. Workflow navigation is reused within modules after their selected lesson has been validated, keeping all existing editing and server operations.

The desktop sidebar collapses and scrolls independently. Tablet/mobile navigation uses a native modal dialog with keyboard focus containment, Escape handling, an explicit close control, and focus restoration. Scoped Admin CSS supplies visible focus states and reduced-motion handling. No new font dependency was introduced.

The activity-format registry remains available in a collapsible Studio section. The AI curriculum generator's roadmap link retains its selected course. Preview slide-state resets now run in navigation handlers rather than synchronously inside an effect, resolving the React lint error while retaining the speech-cleanup effect and preview step controls.

URL query parameters are the selection source. The shared URL helper validates IDs; generators initialize from the selected lesson and update URL context as their local selectors change. The selection interface offers course/unit filters and labelled lesson links. Missing or unavailable IDs do not choose another lesson automatically. Approval and publication pages retain their own server checks; visiting a workflow stage never marks it complete.

Dashboard queries are read-only. Totals use exact head counts. Recent publications, course overview, and draft attention are bounded and labelled. No dashboard readiness or approval-fingerprint RPC runs. Failures show unavailable data rather than invented zeroes. Existing records lack activity-authoring provenance, so the UI separates manual creation from the AI tool without inventing origin labels for saved records.

## Files created

- `app/admin/admin.css`
- `app/admin/error.tsx`
- `app/learn/published/[lessonId]/page.tsx`
- `components/admin/AdminShell.tsx`
- `components/admin/AdminLessonSelection.tsx`
- `components/admin/AdminWorkflowNavigation.tsx`
- `lib/admin/navigation.ts`
- `docs/admin-restructure.md`

## Existing files modified

- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/curriculum/page.tsx`
- `app/admin/curriculum/activities/page.tsx`
- `app/admin/curriculum/approve/page.tsx`
- `app/admin/curriculum/assessment-ai/page.tsx`
- `app/admin/curriculum/builder/page.tsx`
- `app/admin/curriculum/consistency/page.tsx`
- `app/admin/curriculum/lesson-ai/page.tsx`
- `app/admin/curriculum/lesson-editor/page.tsx`
- `app/admin/curriculum/lesson-preview/page.tsx`
- `app/admin/curriculum/practice-ai/page.tsx`
- `app/admin/curriculum/publish/page.tsx`
- `app/admin/curriculum/review/page.tsx`
- `app/admin/curriculum/roadmap/page.tsx`
- `components/admin/AIAssessmentGenerator.tsx`
- `components/admin/AICurriculumGenerator.tsx`
- `components/admin/AILessonStudio.tsx`
- `components/admin/AIPracticeGenerator.tsx`
- `components/admin/ActivityBuilder.tsx`
- `components/admin/CurriculumReadinessPanel.tsx`
- `components/admin/LanguageCourseBuilder.tsx`
- `components/admin/LessonApprovalPanel.tsx`
- `components/admin/LessonConsistencyPanel.tsx`
- `components/admin/LessonContentManager.tsx`
- `components/admin/LessonPublishingPanel.tsx`
- `components/admin/UnitLessonBuilder.tsx`
- `components/learn/LessonExperiencePreview.tsx`

No SQL, RLS, authentication implementation, content-storage code, approval fingerprint implementation, or publication server action was modified. Existing staged and untracked user work was retained.

## Verification

- Final `npx next typegen`: passed (invoked as `npx.cmd` because PowerShell blocks the `npx.ps1` shim).
- Final `npx tsc --noEmit`: passed (invoked as `npx.cmd`).
- Final ESLint for all Admin pages/components, the navigation helper, the modified preview, and the published-route entry: passed with no warnings or errors. Invoked through the installed ESLint CLI.
- Final `git diff --check`: passed.
- Source assertions passed for all 13 registered curriculum routes, all eight workflow destinations, ID validation/context propagation, per-page Admin guards, and removal of the hardcoded lesson fallback.
- Standalone compilation with the installed Tailwind loader passed.
- `npm run build` was executed and retried outside the sandbox, including a final build after implementation. All attempts failed in the `app/globals.css` Tailwind/Turbopack loader subprocess with a packet-receive timeout (`deadline has elapsed`). A successful production build is not claimed.
- No authenticated browser session or learner account credentials were available. Real-account permission tests, rendered navigation, mobile drawer interaction, AI/Ollama operations, and live database/snapshot comparison remain unverified.
- No content-changing or publishing/withdrawal action was invoked. The existing Saying Hello snapshot was not modified by this work; its live database equality was not independently tested.
