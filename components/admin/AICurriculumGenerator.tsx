
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import {
  generateCurriculumAction,
  saveGeneratedCurriculumAction,
} from "@/lib/curriculum/ai-actions";

import type {
  GeneratedLesson,
  GeneratedOutline,
} from "@/lib/curriculum/ai-outline";

type Course = {
  id: string;
  title: string;
  difficulty: string;
  status: string;
  languageName: string;
  flagEmoji: string;
};

type Unit = {
  id: string;
  courseId: string;
  title: string;
  unitNumber: number;
};

type Props = {
  courses: Course[];
  units: Unit[];
};

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm text-[#2A255C] outline-none " +
  "transition focus:border-[#3558AE] " +
  "focus:ring-2 focus:ring-[#3558AE]/15 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50";

const primaryButton =
  "inline-flex cursor-pointer items-center justify-center " +
  "gap-2 rounded-xl bg-[#3558AE] px-6 py-3 " +
  "text-sm font-bold text-white transition " +
  "hover:bg-[#2A255C] active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const defaultGoals =
  "Generate the next beginner-friendly unit with " +
  "practical vocabulary, clear learning objectives, " +
  "guided conversation practice, and a final review. " +
  "Avoid repeating topics from existing units.";

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function AICurriculumGenerator({
  courses,
  units,
}: Props) {
  const router = useRouter();

  const draftCourses = courses.filter(
    (course) => course.status === "draft"
  );

  const [courseId, setCourseId] = useState(
    draftCourses[0]?.id ?? ""
  );

  const [goals, setGoals] = useState(defaultGoals);

  const [outline, setOutline] =
    useState<GeneratedOutline | null>(null);

  const [previewCourseId, setPreviewCourseId] =
    useState("");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const busy = generating || saving;

  const selectedCourse = draftCourses.find(
    (course) => course.id === courseId
  );

  const existingUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort(
      (a, b) =>
        a.unitNumber - b.unitNumber ||
        a.title.localeCompare(b.title)
    );

  const nextUnitNumber =
    existingUnits.reduce(
      (highest, unit) =>
        Math.max(highest, unit.unitNumber),
      0
    ) + 1;

  const canGenerate =
    Boolean(selectedCourse) && !busy;

  const canSave =
    Boolean(outline) &&
    previewCourseId === courseId &&
    !busy;

  function clearDraft() {
    setOutline(null);
    setPreviewCourseId("");
    setNotice(null);
  }

  function updateUnit(
    field: "title" | "description",
    value: string
  ) {
    setOutline((previous) => {
      if (!previous) return null;

      return {
        units: previous.units.map((unit, index) =>
          index === 0
            ? { ...unit, [field]: value }
            : unit
        ),
      };
    });
  }

  function updateLesson(
    lessonIndex: number,
    field: keyof GeneratedLesson,
    value: string
  ) {
    setOutline((previous) => {
      if (!previous) return null;

      return {
        units: previous.units.map((unit, unitIndex) => {
          if (unitIndex !== 0) return unit;

          return {
            ...unit,
            lessons: unit.lessons.map((lesson, index) =>
              index === lessonIndex
                ? { ...lesson, [field]: value }
                : lesson
            ),
          };
        }),
      };
    });
  }

  async function generate() {
    if (busy) return;

    setNotice(null);

    if (!selectedCourse) {
      setNotice({
        type: "error",
        message: "Select a valid draft course.",
      });
      return;
    }

    if (goals.trim().length < 10) {
      setNotice({
        type: "error",
        message:
          "Enter at least 10 characters of learning goals.",
      });
      return;
    }

    setGenerating(true);
    setOutline(null);
    setPreviewCourseId("");

    try {
      const result = await generateCurriculumAction({
        courseId,
        goals: goals.trim(),
      });

      if (!result.ok) {
        setNotice({
          type: "error",
          message: result.error,
        });
        return;
      }

      setOutline(result.data);
      setPreviewCourseId(courseId);

      setNotice({
        type: "success",
        message:
          "Ollama generated your next unit. Review the " +
          "draft before saving.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: messageFrom(error),
      });
    } finally {
      setGenerating(false);
    }
  }

  async function approve() {
    if (!outline || !canSave) return;

    const confirmed = window.confirm(
      `Approve this proposed curriculum?\n\n` +
      `It will be added after the existing units ` +
      `in ${selectedCourse?.title ?? "this course"}.\n\n` +
      `Nothing already saved will be overwritten.`
    );

    if (!confirmed) return;

    setSaving(true);
    setNotice(null);

    try {
      const result =
        await saveGeneratedCurriculumAction({
          courseId,
          outline,
        });

      if (!result.ok) {
        setNotice({
          type: "error",
          message: result.error,
        });
        return;
      }

      setOutline(null);
      setPreviewCourseId("");

      setNotice({
        type: "success",
        message:
          `Created ${result.data.created_units} unit(s) ` +
          `and ${result.data.created_lessons} lesson(s). ` +
          `Skipped ${result.data.skipped_units} existing ` +
          `unit(s) and ${result.data.skipped_lessons} ` +
          `existing lesson(s).`,
      });

      // Refresh Server Component props so the next unit
      // number reflects the latest Supabase records.
      router.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message: messageFrom(error),
      });
    } finally {
      setSaving(false);
    }
  }

  const proposedUnit = outline?.units[0];

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C] ">
      <div className="mx-auto max-w-5xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3558AE]">
            <Cpu size={19} />
            ACELINGUA V2 · LOCAL AI
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            AI Curriculum Generator
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Let Ollama generate the next logical unit for
            your language course. ACELINGUA automatically
            manages the curriculum sequence.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">
              Generation Settings
            </h2>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#edf6ff] px-4 py-2 text-xs font-bold text-[#3558AE]">
              <Cpu size={15} />
              Local Ollama
            </span>
          </div>

          {draftCourses.length === 0 ? (
            <div className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
              No draft courses are available.
              <Link
                href="/admin/curriculum/builder"
                className="ml-2 font-bold underline"
              >
                Open Course Builder
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div>
                <label
                  htmlFor="ai-course"
                  className="mb-2 block text-sm font-bold"
                >
                  Select Course
                </label>

                <select
                  id="ai-course"
                  value={courseId}
                  disabled={busy}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    clearDraft();
                  }}
                  className={inputClass}
                >
                  {draftCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.flagEmoji} {course.languageName}
                      {" — "}
                      {course.title}
                      {" ("}
                      {course.difficulty}
                      {")"}
                    </option>
                  ))}
                </select>
              </div>

              {/* EXISTING ROADMAP */}

              <div className="rounded-2xl border border-[#e4def9] bg-[#faf9ff] p-5">
                <div className="flex items-center gap-2">
                  <Layers3
                    size={20}
                    className="text-[#3558AE]"
                  />

                  <h3 className="font-extrabold">
                    Existing Course Roadmap
                  </h3>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  These units already exist in Supabase.
                  They will not be replaced.
                </p>

                <div className="mt-4 space-y-2">
                  {existingUnits.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No units yet. AI will generate Unit 1.
                    </p>
                  ) : (
                    existingUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
                      >
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-[#3558AE]"
                        />

                        <span className="text-sm font-semibold">
                          Unit {unit.unitNumber} — {unit.title}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#eeecff] p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#3558AE]">
                    <Sparkles size={23} />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
                      Next Automatically Assigned Unit
                    </p>

                    <h4 className="mt-1 text-xl font-extrabold">
                      Unit {nextUnitNumber}
                    </h4>

                    <p className="mt-1 text-xs text-slate-500">
                      Ollama will propose its title,
                      objectives and lessons.
                    </p>
                  </div>
                </div>
              </div>

              {/* LEARNING OBJECTIVES */}

              <div>
                <label
                  htmlFor="ai-goals"
                  className="mb-2 block text-sm font-bold"
                >
                  Learning Goals for the Next Unit
                </label>

                <textarea
                  id="ai-goals"
                  rows={5}
                  maxLength={1200}
                  value={goals}
                  disabled={busy}
                  onChange={(event) => {
                    setGoals(event.target.value);
                    clearDraft();
                  }}
                  className={`${inputClass} resize-y`}
                  placeholder="Describe the next topic and skills learners should learn..."
                />

                <p className="mt-2 text-xs text-slate-500">
                  {goals.length}/1200 characters
                </p>
              </div>

              <div className="rounded-xl bg-[#f3f0ff] p-4 text-sm leading-6 text-[#3558AE]">
                ACELINGUA automatically generates one
                new unit based on your existing course.
                Nothing is saved until you approve.
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={!canGenerate}
                aria-busy={generating}
                className={primaryButton}
              >
                {generating ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Generating with Ollama...
                  </>
                ) : (
                  <>
                    <WandSparkles size={18} />
                    Generate Next Unit
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* RESULT MESSAGES */}

        {notice && (
          <section
            role={notice.type === "error" ? "alert" : "status"}
            className={
              "mt-6 rounded-2xl border p-5 " +
              (notice.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800")
            }
          >
            <div className="flex items-start gap-3">
              {notice.type === "error" ? (
                <AlertCircle size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}

              <div className="flex-1">
                <p className="text-sm font-bold">
                  {notice.message}
                </p>

                {notice.type === "success" &&
                  !outline && (
                    <Link
                      href={"/admin/curriculum/roadmap?course=" + encodeURIComponent(courseId)}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] underline"
                    >
                      <BookOpen size={17} />
                      View Course Roadmap
                      <ArrowRight size={16} />
                    </Link>
                  )}
              </div>
            </div>
          </section>
        )}

        {/* GENERATED DRAFT */}

        {proposedUnit && previewCourseId === courseId && (
          <section className="mt-9 space-y-5">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold text-[#3558AE]">
                <Sparkles size={17} />
                AI-GENERATED CURRICULUM
              </p>

              <h2 className="mt-2 text-2xl font-extrabold">
                Review Proposed Unit {nextUnitNumber}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Review the suggested content before
                adding it to the course.
              </p>
            </div>

            <article className="rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
              <div>
                <label
                  htmlFor="generated-unit-title"
                  className="mb-2 block text-sm font-bold"
                >
                  Unit Title
                </label>

                <input
                  id="generated-unit-title"
                  value={proposedUnit.title}
                  disabled={busy}
                  maxLength={150}
                  onChange={(event) =>
                    updateUnit("title", event.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="generated-unit-description"
                  className="mb-2 block text-sm font-bold"
                >
                  Unit Description
                </label>

                <textarea
                  id="generated-unit-description"
                  rows={3}
                  maxLength={3000}
                  value={proposedUnit.description}
                  disabled={busy}
                  onChange={(event) =>
                    updateUnit(
                      "description",
                      event.target.value
                    )
                  }
                  className={`${inputClass} resize-y`}
                />
              </div>

              <h3 className="mt-7 text-lg font-extrabold">
                Proposed Lessons ({proposedUnit.lessons.length})
              </h3>

              <div className="mt-4 space-y-4">
                {proposedUnit.lessons.map(
                  (lesson, lessonIndex) => (
                    <div
                      key={lessonIndex}
                      className="rounded-2xl border border-slate-100 bg-[#fafaff] p-5"
                    >
                      <p className="mb-4 text-sm font-bold text-[#3558AE]">
                        Lesson {lessonIndex + 1}
                      </p>

                      <label className="block space-y-2 text-xs font-bold">
                        Lesson Title
                        <input
                          value={lesson.title}
                          disabled={busy}
                          maxLength={150}
                          onChange={(event) =>
                            updateLesson(
                              lessonIndex,
                              "title",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </label>

                      <label className="mt-4 block space-y-2 text-xs font-bold">
                        Learning Objective
                        <textarea
                          value={lesson.description}
                          disabled={busy}
                          rows={3}
                          maxLength={3000}
                          onChange={(event) =>
                            updateLesson(
                              lessonIndex,
                              "description",
                              event.target.value
                            )
                          }
                          className={`${inputClass} resize-y`}
                        />
                      </label>

                      <label className="mt-4 block space-y-2 text-xs font-bold">
                        Lesson Type
                        <select
                          value={lesson.lesson_type}
                          disabled={busy}
                          onChange={(event) =>
                            updateLesson(
                              lessonIndex,
                              "lesson_type",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        >
                          <option value="standard">
                            Standard
                          </option>
                          <option value="conversation">
                            Conversation
                          </option>
                          <option value="review">
                            Review
                          </option>
                        </select>
                      </label>
                    </div>
                  )
                )}
              </div>
            </article>

            {/* APPROVAL */}

            <div className="rounded-3xl border border-[#e0dbf8] bg-white/95 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={23}
                  className="shrink-0 text-[#3558AE]"
                />

                <div>
                  <h3 className="font-extrabold">
                    Admin Approval
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Approving will add the new unit and
                    its lessons as drafts. Existing units
                    and lessons will not be overwritten.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={approve}
                  className={primaryButton}
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Approve & Save Unit
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={clearDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f7f5ff] disabled:opacity-50"
                >
                  <RefreshCw size={17} />
                  Discard Preview
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-10 border-t border-[#ded9f5] pt-5 text-center text-xs text-slate-500">
          ACELINGUA Curriculum Studio
        </footer>
      </div>
    </main>
  );
}
