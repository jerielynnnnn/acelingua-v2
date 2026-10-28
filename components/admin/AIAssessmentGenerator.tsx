
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useEffect, useState } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  Save,
  Sparkles,
} from "lucide-react";

import {
  generateAssessmentAction,
  saveAssessmentAction,
  type AssessmentDraft,
} from "@/lib/curriculum/assessment-ai-actions";

type Course = {
  id: string;
  title: string;
};

type Unit = {
  id: string;
  courseId: string;
  title: string;
  number: number;
};

type Lesson = {
  id: string;
  unitId: string;
  title: string;
  number: number;
  vocabularyCount: number;
  hasAssessment: boolean;
};

type Props = {
  courses: Course[];
  units: Unit[];
  lessons: Lesson[];
  initialLessonId?: string;
};

const field =
  "w-full rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm text-[#2A255C] outline-none " +
  "focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/15";

const button =
  "inline-flex items-center gap-2 rounded-xl bg-[#3558AE] " +
  "px-6 py-3 text-sm font-bold text-white " +
  "hover:bg-[#2A255C] disabled:cursor-not-allowed " +
  "disabled:opacity-50";

export default function AIAssessmentGenerator({
  courses,
  units,
  lessons,
  initialLessonId,
}: Props) {
  const initialLesson = lessons.find(lesson => lesson.id === initialLessonId);
  const initialUnit = units.find(unit => unit.id === initialLesson?.unitId);
  const [courseId, setCourseId] = useState(
    initialUnit?.courseId ?? ""
  );

  const firstUnit = units.find(
    (unit) => unit.courseId === courseId
  );

  const [unitId, setUnitId] = useState(
    initialUnit?.id ?? firstUnit?.id ?? ""
  );

  const firstLesson = lessons.find(
    (lesson) => lesson.unitId === unitId
  );

  const [lessonId, setLessonId] = useState(
    initialLesson?.id ?? firstLesson?.id ?? ""
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (lessonId) url.searchParams.set("lesson", lessonId); else url.searchParams.delete("lesson");
    if (courseId) url.searchParams.set("course", courseId); else url.searchParams.delete("course");
    if (unitId) url.searchParams.set("unit", unitId); else url.searchParams.delete("unit");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [lessonId, courseId, unitId]);


  const [draft, setDraft] =
    useState<AssessmentDraft | null>(null);

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const availableUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort((a, b) => a.number - b.number);

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort((a, b) => a.number - b.number);

  const selected = availableLessons.find(
    (lesson) => lesson.id === lessonId
  );

  function clear() {
    setDraft(null);
    setError("");
    setSuccess("");
    setSaved(false);
  }

  function changeCourse(id: string) {
    const nextUnit = units
      .filter((unit) => unit.courseId === id)
      .sort((a, b) => a.number - b.number)[0];

    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === nextUnit?.id)
      .sort((a, b) => a.number - b.number)[0];

    setCourseId(id);
    setUnitId(nextUnit?.id ?? "");
    setLessonId(nextLesson?.id ?? "");
    clear();
  }

  function changeUnit(id: string) {
    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === id)
      .sort((a, b) => a.number - b.number)[0];

    setUnitId(id);
    setLessonId(nextLesson?.id ?? "");
    clear();
  }

  async function generate() {
    if (
      busy ||
      !selected ||
      selected.hasAssessment ||
      selected.vocabularyCount < 3
    ) {
      return;
    }

    setBusy(true);
    clear();

    try {
      const result = await generateAssessmentAction(lessonId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft(result.data);
      setSuccess(
        "Assessment draft generated. Review the questions " +
        "and answers before saving."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Assessment generation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(
    index: number,
    fieldName: "prompt" | "explanation",
    value: string
  ) {
    setDraft((old) =>
      old
        ? {
            ...old,
            questions: old.questions.map((question, i) =>
              i === index
                ? { ...question, [fieldName]: value }
                : question
            ),
          }
        : null
    );
  }

  async function approve() {
    if (!draft || busy || saved) return;

    if (
      !window.confirm(
        "Save this assessment as an Admin-only draft? " +
        "It will not be published to learners."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await saveAssessmentAction({
        lessonId,
        draft,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft(null);
      setSaved(true);
      setSuccess(
        "Assessment saved as an Admin-only draft. " +
        "It is not published or linked to learner progression yet."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Saving failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      {lessonId && <AdminWorkflowNavigation slug="assessment-ai" lesson={lessonId} />}
      <div className="mx-auto max-w-5xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#3558AE]">
            <Sparkles size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            AI Assessment Generator
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Create assessment questions using local Ollama
            and vocabulary from your saved lessons.
            Review the answers before saving the draft.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <ClipboardCheck
              size={23}
              className="text-[#3558AE]"
            />
            Select Assessment Source
          </h2>

          <p className="mt-2 text-xs text-slate-500">
            Course → Unit → Lesson
          </p>

          <div className="mt-6 space-y-5">
            <label className="block space-y-2 text-sm font-bold">
              1. Course
              <select
                value={courseId}
                disabled={busy}
                onChange={(event) =>
                  changeCourse(event.target.value)
                }
                className={field}
              >
                {courses.length === 0 && (
                  <option value="">No draft courses</option>
                )}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-bold">
              2. Unit
              <select
                value={unitId}
                disabled={busy || !availableUnits.length}
                onChange={(event) =>
                  changeUnit(event.target.value)
                }
                className={field}
              >
                {!availableUnits.length && (
                  <option value="">No units available</option>
                )}
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    Unit {unit.number} — {unit.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-bold">
              3. Lesson
              <select
                value={lessonId}
                disabled={busy || !availableLessons.length}
                onChange={(event) => {
                  setLessonId(event.target.value);
                  clear();
                }}
                className={field}
              >
                {!availableLessons.length && (
                  <option value="">No lessons available</option>
                )}
                {availableLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    Lesson {lesson.number} — {lesson.title}
                    {lesson.hasAssessment
                      ? " (Assessment saved)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected && (
            <div className="mt-6 rounded-2xl bg-[#f3f0ff] p-5">
              <h3 className="font-bold">
                Lesson {selected.number} — {selected.title}
              </h3>

              <p className="mt-2 text-sm text-[#3558AE]">
                {selected.vocabularyCount} vocabulary entries
              </p>

              <p className="mt-2 text-xs text-slate-600">
                {selected.hasAssessment || saved
                  ? "An assessment draft is already saved for this lesson."
                  : "Ready to generate an assessment draft."}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={
              busy ||
              saved ||
              !selected ||
              selected.hasAssessment ||
              selected.vocabularyCount < 3
            }
            className={`${button} mt-6`}
          >
            {busy ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Sparkles size={18} />
            )}
            {busy
              ? "Processing..."
              : "Generate Assessment Draft"}
          </button>

          {selected && selected.vocabularyCount < 3 && (
            <p className="mt-3 text-sm text-amber-700">
              Save at least three vocabulary entries with
              distinct meanings before generating an assessment.
            </p>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            {success}
          </div>
        )}

        {draft && (
          <section className="mt-8 space-y-5">
            <h2 className="text-2xl font-extrabold">
              Review Assessment Draft
            </h2>

            <article className="rounded-3xl bg-white p-6 shadow-sm">
              <label className="block space-y-2 text-sm font-bold">
                Assessment Title
                <input
                  value={draft.title}
                  maxLength={150}
                  onChange={(event) =>
                    setDraft((old) =>
                      old
                        ? { ...old, title: event.target.value }
                        : null
                    )
                  }
                  className={field}
                />
              </label>
            </article>

            {draft.questions.map((question, index) => (
              <article
                key={index}
                className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-extrabold">
                  Question {index + 1}
                </h3>

                <label className="block space-y-2 text-sm font-semibold">
                  Question Prompt
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={question.prompt}
                    onChange={(event) =>
                      updateQuestion(
                        index,
                        "prompt",
                        event.target.value
                      )
                    }
                    className={field}
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-sm font-bold">
                    Answer Choices
                  </p>

                  {question.options.map((option, i) => (
                    <div
                      key={i}
                      className={
                        "rounded-xl border p-4 text-sm " +
                        (option === question.correct_answer
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-slate-200 bg-[#fafaff]")
                      }
                    >
                      {String.fromCharCode(65 + i)}. {option}

                      {option === question.correct_answer && (
                        <span className="ml-2 text-xs font-bold">
                          Correct Answer
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <label className="block space-y-2 text-sm font-semibold">
                  AI Explanation
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={question.explanation}
                    onChange={(event) =>
                      updateQuestion(
                        index,
                        "explanation",
                        event.target.value
                      )
                    }
                    className={field}
                  />
                </label>
              </article>
            ))}

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="mb-5 text-sm leading-7 text-slate-600">
                Check the language, translations, answer keys,
                and explanations before approval. Saving stores
                an Admin-only draft, not a learner assessment.
              </p>

              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className={button}
              >
                {busy ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}
                Approve & Save Assessment Draft
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
