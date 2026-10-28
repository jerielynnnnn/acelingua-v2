
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gamepad2,
  Layers3,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import {
  generatePracticeAction,
} from "@/lib/curriculum/ai-practice-actions";

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
  activityCount: number;
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
  "focus:border-[#3558AE] focus:ring-2 " +
  "focus:ring-[#3558AE]/15 disabled:opacity-50";

export default function AIPracticeGenerator({
  courses,
  units,
  lessons,
  initialLessonId,
}: Props) {
  const router = useRouter();

  const initialLesson = lessons.find(lesson => lesson.id === initialLessonId);
  const initialUnit = units.find(unit => unit.id === initialLesson?.unitId);
  const [courseId, setCourseId] = useState(
    initialUnit?.courseId ?? ""
  );

  const firstUnit = units
    .filter((unit) => unit.courseId === courseId)
    .sort((a, b) => a.number - b.number)[0];

  const [unitId, setUnitId] = useState(
    initialUnit?.id ?? firstUnit?.id ?? ""
  );

  const firstLesson = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort((a, b) => a.number - b.number)[0];

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


  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const availableUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort((a, b) => a.number - b.number);

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort((a, b) => a.number - b.number);

  const selectedLesson = availableLessons.find(
    (lesson) => lesson.id === lessonId
  );

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function changeCourse(id: string) {
    const nextUnit = units
      .filter((unit) => unit.courseId === id)
      .sort((a, b) => a.number - b.number)[0];

    const nextLesson = lessons
      .filter(
        (lesson) => lesson.unitId === nextUnit?.id
      )
      .sort((a, b) => a.number - b.number)[0];

    setCourseId(id);
    setUnitId(nextUnit?.id ?? "");
    setLessonId(nextLesson?.id ?? "");
    resetMessages();
  }

  function changeUnit(id: string) {
    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === id)
      .sort((a, b) => a.number - b.number)[0];

    setUnitId(id);
    setLessonId(nextLesson?.id ?? "");
    resetMessages();
  }

  async function generate() {
    if (!selectedLesson || busy) {
      return;
    }

    setBusy(true);
    resetMessages();

    try {
      const result =
        await generatePracticeAction(selectedLesson.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Created ${result.data.created_activities} new ` +
        `activity(s). Skipped ${result.data.skipped_activities} ` +
        `existing activity type(s).`
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Activity generation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      {lessonId && <AdminWorkflowNavigation slug="practice-ai" lesson={lessonId} />}
      <div className="mx-auto max-w-4xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#3558AE]">
            <Sparkles size={17} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            AI Practice Generator
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Turn approved AI-generated vocabulary into
            matching and multiple-choice exercises,
            without rewriting your existing activities.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efedff] text-[#3558AE]">
              <Layers3 size={23} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold">
                Select Learning Content
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Course → Unit → Lesson
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="practice-course"
                className="mb-2 block text-sm font-bold"
              >
                1. Select Course
              </label>

              <select
                id="practice-course"
                value={courseId}
                disabled={busy}
                onChange={(e) =>
                  changeCourse(e.target.value)
                }
                className={field}
              >
                {courses.length === 0 && (
                  <option value="">No draft courses</option>
                )}

                {courses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="practice-unit"
                className="mb-2 block text-sm font-bold"
              >
                2. Select Unit
              </label>

              <select
                id="practice-unit"
                value={unitId}
                disabled={
                  busy || availableUnits.length === 0
                }
                onChange={(e) =>
                  changeUnit(e.target.value)
                }
                className={field}
              >
                {availableUnits.length === 0 && (
                  <option value="">No units</option>
                )}

                {availableUnits.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    Unit {unit.number} — {unit.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="practice-lesson"
                className="mb-2 block text-sm font-bold"
              >
                3. Select Lesson
              </label>

              <select
                id="practice-lesson"
                value={lessonId}
                disabled={
                  busy || availableLessons.length === 0
                }
                onChange={(e) => {
                  setLessonId(e.target.value);
                  resetMessages();
                }}
                className={field}
              >
                {availableLessons.length === 0 && (
                  <option value="">No lessons</option>
                )}

                {availableLessons.map((lesson) => (
                  <option
                    key={lesson.id}
                    value={lesson.id}
                  >
                    Lesson {lesson.number} — {lesson.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedLesson && (
            <div className="mt-7 rounded-2xl border border-[#e2dcfa] bg-[#f8f6ff] p-5">
              <div className="flex items-center gap-2">
                <BookOpen
                  size={19}
                  className="text-[#3558AE]"
                />
                <h3 className="font-extrabold">
                  {selectedLesson.title}
                </h3>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-2xl font-extrabold">
                    {selectedLesson.vocabularyCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Saved vocabulary entries
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-2xl font-extrabold">
                    {selectedLesson.activityCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Existing activities
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-[#f1edff] p-4 text-sm leading-6 text-[#3558AE]">
            This generator uses vocabulary previously
            generated by Ollama and reviewed by the
            Admin. New activities remain drafts.
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !selectedLesson ||
              selectedLesson.vocabularyCount < 3
            }
            onClick={generate}
            className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2A255C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Gamepad2 size={18} />
            )}

            {busy
              ? "Creating Practice Activities..."
              : "Generate Practice Activities"}
          </button>

          {selectedLesson &&
            selectedLesson.vocabularyCount < 3 && (
              <p className="mt-3 text-sm text-amber-700">
                This lesson needs at least three saved
                vocabulary entries before practice
                generation is available.
              </p>
            )}
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
          >
            <AlertCircle size={19} />
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800"
          >
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 size={19} />
              {success}
            </div>

            <Link
              href={"/admin/curriculum/activities?lesson=" + encodeURIComponent(lessonId)}
              className="mt-3 inline-flex items-center gap-2 font-bold text-[#3558AE] underline"
            >
              View Activity Builder
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
