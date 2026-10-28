
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers3,
  LoaderCircle,
  Save,
  Sparkles,
  WandSparkles,
  AlertCircle,
  GraduationCap,
} from "lucide-react";

import {
  generateLessonContentAction,
  saveLessonContentAction,
} from "@/lib/curriculum/lesson-ai-actions";

import type {
  LessonPackage,
  VocabularyItem,
} from "@/lib/curriculum/lesson-ai";

type CourseOption = {
  id: string;
  title: string;
};

type UnitOption = {
  id: string;
  courseId: string;
  unitNumber: number;
  title: string;
};

type LessonOption = {
  id: string;
  unitId: string;
  lessonNumber: number;
  title: string;
  hasSteps: boolean;
};

type Props = {
  courses: CourseOption[];
  units: UnitOption[];
  lessons: LessonOption[];
  initialLessonId?: string;
};

const field =
  "w-full rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm text-[#2A255C] outline-none transition " +
  "focus:border-[#3558AE] focus:ring-2 " +
  "focus:ring-[#3558AE]/15 disabled:bg-slate-100";

const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-[#3558AE] px-6 py-3 text-sm font-bold text-white " +
  "transition hover:bg-[#2A255C] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function AILessonStudio({
  courses,
  units,
  lessons,
  initialLessonId,
}: Props) {
  // Resolve the initial URL lesson to its course and unit.
  const initialLesson =
    lessons.find(
      (lesson) => lesson.id === initialLessonId
    ) ?? lessons[0];

  const initialUnit = units.find(
    (unit) => unit.id === initialLesson?.unitId
  );

  const initialCourseId =
    initialUnit?.courseId ?? courses[0]?.id ?? "";

  const [courseId, setCourseId] =
    useState(initialCourseId);

  const availableUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort((a, b) => a.unitNumber - b.unitNumber);

  const [unitId, setUnitId] = useState(
    initialUnit?.id ?? availableUnits[0]?.id ?? ""
  );

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort((a, b) => a.lessonNumber - b.lessonNumber);

  const [lessonId, setLessonId] = useState(
    initialLesson?.id ?? availableLessons[0]?.id ?? ""
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (lessonId) url.searchParams.set("lesson", lessonId); else url.searchParams.delete("lesson");
    if (courseId) url.searchParams.set("course", courseId); else url.searchParams.delete("course");
    if (unitId) url.searchParams.set("unit", unitId); else url.searchParams.delete("unit");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [lessonId, courseId, unitId]);


  const [instructions, setInstructions] = useState(
    "Create a friendly beginner-level teaching experience " +
    "with useful vocabulary, natural expressions, " +
    "clear explanations, and interactive practice."
  );

  const [draft, setDraft] =
    useState<LessonPackage | null>(null);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCourse = courses.find(
    (course) => course.id === courseId
  );

  const selectedUnit = availableUnits.find(
    (unit) => unit.id === unitId
  );

  const selectedLesson = availableLessons.find(
    (lesson) => lesson.id === lessonId
  );

  const busy = generating || saving;

  const canGenerate =
    Boolean(selectedLesson) &&
    !selectedLesson?.hasSteps &&
    !busy;

  const previewUrl =
    "/admin/curriculum/lesson-preview?lesson=" +
    encodeURIComponent(lessonId);

  function clearDraft() {
    setDraft(null);
    setError("");
    setSuccess("");
  }

  // Cascade: course changes -> reset unit and lesson.
  function changeCourse(newCourseId: string) {
    const firstUnit = units
      .filter((unit) => unit.courseId === newCourseId)
      .sort((a, b) => a.unitNumber - b.unitNumber)[0];

    const firstLesson = lessons
      .filter(
        (lesson) => lesson.unitId === firstUnit?.id
      )
      .sort((a, b) => a.lessonNumber - b.lessonNumber)[0];

    setCourseId(newCourseId);
    setUnitId(firstUnit?.id ?? "");
    setLessonId(firstLesson?.id ?? "");
    clearDraft();
  }

  // Cascade: unit changes -> reset lesson.
  function changeUnit(newUnitId: string) {
    const firstLesson = lessons
      .filter((lesson) => lesson.unitId === newUnitId)
      .sort((a, b) => a.lessonNumber - b.lessonNumber)[0];

    setUnitId(newUnitId);
    setLessonId(firstLesson?.id ?? "");
    clearDraft();
  }

  function changeLesson(newLessonId: string) {
    setLessonId(newLessonId);
    clearDraft();
  }

  function patch(
    name: "introduction" | "summary",
    value: string
  ) {
    setDraft((old) =>
      old ? { ...old, [name]: value } : null
    );
  }

  function patchVocabulary(
    index: number,
    name: keyof VocabularyItem,
    value: string
  ) {
    setDraft((old) => {
      if (!old) return null;

      return {
        ...old,
        vocabulary: old.vocabulary.map((item, i) =>
          i === index ? { ...item, [name]: value } : item
        ),
      };
    });
  }

  function patchDialogue(
    name: keyof LessonPackage["dialogue"],
    value: string
  ) {
    setDraft((old) =>
      old
        ? {
            ...old,
            dialogue: {
              ...old.dialogue,
              [name]: value,
            },
          }
        : null
    );
  }

  function patchPractice(
    name: keyof LessonPackage["practice"],
    value: string
  ) {
    setDraft((old) =>
      old
        ? {
            ...old,
            practice: {
              ...old.practice,
              [name]: value,
            },
          }
        : null
    );
  }

  async function generate() {
    if (!canGenerate || !lessonId) return;

    clearDraft();
    setGenerating(true);

    try {
      const result = await generateLessonContentAction({
        lessonId,
        instructions,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft(result.data);
      setSuccess(
        "AI lesson generated. Review the teaching content before approval."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate lesson content."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function approve() {
    if (!draft || busy || !lessonId) return;

    if (
      !window.confirm(
        "Approve and save this AI-generated lesson " +
        "as a draft? Existing activities will remain unchanged."
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await saveLessonContentAction({
        lessonId,
        lessonPackage: draft,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft(null);

      setSuccess(
        `Saved ${result.data.created_vocabulary} vocabulary ` +
        `entries and ${result.data.created_steps} learning steps.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save lesson content."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C] ">
      {lessonId && <AdminWorkflowNavigation slug="lesson-ai" lesson={lessonId} />}
      <div className="mx-auto max-w-5xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3558AE]">
            <Sparkles size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            AI Lesson Content Generator
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Select a course, unit, and lesson.
            Let Ollama create vocabulary, listening,
            speaking, dialogues, and practice exercises.
            Review everything before saving.
          </p>
        </header>

        {/* SELECTION CARD */}

        <section className="mt-9 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#efedff] text-[#3558AE]">
              <BookOpen size={22} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold">
                Select Lesson
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Course → Unit → Lesson
              </p>
            </div>
          </div>

          {/* COURSE */}

          <div className="mt-7">
            <label
              htmlFor="ai-course"
              className="mb-2 block text-sm font-bold"
            >
              1. Select Course
            </label>

            <div className="relative">
              <select
                id="ai-course"
                value={courseId}
                disabled={busy || courses.length === 0}
                onChange={(event) =>
                  changeCourse(event.target.value)
                }
                className={field}
              >
                {courses.length === 0 ? (
                  <option value="">
                    No draft courses available
                  </option>
                ) : (
                  courses.map((course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* UNIT */}

          <div className="mt-5">
            <label
              htmlFor="ai-unit"
              className="mb-2 block text-sm font-bold"
            >
              2. Select Unit
            </label>

            <select
              id="ai-unit"
              value={unitId}
              disabled={busy || availableUnits.length === 0}
              onChange={(event) =>
                changeUnit(event.target.value)
              }
              className={field}
            >
              {availableUnits.length === 0 ? (
                <option value="">
                  No units available
                </option>
              ) : (
                availableUnits.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    Unit {unit.unitNumber} — {unit.title}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* LESSON */}

          <div className="mt-5">
            <label
              htmlFor="ai-lesson"
              className="mb-2 block text-sm font-bold"
            >
              3. Select Lesson
            </label>

            <select
              id="ai-lesson"
              value={lessonId}
              disabled={busy || availableLessons.length === 0}
              onChange={(event) =>
                changeLesson(event.target.value)
              }
              className={field}
            >
              {availableLessons.length === 0 ? (
                <option value="">
                  No lessons available
                </option>
              ) : (
                availableLessons.map((lesson) => (
                  <option
                    key={lesson.id}
                    value={lesson.id}
                  >
                    Lesson {lesson.lessonNumber} — {lesson.title}
                    {lesson.hasSteps ? " (Content Saved)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* SELECTED CONTENT */}

          {selectedLesson && (
            <div className="mt-6 rounded-2xl border border-[#ded9f8] bg-[#f7f5ff] p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#3558AE]">
                <GraduationCap size={17} />
                Selected Learning Content
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {selectedCourse?.title}
                {" / "}
                Unit {selectedUnit?.unitNumber}
              </p>

              <h3 className="mt-1 text-lg font-extrabold">
                Lesson {selectedLesson.lessonNumber}
                {" — "}
                {selectedLesson.title}
              </h3>

              <div className="mt-4 flex items-center gap-2 text-xs font-bold">
                {selectedLesson.hasSteps ? (
                  <>
                    <CheckCircle2
                      size={17}
                      className="text-green-600"
                    />
                    <span className="text-green-700">
                      Lesson content saved
                    </span>
                  </>
                ) : (
                  <>
                    <Layers3
                      size={17}
                      className="text-[#3558AE]"
                    />
                    <span className="text-[#3558AE]">
                      Ready for AI generation
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ADDITIONAL INSTRUCTIONS */}

          <div className="mt-7">
            <label
              htmlFor="ai-instructions"
              className="mb-2 block text-sm font-bold"
            >
              Additional AI Instructions
            </label>

            <textarea
              id="ai-instructions"
              rows={4}
              maxLength={1000}
              value={instructions}
              disabled={busy}
              onChange={(event) => {
                setInstructions(event.target.value);
                clearDraft();
              }}
              className={`${field} resize-y`}
              placeholder="Describe the lesson teaching style..."
            />
          </div>

          {/* ACTIONS */}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className={buttonStyle}
            >
              {generating ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <WandSparkles size={18} />
              )}

              {generating
                ? "Generating with Ollama..."
                : "Generate Lesson Content"}
            </button>

            {selectedLesson?.hasSteps && (
              <Link
                href={previewUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8d1fa] bg-white px-5 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f7f5ff]"
              >
                <BookOpen size={18} />
                Open Learner Preview
                <ArrowRight size={17} />
              </Link>
            )}
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
          >
            <AlertCircle size={20} className="shrink-0" />
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800"
          >
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 size={19} />
              {success}
            </div>

            {!draft && (
              <Link
                href={previewUrl}
                className="mt-3 inline-flex items-center gap-2 font-bold text-[#3558AE] underline"
              >
                Open Learner Preview
                <ArrowRight size={17} />
              </Link>
            )}
          </div>
        )}

        {/* REVIEW */}

        {draft && (
          <section className="mt-9 space-y-5">
            <h2 className="text-2xl font-extrabold">
              Review Generated Lesson
            </h2>

            {/* INTRODUCTION */}

            <article className="space-y-4 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <h3 className="text-lg font-bold">
                Introduction & Summary
              </h3>

              {(
                ["introduction", "summary"] as const
              ).map((name) => (
                <label
                  key={name}
                  className="block space-y-2 text-sm font-semibold capitalize"
                >
                  {name}
                  <textarea
                    rows={4}
                    value={draft[name]}
                    onChange={(event) =>
                      patch(name, event.target.value)
                    }
                    className={`${field} resize-y`}
                  />
                </label>
              ))}
            </article>

            {/* VOCABULARY */}

            <article className="space-y-4 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <h3 className="text-lg font-bold">
                Vocabulary ({draft.vocabulary.length})
              </h3>

              {draft.vocabulary.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl bg-[#faf8ff] p-4 md:grid-cols-2"
                >
                  {(
                    [
                      "phrase",
                      "romanization",
                      "meaning",
                      "usage_note",
                    ] as const
                  ).map((name) => (
                    <label
                      key={name}
                      className="block space-y-2 text-xs font-bold capitalize"
                    >
                      {name.replace("_", " ")}
                      <input
                        value={item[name]}
                        onChange={(event) =>
                          patchVocabulary(
                            index,
                            name,
                            event.target.value
                          )
                        }
                        className={field}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </article>

            {/* DIALOGUE */}

            <article className="space-y-4 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <h3 className="text-lg font-bold">
                Conversation Practice
              </h3>

              {(
                [
                  "speaker_a",
                  "line_a",
                  "speaker_b",
                  "line_b",
                  "translation",
                ] as const
              ).map((name) => (
                <label
                  key={name}
                  className="block space-y-2 text-sm font-semibold capitalize"
                >
                  {name.replace("_", " ")}
                  <input
                    value={draft.dialogue[name]}
                    onChange={(event) =>
                      patchDialogue(
                        name,
                        event.target.value
                      )
                    }
                    className={field}
                  />
                </label>
              ))}
            </article>

            {/* PRACTICE */}

            <article className="space-y-4 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <h3 className="text-lg font-bold">
                Sentence Building Practice
              </h3>

              {(
                ["prompt", "sentence"] as const
              ).map((name) => (
                <label
                  key={name}
                  className="block space-y-2 text-sm font-semibold capitalize"
                >
                  {name}
                  <input
                    value={draft.practice[name]}
                    onChange={(event) =>
                      patchPractice(
                        name,
                        event.target.value
                      )
                    }
                    className={field}
                  />
                </label>
              ))}
            </article>

            {/* APPROVAL */}

            <div className="rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <p className="mb-5 text-sm text-slate-600">
                Review all generated content before approval.
                Only approved draft lesson content is saved
                to Supabase.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={approve}
                className={buttonStyle}
              >
                {saving ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}

                {saving
                  ? "Saving Lesson..."
                  : "Approve & Save Lesson Draft"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
