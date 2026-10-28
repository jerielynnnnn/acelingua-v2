"use client";
import { useState } from "react";
import { object, text, withLearnerIntroduction } from "@/lib/curriculum/lesson-studio";
export const studioField = "mt-2 w-full rounded-xl border border-[#dedcf0] bg-white px-3 py-2.5 text-sm text-[#2A255C] focus:border-[#3558AE] focus:outline-none focus:ring-2 focus:ring-[#3558AE]/15 disabled:opacity-60";
export function readableLabel(key: string) { return key.replace(/_/g, " ").replace(/^./, first => first.toUpperCase()); }
export function StudioReadout({ value }: {
  value: unknown;
}) {
  if (value === null || value === undefined || value === "")
    return null;
  if (Array.isArray(value))
    return <ul className="list-inside list-disc space-y-1">
      {value.map((item, index) => <li key={index}>
        <StudioReadout value={item} />
      </li>)}
    </ul>;
  if (typeof value !== "object")
    return <span className="whitespace-pre-wrap break-words">
      {String(value)}
    </span>;
  return <dl className="space-y-3 text-sm">
    {Object.entries(object(value)).filter(([key]) => !["id", "lesson_id", "status", "vocabulary_number", "language_locale", "locale", "content", "created_at"].includes(key) && !(key === "text" && object(value).introduction !== undefined)).map(([key, item]) => item !== "" && item !== null && <div key={key}>
      <dt className="text-xs font-semibold capitalize text-slate-500">
        {readableLabel(key)}
      </dt>
      <dd className="mt-1">
        <StudioReadout value={item} />
      </dd>
    </div>)}{object(value).content !== undefined && <div>
      <dt className="text-xs font-semibold text-slate-500">Content</dt><dd className="mt-2"><StudioReadout value={object(value).content} /></dd>
    </div>}
  </dl>;
}
// Preserve unknown keys and the legacy combined translation instead of guessing how to split it.
export function finalizeStudioPayload(recordType: string, kind: string, payload: Record<string, unknown>) {
  if (recordType === "step" && kind === "introduction") {
    const content = object(payload.content);
    if (content.introduction !== undefined || content.objectives !== undefined || content.explanation !== undefined)
      return { ...payload, content: withLearnerIntroduction(content) };
  }
  if (recordType !== "step" || kind !== "dialogue")
    return payload;
  const content = object(payload.content);
  if (text(content.translation_a) || text(content.translation_b)) {
    if (!text(content.translation_a).trim() || !text(content.translation_b).trim())
      throw new Error("Provide both English translations, or keep the legacy combined translation without per-line translations.");
    return { ...payload, content: { ...content, translation: `${text(content.speaker_a)}: ${text(content.translation_a)}\n${text(content.speaker_b)}: ${text(content.translation_b)}` } };
  }
  return payload;
}
export default function StudioRecordFields({ recordType, kind, value, onChange, disabled = false }: {
  recordType: string;
  kind: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const [advanced, setAdvanced] = useState("");
  const [advancedError, setAdvancedError] = useState("");
  const content = recordType === "vocabulary" ? value : object(value.content);
  const patch = (key: string, next: unknown) => recordType === "vocabulary" ? onChange({ ...value, [key]: next }) : onChange({ ...value, content: { ...content, [key]: next } });
  function field(key: string, label: string, rows = 2, maxLength = 1000) {
    return <label key={key} className="block text-sm font-semibold">
      {label}<textarea rows={rows} maxLength={maxLength} disabled={disabled} className={studioField} value={text(key === "introduction" ? content.introduction ?? content.text : content[key])} onChange={event => patch(key, event.target.value)} />
    </label>;
  }
  const vocabularyFields = <div className="grid gap-4 sm:grid-cols-2">
    {field("phrase", "Target-language phrase", 2, 150)}{field("romanization", "Romanization", 2, 200)}{field("meaning", "English meaning", 2, 200)}{recordType === "vocabulary" && field("usage_note", "Usage / intentional revision reason", 3, 500)}
  </div>;
  return <div className="space-y-4">
    {recordType !== "vocabulary" && <label className="block text-sm font-semibold">Title<input disabled={disabled} className={studioField} value={text(value.title)} maxLength={150} onChange={event => onChange({ ...value, title: event.target.value })} />
    </label>}
    {(recordType === "vocabulary" || ["vocabulary", "speaking", "listening"].includes(kind)) && vocabularyFields}
    {["introduction", "summary"].includes(kind) && <>
      {field(kind === "summary" ? "text" : "introduction", kind === "summary" ? "Lesson summary" : "Introduction", 4)}
      {kind === "introduction" && <>
        <label className="block text-sm font-semibold">Learning objectives (one per line)<textarea disabled={disabled} rows={4} className={studioField} value={Array.isArray(content.objectives) ? content.objectives.join("\n") : ""} onChange={event => patch("objectives", event.target.value.split("\n"))} />
        </label>
        {field("explanation", "Teaching explanation and practical examples", 6, 1500)}
      </>}
    </>}
    {kind === "dialogue" && <>
      {field("context", "Conversation context", 2, 500)}
      <div className="grid gap-5 md:grid-cols-2">
        {["a", "b"].map(speaker => <fieldset key={speaker} className="space-y-3 rounded-2xl bg-[#f4f1ff] p-4">
          <legend className="px-1 text-sm font-bold">Speaker {speaker.toUpperCase()}
          </legend>
          {field(`speaker_${speaker}`, "Speaker name", 1, 50)}{field(`line_${speaker}`, "Target-language line", 3, 300)}{field(`translation_${speaker}`, "English translation", 3, 300)}
        </fieldset>)}
      </div>
      {!text(content.translation_a) && !text(content.translation_b) && field("translation", "Existing combined English translation (legacy)", 4, 600)}
      <p className="text-xs text-slate-500">Per-line English translations produce the combined translation required by existing previews and review checks. Existing legacy text is retained until you explicitly replace it.</p>
      {field("notes", "Usage notes", 2, 500)}
    </>}
    {kind === "word_order" && <>
      {field("prompt", "Sentence-building instruction", 2, 250)}{field("sentence", "Correct sentence (space-separated words)", 3, 150)}
    </>}
    {recordType === "assessment" && <div className="space-y-5">
      {(Array.isArray(value.questions) ? value.questions : []).map((raw, index) => {
        const question = object(raw);
        const update = (key: string, next: unknown) => onChange({ ...value, questions: (value.questions as unknown[]).map((item, i) => i === index ? { ...object(item), [key]: next } : item) });
        return <fieldset key={index} className="space-y-3 rounded-xl bg-[#f4f1ff] p-4">
          <legend className="font-bold">Question {index + 1}
          </legend>
          {["prompt", "explanation"].map(key => <label key={key} className="block text-sm font-semibold">
            {readableLabel(key)}<textarea className={studioField} disabled={disabled} value={text(question[key])} onChange={event => update(key, event.target.value)} />
          </label>)}<label className="block text-sm font-semibold">Options (one per line)<textarea className={studioField} disabled={disabled} value={Array.isArray(question.options) ? question.options.join("\n") : ""} onChange={event => update("options", event.target.value.split("\n"))} />
          </label>
          <label className="block text-sm font-semibold">Correct answer (Admin only)<select className={studioField} disabled={disabled} value={text(question.correct_answer)} onChange={event => update("correct_answer", event.target.value)}>
            <option value="">Select an exact option</option>
            {(Array.isArray(question.options) ? question.options : []).map((option, i) => <option key={i} value={text(option)}>
              {text(option)}
            </option>)}
          </select>
          </label>
        </fieldset>;
      })}
    </div>}
    {recordType === "activity" && <p className="text-sm text-slate-600">Use Activity Builder for the visual editor. Advanced maintenance below preserves existing content and answer configurations.</p>}
    {recordType === "step" && !["introduction", "summary", "vocabulary", "speaking", "listening", "dialogue", "word_order"].includes(kind) && <p className="text-sm text-slate-600">This content type uses Advanced maintenance. Its existing fields are preserved.</p>}
    {recordType !== "vocabulary" && recordType !== "assessment" && <details onToggle={event => {
      if (event.currentTarget.open) {
        setAdvanced(JSON.stringify(recordType === "activity" ? value : value.content, null, 2));
        setAdvancedError("");
      }
    }} className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-500">Advanced JSON maintenance</summary>
      <p className="mt-2 text-xs text-slate-500">Apply JSON to the form first, then review and save. Unknown keys are retained.</p>
      <textarea aria-label="Advanced content JSON" disabled={disabled} rows={12} className={`${studioField} font-mono text-xs`} value={advanced} onChange={event => setAdvanced(event.target.value)} />
      <button type="button" disabled={disabled} className="mt-3 text-sm font-bold text-[#3558AE] underline" onClick={() => {
        try {
          const parsed: unknown = JSON.parse(advanced);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error("An object is required.");
          onChange(recordType === "activity" ? object(parsed) : { ...value, content: object(parsed) });
          setAdvancedError("");
        }
        catch {
          setAdvancedError("Invalid JSON object. Nothing was applied.");
        }
      }}>Apply JSON to form</button>
      {advancedError && <p role="alert" className="mt-2 text-sm text-rose-700">
        {advancedError}
      </p>}
    </details>}
  </div>;
}
