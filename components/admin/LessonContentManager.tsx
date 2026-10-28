"use client";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Eye, LoaderCircle, PencilLine, Save, Sparkles, Volume2 } from "lucide-react";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";
import StudioRecordFields, { finalizeStudioPayload, StudioReadout, studioField } from "./StudioRecordFields";
import { saveLessonEditorAction, type EditorRecordType } from "@/lib/curriculum/lesson-editor-actions";
import { applyStudioProposal, proposeStudioContent } from "@/lib/curriculum/lesson-studio-actions";
import type { StudioContext } from "@/lib/curriculum/lesson-studio-context";
import { normalizePhrase, object, studioKinds, text, type StudioMode, type StudioKind, type StudioProposal } from "@/lib/curriculum/lesson-studio";
import { analyzeLessonConsistency } from "@/lib/curriculum/consistency";
import { lessonHref } from "@/lib/admin/navigation";
type Props = {
  courses: {
    id: string;
    title: string;
  }[];
  units: {
    id: string;
    courseId: string;
    title: string;
    number: number;
  }[];
  lessons: {
    id: string;
    unitId: string;
    title: string;
    number: number;
  }[];
  selectedLessonId: string;
  studio: StudioContext;
};
type Editing = {
  type: EditorRecordType;
  id: string;
  kind: string;
  payload: Record<string, unknown>;
};
const tabs = [["overview", "Overview"], ["vocabulary", "Vocabulary"], ["flow", "Teaching Flow"], ["conversation", "Conversation"], ["practice", "Practice & Assessment"], ["review", "Review & Preview"]] as const;
type Tab = typeof tabs[number][0];
const card = "rounded-2xl border border-[#C7A9D4]/30 bg-white/95 p-5 shadow-sm sm:p-6";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2A255C] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-[#C7A9D4]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#3558AE] hover:bg-[#f4f1ff] disabled:cursor-not-allowed disabled:opacity-50";
export default function LessonContentManager({ courses, units, lessons, selectedLessonId, studio: s }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [instructions, setInstructions] = useState("");
  const [proposal, setProposal] = useState<StudioProposal | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [confirmRevision, setConfirmRevision] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [target, setTarget] = useState("");
  const editorRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const locked = !!busy || pending;
  const needsRevision = !!s.snapshot || text(s.approval.status) !== "not_approved";
  const courseUnits = units.filter(unit => unit.courseId === s.course.id);
  const unitLessons = lessons.filter(lesson => lesson.unitId === s.unit.id);
  const questionList = Array.isArray(s.assessment?.questions) ? s.assessment.questions : [];
  const missing = [!s.vocabulary.length && "vocabulary", !s.steps.some(step => step.step_type === "introduction") && "introduction", !s.steps.some(step => step.step_type === "summary") && "summary", !s.activities.length && "practice activities", !questionList.length && "Knowledge Check"].filter(Boolean);
  const consistency = analyzeLessonConsistency({ lessonId: selectedLessonId, lessonTitle: s.lesson.title, vocabulary: s.vocabulary, courseVocabulary: [...s.vocabulary, ...s.previousVocabulary], lessons: [...lessons, ...s.previousLessons], steps: s.steps, activities: s.activities, assessment: s.assessment });
  const targets = [...s.vocabulary.filter(item => item.status === "draft").map(item => ({ key: "vocabulary:" + item.id, label: item.phrase, type: "vocabulary" as const, id: item.id })), ...s.steps.filter(item => item.status === "draft" && studioKinds.includes(item.step_type as StudioKind)).map(item => ({ key: "step:" + item.id, label: item.title, type: "step" as const, id: item.id }))];
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    if (editing || proposal?.changes.length)
      window.addEventListener("beforeunload", handler);
    return () => { window.removeEventListener("beforeunload", handler); window.speechSynthesis?.cancel(); };
  }, [editing, proposal]);
  useEffect(() => {
    if (editing?.id) {
      editorRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      editorRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    }
  }, [editing?.id]);
  function navigate(lessonId: string) {
    if ((editing || proposal) && !window.confirm("Discard unsaved edits and AI suggestions before switching lessons?"))
      return;
    if (lessonId)
      startTransition(() => router.push(lessonHref("lesson-editor", lessonId)));
  }
  function changeCourse(id: string) {
    const unit = units.filter(item => item.courseId === id).sort((a, b) => a.number - b.number)[0];
    const lesson = lessons.filter(item => item.unitId === unit?.id).sort((a, b) => a.number - b.number)[0];
    if (lesson)
      navigate(lesson.id);
    else
      setError("That course has no draft lesson to edit. Create one in the roadmap first.");
  }
  function changeUnit(id: string) {
    const lesson = lessons.filter(item => item.unitId === id).sort((a, b) => a.number - b.number)[0];
    if (lesson)
      navigate(lesson.id);
    else
      setError("That unit has no draft lesson to edit. Create one in the roadmap first.");
  }
  function listen(phrase: string, locale: string) {
    if (!phrase.trim())
      return;
    const script = locale.startsWith("ja") ? /[\u3040-\u30ff\u3400-\u9fff]/u : locale.startsWith("ko") ? /[\uac00-\ud7af]/u : locale.startsWith("zh") ? /[\u3400-\u9fff]/u : locale.startsWith("th") ? /[\u0e00-\u0e7f]/u : null;
    if (script && !script.test(phrase)) {
      setError("This target-language line does not match its speech locale. Correct it before listening.");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is unavailable in this browser.");
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(item => item.lang.toLowerCase() === locale.toLowerCase()) || voices.find(item => item.lang.toLowerCase().split("-")[0] === locale.toLowerCase().split("-")[0]);
    if (!voice) {
      setError("No matching voice is available for this language. Check browser voice support and try again.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = locale;
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
  function openEditor(next: Editing) {
    if (editing && !window.confirm("Discard the current unsaved edit?"))
      return;
    setEditing({ ...next, payload: structuredClone(next.payload) });
    setError("");
    setSuccess("");
  }
  async function saveRecord() {
    if (!editing || locked)
      return;
    if (needsRevision && !confirmRevision) {
      setError("Confirm the draft revision before saving.");
      return;
    }
    if (!window.confirm("Save these reviewed draft-source changes? Previous approval will require review again. Published content will not change."))
      return;
    setBusy("save");
    setError("");
    try {
      const payload = finalizeStudioPayload(editing.type, editing.kind, editing.payload);
      const result = await saveLessonEditorAction({ lessonId: selectedLessonId, recordId: editing.id, recordType: editing.type, payload, expectedVersion: s.version, confirmRevision });
      if (!result.ok)
        throw new Error(result.error);
      setSuccess(result.message);
      setEditing(null);
      setProposal(null);
      setReviewed(false);
      setConfirmRevision(false);
      router.refresh();
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    }
    finally {
      setBusy("");
    }
  }
  async function generate(mode: StudioMode, chosen = target, focus?: StudioKind, practice = false) {
    if (locked)
      return;
    if (editing) {
      setError("Save or cancel your manual edit first. AI uses saved lesson content.");
      return;
    }
    if (proposal && !window.confirm("Replace this unsaved AI proposal?"))
      return;
    const found = targets.find(item => item.key === chosen);
    setBusy("generate");
    setError("");
    setSuccess("");
    setProposal(null);
    setReviewed(false);
    setSelected([]);
    try {
      const result = await proposeStudioContent({ lessonId: selectedLessonId, mode, instructions, focus, reviewFocus: practice ? "practice" : undefined, target: found ? { recordType: found.type, recordId: found.id } : undefined });
      if (!result.ok)
        throw new Error(result.error);
      setProposal(result.data);
      setSelected(result.data.changes.map((_, i) => i));
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed.");
    }
    finally {
      setBusy("");
    }
  }
  async function applyProposal() {
    if (!proposal || !reviewed || !selected.length || locked)
      return;
    if (editing) {
      setError("Save or cancel the manual edit before applying an AI proposal.");
      return;
    }
    if (needsRevision && !confirmRevision) {
      setError("Confirm the draft revision before saving.");
      return;
    }
    if (!window.confirm("Apply only the selected, reviewed suggestions to draft source? No published snapshot will be changed."))
      return;
    setBusy("apply");
    setError("");
    try {
      const result = await applyStudioProposal({ proposal: { ...proposal, changes: proposal.changes.filter((_, i) => selected.includes(i)) }, confirmRevision, reviewed });
      if (!result.ok)
        throw new Error(result.error);
      setSuccess(result.data);
      setProposal(null);
      setReviewed(false);
      setConfirmRevision(false);
      router.refresh();
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to apply suggestions.");
    }
    finally {
      setBusy("");
    }
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight")
      next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home")
      next = 0;
    else if (event.key === "End")
      next = tabs.length - 1;
    else
      return;
    event.preventDefault();
    setTab(tabs[next][0]);
    tabRefs.current[next]?.focus();
  }
  function editButton(type: EditorRecordType, id: string, kind: string, payload: Record<string, unknown>, status = "draft") {
    return <button type="button" className={secondary} disabled={locked || !s.editable || status !== "draft"} onClick={() => openEditor({ type, id, kind, payload })}>
      <PencilLine size={15} />Edit</button>;
  }
  function stepCard(step: StudioContext["steps"][number]) {
    return <article key={step.id} className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold capitalize text-slate-500">Step {step.step_number} / {step.step_type.replace(/_/g, " ")}
          </p>
          <h3 className="mt-1 font-bold">
            {step.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {editButton("step", step.id, step.step_type, { title: step.title, content: step.content }, step.status)}{studioKinds.includes(step.step_type as StudioKind) && <button type="button" className={secondary} disabled={locked || step.status !== "draft"} onClick={() => generate("improve", "step:" + step.id)}>
            <Sparkles size={15} />AI Improve</button>}
        </div>
      </div>
      <StudioReadout value={step.content} />
      {["vocabulary", "listening", "speaking"].includes(step.step_type) && <button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#3558AE]" onClick={() => listen(text(step.content.phrase), text(step.content.locale) || s.locale)}>
        <Volume2 size={16} />Listen</button>}{step.step_type === "dialogue" && <div className="mt-4 flex flex-wrap gap-3">
          {["a", "b"].map(key => <button key={key} className={secondary} onClick={() => listen(text(step.content["line_" + key]), text(step.content.locale) || s.locale)}>Listen to {text(step.content["speaker_" + key]) || key.toUpperCase()}
          </button>)}{text(step.content.translation_a) && <button className={secondary} onClick={() => listen(text(step.content.translation_a), "en-US")}>Listen to English translation A</button>}{text(step.content.translation_b) && <button className={secondary} onClick={() => listen(text(step.content.translation_b), "en-US")}>Listen to English translation B</button>}
        </div>}
    </article>;
  }
  return <main className="space-y-6 text-[#2A255C]">
    <AdminWorkflowNavigation slug="lesson-editor" lesson={selectedLessonId} />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#B64074]">Curriculum Studio</p>
        <h1 className="mt-2 text-3xl font-extrabold">Lesson Content Studio</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">Create, organize, and refine interactive language lessons with AI assistance.</p>
      </div>
      <Link className={secondary} href={lessonHref("lesson-preview", selectedLessonId)}>
        <Eye size={17} />Preview Lesson</Link>
    </header>
    <section className={card} aria-label="Lesson selection">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold">Select Course<select className={studioField} value={s.course.id} disabled={locked} onChange={event => changeCourse(event.target.value)}>
          {courses.map(item => <option key={item.id} value={item.id}>
            {item.title}
          </option>)}
        </select>
        </label>
        <label className="text-sm font-semibold">Select Unit<select className={studioField} value={s.unit.id} disabled={locked} onChange={event => changeUnit(event.target.value)}>
          {courseUnits.map(item => <option key={item.id} value={item.id}>Unit {item.number}: {item.title}
          </option>)}
        </select>
        </label>
        <label className="text-sm font-semibold">Select Lesson<select className={studioField} value={selectedLessonId} disabled={locked} onChange={event => navigate(event.target.value)}>
          {unitLessons.map(item => <option key={item.id} value={item.id}>Lesson {item.number}: {item.title}
          </option>)}
        </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">
          {s.lesson.title}
        </h2>
        <span className="rounded-full bg-[#f4f1ff] px-3 py-1 text-xs font-semibold capitalize">
          {s.lesson.status} source</span>
        <span className="rounded-full bg-[#f4f1ff] px-3 py-1 text-xs font-semibold">Approval: {text(s.approval.status).replace(/_/g, " ") || "Unavailable"}
        </span>
        {text(s.approval.approved_at) && <time className="text-xs text-slate-500" dateTime={text(s.approval.approved_at)}>Last approval: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(text(s.approval.approved_at)))}
        </time>}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {s.language.name} / {s.course.title} / {s.unit.title} / Lesson {s.lesson.lesson_number}
      </p>
    </section>
    {s.snapshot && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="flex items-center gap-2 font-bold text-emerald-900">
        <CheckCircle2 size={18} />Published Snapshot Exists</h2>
      <p className="mt-2 text-sm text-emerald-900">Snapshot status: {s.snapshot.status}. Draft source edits do not update the live published version. Review, reapproval and a controlled publishing workflow are required for any future publication.</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Read-only published-content overview</summary>
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="mb-4 text-sm">
            {s.snapshot.course_title} / {s.snapshot.unit_title} / {s.snapshot.lesson_title}
          </p>
          <StudioReadout value={s.snapshot.learning_content} />
        </div>
      </details>
    </section>}
    {needsRevision && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <input type="checkbox" checked={confirmRevision} disabled={locked} onChange={event => setConfirmRevision(event.target.checked)} className="mt-1 accent-[#3558AE]" />
      <span>I am editing draft source. I understand that changes require fresh approval and do not replace or republish an existing snapshot.</span>
    </label>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      {error}
    </p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      {success}
    </p>}
    <section className={card} aria-label="AI assistance">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="text-[#B64074]" size={20} />AI lesson assistant</h2>
        <p className="text-xs text-slate-500">Suggestions stay unsaved until you review and confirm.</p>
      </div>
      <label className="mt-4 block text-sm font-semibold">Optional teaching instructions<textarea className={studioField} rows={2} maxLength={1000} disabled={locked} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Focus, learning objectives, intentional revision, or tone..." />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={primary} disabled={locked || !s.editable} onClick={() => generate("missing")}>
          {busy === "generate" ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}Generate Missing Content</button>
        {s.vocabulary.length < 3 && <button className={secondary} disabled={locked} onClick={() => generate("missing", "", "vocabulary")}>Vocabulary Suggestions</button>}{!s.steps.some(step => step.step_type === "dialogue") && <button className={secondary} disabled={locked} onClick={() => generate("missing", "", "dialogue")}>Generate Conversation</button>}<button className={secondary} disabled={locked} onClick={() => generate("review", "", undefined, true)}>Suggest Practice Activities</button>
        <button className={secondary} disabled={locked} onClick={() => generate("review")}>Review Content with AI</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">Improve one saved section<select className={studioField} disabled={locked} value={target} onChange={event => setTarget(event.target.value)}>
          <option value="">Select a vocabulary entry or teaching step</option>
          {targets.map(item => <option key={item.key} value={item.key}>
            {item.label}
          </option>)}
        </select>
        </label>
        <button className={secondary} disabled={locked || !target} onClick={() => generate("improve")}>Improve Selected Section</button>
        <button className={secondary} disabled={locked || !target} onClick={() => generate("alternative")}>Generate Alternative</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">AI uses the saved topic, language, difficulty, objectives, existing content, and vocabulary from earlier lessons. Linguistic feedback is advisory and needs human review.</p>
      {!s.version && <p role="status" className="mt-3 text-sm text-amber-800">Safe AI suggestion saving is currently unavailable. You can still review suggestions and edit existing records.</p>}
    </section>
    {proposal && <section className={card}>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">Review AI proposal</h2>
        <button className={secondary} disabled={locked} onClick={() => setProposal(null)}>Discard proposal</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Nothing has been saved. Compare originals, edit candidates, and select only the changes you want. New sections append without renumbering saved records.</p>
      {proposal.findings.length > 0 && <div className="my-4 rounded-xl bg-[#f4f1ff] p-4">
        <h3 className="font-bold">Advisory findings and practice suggestions</h3>
        <ul className="mt-2 list-inside list-disc space-y-2 text-sm">
          {proposal.findings.map((finding, i) => <li key={i}>
            {finding}
          </li>)}
        </ul>
      </div>}<div className="mt-5 space-y-5">
        {proposal.changes.map((change, index) => <article key={index} className="rounded-2xl border border-[#C7A9D4]/40 p-4">
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" disabled={locked} checked={selected.includes(index)} onChange={event => { setSelected(old => event.target.checked ? [...old, index] : old.filter(i => i !== index)); setReviewed(false); }} />
            {change.recordType === "vocabulary" ? text(change.payload.phrase) : text(change.payload.title)}{!change.recordId && <span className="text-xs font-normal text-[#B64074]">New material</span>}
          </label>
          <p className="my-3 text-sm text-slate-600">
            {change.reason}
          </p>
          <details open={index === 0} className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#3558AE]">Compare and edit this suggestion</summary>
          <div className="mt-4 grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold">Original</h3>
              {change.original ? <StudioReadout value={change.original} /> : <p className="text-sm text-slate-500">No existing record will be replaced.</p>}
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold">Suggested draft</h3>
              <StudioRecordFields recordType={change.recordType} kind={change.stepType} value={change.payload} disabled={locked} onChange={payload => { setProposal(old => old ? { ...old, changes: old.changes.map((item, i) => i === index ? { ...item, payload } : item) } : null); setReviewed(false); }} />
            </div>
          </div>
          </details>
        </article>)}
      </div>
      {proposal.changes.length > 0 && <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={reviewed} disabled={locked} onChange={event => setReviewed(event.target.checked)} />I reviewed the selected suggestions, translations, and teaching accuracy.</label>
        <button className={primary} disabled={locked || !reviewed || !selected.length || !proposal.version || (needsRevision && !confirmRevision)} onClick={applyProposal}>
          <Save size={16} />Save Selected Draft Suggestions</button>
      </div>}
    </section>}
    <section className={card}>
      <div role="tablist" aria-label="Lesson content sections" className="flex flex-wrap gap-2">
        {tabs.map(([id, label], index) => <button key={id} ref={element => { tabRefs.current[index] = element; }} role="tab" id={"studio-tab-" + id} aria-controls="studio-content-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className={tab === id ? primary : secondary} onClick={() => setTab(id)} onKeyDown={event => onTabKey(event, index)}>
          {label}
        </button>)}
      </div>
      <div role="tabpanel" tabIndex={0} id="studio-content-panel" aria-labelledby={"studio-tab-" + tab} className="mt-6 space-y-5">
        {tab === "overview" && <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Vocabulary", s.vocabulary.length], ["Teaching steps", s.steps.length], ["Activities", s.activities.length], ["Knowledge Check", questionList.length ? questionList.length + " questions" : "Missing"]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f4f1ff] p-4">
              <p className="text-xs text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-lg font-bold">
                {value}
              </p>
            </div>)}
          </div>
          {s.lesson.description && <div>
            <h3 className="font-bold">Existing learning objectives</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {s.lesson.description}
            </p>
          </div>}{missing.length > 0 && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={18} className="shrink-0" />Missing: {missing.join(", ")}. Generate teaching material here; use the dedicated activity and assessment tools after saving.</p>}<p className="text-sm text-slate-600">
            {s.language.name} / {s.course.difficulty}. Source and live publication are tracked separately. Review all AI output before saving.</p>
        </>}
        {tab === "vocabulary" && <>
          {!s.vocabulary.length && <p className="rounded-xl bg-[#f4f1ff] p-5 text-sm">No saved vocabulary yet. Generate missing content above and review the proposal.</p>}<div className="grid gap-4 lg:grid-cols-2">
            {s.vocabulary.map(item => {
              const duplicate = s.vocabulary.filter(other => other.id !== item.id && normalizePhrase(other.phrase) === normalizePhrase(item.phrase)).length; const prior = s.previousVocabulary.filter(other => normalizePhrase(other.phrase) === normalizePhrase(item.phrase)); return <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    {item.vocabulary_number}. {item.phrase}
                  </h3>
                  <button aria-label={"Listen to " + item.phrase} onClick={() => listen(item.phrase, item.language_locale || s.locale)} className="rounded-lg p-2 text-[#3558AE]">
                    <Volume2 size={19} />
                  </button>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {item.romanization}
                </p>
                <p className="mt-2 font-semibold">
                  {item.meaning}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {item.usage_note}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {item.language_locale || s.locale}
                </p>
                {duplicate > 0 && <p className="mt-3 text-xs text-rose-700">Exact duplicate in this lesson. Review before approval.</p>}{prior.length > 0 && <p className="mt-3 text-xs text-amber-800">Previously taught in {Array.from(new Set(prior.map(word => s.previousLessons.find(lesson => lesson.id === word.lesson_id)?.title || "an earlier lesson"))).join(", ")}. Intentional revision is allowed; explain its purpose in the usage note.</p>}<div className="mt-4 flex flex-wrap gap-2">
                  {editButton("vocabulary", item.id, "vocabulary", { phrase: item.phrase, romanization: item.romanization, meaning: item.meaning, usage_note: item.usage_note }, item.status)}<button className={secondary} disabled={locked || item.status !== "draft"} onClick={() => generate("improve", "vocabulary:" + item.id)}>
                    <Sparkles size={15} />AI Improve</button>
                </div>
              </article>;
            })}
          </div>
        </>}
        {tab === "flow" && <>
          <p className="text-sm text-slate-600">Saved order is shown below. No records are automatically reordered or deleted. Audio-only duplicates remain available for review.</p>
          {!s.steps.length && <p className="rounded-xl bg-[#f4f1ff] p-5 text-sm">No teaching steps saved. Generate an introduction, topic vocabulary and an appropriate application above.</p>}<ol className="space-y-4">
            {s.steps.map(step => <li key={step.id}>
              {stepCard(step)}
            </li>)}
          </ol>
        </>}
        {tab === "conversation" && <>
          {s.steps.some(step => step.step_type === "dialogue") ? s.steps.filter(step => step.step_type === "dialogue").map(stepCard) : <div className="rounded-xl bg-[#f4f1ff] p-5">
            <p className="text-sm">No conversation saved. Add a dialogue when it serves this topic, or use speaking / application practice instead.</p>
            <button className={secondary + " mt-4"} disabled={locked} onClick={() => generate("missing", "", "dialogue")}>Propose a Conversation</button>
          </div>}
        </>}
        {tab === "practice" && <>
          <div className="flex flex-wrap gap-3">
            <Link className={secondary} href={lessonHref("activities", selectedLessonId)}>Open Activity Builder</Link>
            <Link className={secondary} href={lessonHref("practice-ai", selectedLessonId)}>AI Practice Generator</Link>
            <Link className={secondary} href={lessonHref("assessment-ai", selectedLessonId)}>AI Assessment Generator</Link>
          </div>
          <h3 className="font-bold">Saved activities ({s.activities.length})</h3>
          {!s.activities.length && <p className="text-sm text-slate-500">No practice activities saved yet.</p>}{s.activities.map(activity => {
            const content = activity.content; const items = Array.isArray(content.cards) ? content.cards : Array.isArray(content.pairs) ? content.pairs : Array.isArray(content.options) ? content.options : null; const issues = consistency.issues.filter(issue => issue.details.includes(activity.title) || issue.title.includes(activity.title)); return <article key={activity.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold">
                    {activity.title}
                  </h4>
                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {activity.activity_type.replace(/_/g, " ")} / {activity.status}{items ? " / " + items.length + " items" : ""}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {issues.length ? "Related consistency findings: " + issues.length : "Run Readiness for full activity validation."}
                  </p>
                </div>
                <Link className={secondary} href={lessonHref("activities", selectedLessonId)}>Edit activity</Link>
                <Link className={secondary} href={lessonHref("lesson-preview", selectedLessonId)}>Preview</Link>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">Advanced record maintenance</summary>
                <div className="mt-3">
                  {editButton("activity", activity.id, activity.activity_type, { title: activity.title, instructions: activity.instructions, content: activity.content, answer_config: activity.answer_config }, activity.status)}
                </div>
              </details>
            </article>;
          })}<div className="rounded-xl bg-[#f4f1ff] p-5">
            <h3 className="font-bold">Knowledge Check</h3>
            <p className="mt-2 text-sm">
              {questionList.length} saved questions. {s.assessment ? "Status: " + s.assessment.status : "Generate questions after saving teaching content."}
            </p>
            {questionList.some(raw => { const q = object(raw); return !text(q.prompt) || !Array.isArray(q.options) || !q.options.includes(q.correct_answer); }) && <p className="mt-2 text-sm text-amber-900">Some prompts, options, or answer relationships are incomplete.</p>}<div className="mt-4 flex flex-wrap gap-3">
              {s.assessment && editButton("assessment", s.assessment.id, "assessment", { title: s.assessment.title, questions: s.assessment.questions }, "draft")}<Link className={secondary} href={lessonHref("lesson-preview", selectedLessonId)}>Preview Knowledge Check</Link>
            </div>
          </div>
        </>}
        {tab === "review" && <>
          <div className="flex flex-wrap gap-3">
            <Link className={secondary} href={lessonHref("consistency", selectedLessonId)}>Open Consistency Checker</Link>
            <Link className={secondary} href={lessonHref("lesson-preview", selectedLessonId)}>Test Learner Preview</Link>
            <Link className={secondary} href={lessonHref("review", selectedLessonId)}>Run Readiness Check</Link>
          </div>
          <h3 className="font-bold">Consistency findings: {consistency.errors} errors, {consistency.warnings} warnings</h3>
          <p className="text-sm text-slate-500">Deterministic findings are checks, not a guarantee of linguistic correctness. AI feedback remains advisory.</p>
          {consistency.issues.map(issue => <article key={issue.id} className={"rounded-xl border p-4 " + (issue.severity === "error" ? "border-rose-200 bg-rose-50" : issue.severity === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50")}>
            <h4 className="font-semibold">
              {issue.title}
            </h4>
            <p className="mt-2 text-sm">
              {issue.details}
            </p>
            <p className="mt-2 text-xs">
              {issue.action}
            </p>
          </article>)}{!consistency.issues.length && <p className="text-sm text-slate-600">No issues found by the available consistency checks. Run readiness and manually verify language accuracy before approval.</p>}
        </>}
      </div>
    </section>
    {editing && <section ref={editorRef} className={card} aria-label="Selected record editor">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Edit {editing.type === "vocabulary" ? text(editing.payload.phrase) : text(editing.payload.title)}
        </h2>
        <button disabled={locked} className={secondary} onClick={() => {
          if (window.confirm("Discard this unsaved edit?"))
            setEditing(null);
        }}>Cancel edit</button>
      </div>
      <StudioRecordFields key={editing.id} recordType={editing.type} kind={editing.kind} value={editing.payload} disabled={locked} onChange={payload => setEditing(old => old ? { ...old, payload } : null)} />
      {editing.type === "vocabulary" && <p className="mt-4 text-xs text-slate-500">When safe saving is available, exact matching draft vocabulary, listening and speaking cards are updated together. Existing listening records are retained.</p>}<button className={primary + " mt-5"} disabled={locked || (needsRevision && !confirmRevision)} onClick={saveRecord}>
        {busy === "save" ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}Save Reviewed Draft Changes</button>
    </section>}
  </main>;
}
