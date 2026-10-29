"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import LanguageFlagCard from "./LanguageFlagCard";
import { courseLanguages, selectedLanguage, validateCourseDraft, type CourseDraft } from "@/lib/curriculum/course-creator";
import { generateCourseAction, saveCourseDraftAction, type SavedCourse } from "@/lib/curriculum/course-creator-actions";

const fieldClass = "mt-1 w-full rounded-xl border border-[#C7A9D4] bg-white p-3 text-sm text-[#2A255C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3558AE] disabled:opacity-70";
function TextField({ label, value, onChange, max, multiline = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; max: number; multiline?: boolean; disabled?: boolean }) {
  const props = { value, disabled, maxLength: max, required: true, className: fieldClass, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label className="block text-sm font-semibold">{label}{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</label>;
}
export default function AICourseCreator() {
  const [languageCode, setLanguage] = useState("ko");
  const [goals, setGoals] = useState("");
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [requestId, setRequestId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedCourse | null>(null);
  const lock = useRef(false);
  // A failed network response may follow a committed transaction: freeze that
  // candidate until its identical request is retried, rather than risk duplicates.
  const [saveAttempted, setSaveAttempted] = useState(false);
  const language = selectedLanguage(languageCode);
  function edit(update: (copy: CourseDraft) => void) {
    if (!draft || busy || saved || saveAttempted) return;
    const copy = structuredClone(draft); update(copy); setDraft(copy); setReviewed(false);
  }
  async function generate() {
    if (lock.current) return;
    if (draft && !saved && !window.confirm("Replace this unsaved outline? Your edits will be discarded.")) return;
    lock.current = true; setBusy("generate"); setError("");
    try {
      const response = await generateCourseAction({ languageCode, goals });
      if (!response.ok) { setError(response.error); return; }
      setDraft(response.data); setRequestId(crypto.randomUUID()); setReviewed(false); setSaved(null); setSaveAttempted(false);
    } catch { setError("The generation request failed. Check your connection and try again."); }
    finally { lock.current = false; setBusy(null); }
  }
  async function save() {
    if (!draft || lock.current || saved) return;
    try { validateCourseDraft(draft); } catch (error) { setError(error instanceof Error ? error.message : "Invalid outline."); return; }
    if (!reviewed) { setError("Review and approve the full outline first."); return; }
    lock.current = true; setBusy("save"); setError(""); setSaveAttempted(true);
    try {
      const result = await saveCourseDraftAction({ languageCode, draft, reviewed, requestId });
      if (result.ok) setSaved(result.data);
      else { setError(result.retryOnly ? `${result.error} Retry this same draft to recover its save receipt safely.` : result.error); setSaveAttempted(result.retryOnly === true); }
    } catch { setError("Save confirmation was interrupted. Retry this same draft to recover its save receipt safely."); }
    finally { lock.current = false; setBusy(null); }
  }
  const immutable = !!busy || !!saved || saveAttempted;
  return <main className="space-y-7 text-[#2A255C]">
    <header className="relative overflow-hidden rounded-3xl border border-white bg-white/65 p-6 shadow-sm sm:p-8">
      <div aria-hidden="true" className="absolute -right-10 -top-12 h-56 w-56 rounded-full bg-gradient-to-br from-[#F9C3D7] via-[#C7A9D4] to-[#3558AE]/30 blur-3xl motion-safe:animate-pulse" />
      <div className="relative"><p className="mb-2 text-sm font-bold text-[#B64074]">CURRICULUM STUDIO · AI ASSISTED</p><h1 className="text-3xl font-extrabold">AI Course Creator</h1><p className="mt-3 max-w-2xl text-slate-600">Turn a language into a beginner learning journey. Generate locally with Ollama, refine every detail, then save your reviewed outline as a draft.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">{["1 · Choose a language", "2 · Generate & review", "3 · Save as draft"].map(step => <span key={step} className="rounded-full bg-[#eeeafd] px-3 py-2">{step}</span>)}</div>
      </div>
    </header>
    <section className="rounded-3xl border border-white bg-white/60 p-5 sm:p-7">
      <fieldset disabled={!!busy || !!draft}>
        <legend className="mb-4 text-xl font-bold">Choose your teaching language</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{courseLanguages.map(item => <LanguageFlagCard key={item.code} language={item} selected={item.code === languageCode} disabled={!!busy || !!draft} onSelect={setLanguage} />)}</div>
      </fieldset>
      <p className="mt-4 text-sm text-slate-600">Beginner · A1 · 3 units · 9 lessons. Existing languages retain their activation settings; new languages start inactive.</p>
      <label className="mt-5 block text-sm font-semibold">Optional learning goals<textarea className={fieldClass} maxLength={1000} rows={2} value={goals} disabled={!!busy || !!saved || saveAttempted} onChange={event => setGoals(event.target.value)} placeholder="For example: practical travel greetings and everyday conversation" /></label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!!busy || saveAttempted} onClick={generate} className="flex items-center gap-2 rounded-xl bg-[#3558AE] px-5 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3558AE] disabled:opacity-60">{busy === "generate" ? <LoaderCircle className="motion-safe:animate-spin" size={18} /> : <Sparkles size={18} />}{draft ? "Regenerate outline" : "Generate with Ollama"}</button>
        {draft && !busy && <button type="button" disabled={saveAttempted && !saved} className="text-sm font-bold text-[#3558AE] underline disabled:opacity-50" onClick={() => { if (saved || window.confirm("Discard this outline and choose another language?")) { setDraft(null); setSaved(null); setReviewed(false); setError(""); setSaveAttempted(false); } }}>Choose another language</button>}
      </div>
      {busy === "generate" && <p role="status" className="mt-3 text-sm">Generating a complete {language.name} outline locally. This can take a few minutes.</p>}
    </section>
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">{error}</div>}
    {draft && <section aria-label="Editable course preview" className="space-y-5 rounded-3xl border border-[#C7A9D4]/50 bg-white/80 p-5 sm:p-7">
      <div><h2 className="text-2xl font-bold">Review your {language.name} course</h2><p className="mt-2 text-sm text-slate-600">Objectives and suggested difficulty are saved in each lesson description. Teaching content and assessments can be added in the existing Studio.</p></div>
      <TextField label="Course title" max={150} value={draft.title} disabled={immutable} onChange={value => edit(copy => { copy.title = value; })} />
      <TextField label="Course description" max={3000} multiline value={draft.description} disabled={immutable} onChange={value => edit(copy => { copy.description = value; })} />
      {draft.units.map((unit, ui) => <details key={ui} open className="rounded-2xl border border-[#C7A9D4]/50 bg-[#f9f7ff] p-4">
        <summary className="cursor-pointer rounded-lg py-2 font-bold focus-visible:outline-2 focus-visible:outline-[#3558AE]">Unit {ui + 1} · {unit.title} <span className="text-sm font-normal text-slate-600">· 3 lessons</span></summary>
        <div className="mt-4 space-y-4">
          <TextField label={`Unit ${ui + 1} title`} max={150} value={unit.title} disabled={immutable} onChange={value => edit(copy => { copy.units[ui].title = value; })} />
          <TextField label={`Unit ${ui + 1} description`} max={3000} multiline value={unit.description} disabled={immutable} onChange={value => edit(copy => { copy.units[ui].description = value; })} />
          {unit.lessons.map((lesson, li) => <fieldset key={li} disabled={immutable} className="space-y-3 rounded-xl border border-white bg-white p-4">
            <legend className="px-2 text-sm font-bold text-[#B64074]">Lesson {ui + 1}.{li + 1} · Beginner A1</legend>
            <TextField label="Lesson title" max={150} value={lesson.title} onChange={value => edit(copy => { copy.units[ui].lessons[li].title = value; })} />
            <TextField label="Lesson description" max={2000} multiline value={lesson.description} onChange={value => edit(copy => { copy.units[ui].lessons[li].description = value; })} />
            <TextField label="Learning objective" max={700} multiline value={lesson.learning_objective} onChange={value => edit(copy => { copy.units[ui].lessons[li].learning_objective = value; })} />
            <label className="block text-sm font-semibold">Lesson type<select className={fieldClass} value={lesson.lesson_type} onChange={event => edit(copy => { copy.units[ui].lessons[li].lesson_type = event.target.value as typeof lesson.lesson_type; })}>{["standard", "conversation", "review"].map(type => <option key={type}>{type}</option>)}</select></label>
          </fieldset>)}
        </div>
      </details>)}
      {!saved && <div className="space-y-4 border-t border-[#C7A9D4]/40 pt-5">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={reviewed} disabled={immutable} onChange={event => setReviewed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#3558AE]" /><span>I have reviewed this complete outline and approve saving it as a draft.</span></label>
        <button type="button" onClick={save} disabled={!reviewed || !!busy} className="flex items-center gap-2 rounded-xl bg-[#B64074] px-5 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B64074] disabled:opacity-50">{busy === "save" && <LoaderCircle size={18} className="motion-safe:animate-spin" />}{busy === "save" ? "Saving draft…" : saveAttempted ? "Retry Save Course as Draft" : "Save Course as Draft"}</button>
        <p role={busy === "save" ? "status" : undefined} className="text-sm text-slate-600">{busy === "save" ? "Saving the complete course in one transaction…" : "All units and lessons remain drafts. Continue through the existing review and publishing workflow when ready."}</p>
      </div>}
    </section>}
    {saved && <section role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><h2 className="flex items-center gap-2 text-xl font-bold"><CheckCircle2 />Course saved as draft</h2><p className="mt-2">3 units and 9 lessons created.</p><p className="mt-2 break-all text-sm">Course ID: {saved.course_id}</p><div className="mt-4 flex flex-wrap gap-4 font-bold"><Link className="underline" href={`/admin/curriculum/roadmap?course=${saved.course_id}`}>Open course roadmap</Link><Link className="underline" href={`/admin/curriculum/builder?language=${saved.language_id}`}>Open Curriculum Studio</Link></div></section>}
  </main>;
}
