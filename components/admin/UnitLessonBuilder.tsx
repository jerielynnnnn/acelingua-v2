
import Link from "next/link";

import {
  BookOpen,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  Gamepad2,
  Layers3,
  LockKeyhole,
  Plus,
  ArrowRight,
} from "lucide-react";

import {
  saveLessonAction,
  saveUnitAction,
} from "@/lib/curriculum/roadmap-actions";

/* =========================================================
   TYPES
========================================================= */

export type RoadmapCourse = {
  id: string;
  title: string;
  difficulty: string;
  status: string;
  language_id: string;
};

export type RoadmapLanguage = {
  id: string;
  name: string;
  flag_emoji: string | null;
};

export type RoadmapUnit = {
  id: string;
  course_id: string;
  unit_number: number;
  title: string;
  description: string | null;
  status: string;
};

export type RoadmapLesson = {
  id: string;
  unit_id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  lesson_type: string;
  status: string;
};

type Props = {
  courses: RoadmapCourse[];
  languages: RoadmapLanguage[];
  units: RoadmapUnit[];
  lessons: RoadmapLesson[];
  selectedCourse: string | null;
  success?: string;
  error?: string;
};

/* =========================================================
   SHARED STYLES
========================================================= */

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#2A255C] outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2A255C]";

const activityButtonClass =
  "inline-flex items-center gap-2 rounded-xl bg-[#eeecff] px-4 py-2.5 text-xs font-bold text-[#3558AE] transition hover:bg-[#dcd7ff] hover:shadow-sm";

/* =========================================================
   UNIT FORM
========================================================= */

function UnitForm({
  courseId,
  unit,
  suggestedNumber,
}: {
  courseId: string;
  unit?: RoadmapUnit;
  suggestedNumber: number;
}) {
  return (
    <form
      action={saveUnitAction}
      className="mt-5 grid gap-4 sm:grid-cols-2"
    >
      <input
        type="hidden"
        name="course_id"
        value={courseId}
      />

      {unit && (
        <input
          type="hidden"
          name="id"
          value={unit.id}
        />
      )}

      <label className="space-y-2 text-sm font-semibold">
        <span className="block">Unit Number *</span>

        <input
          type="number"
          name="unit_number"
          required
          min={1}
          max={10000}
          defaultValue={
            unit?.unit_number ?? suggestedNumber
          }
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm font-semibold">
        <span className="block">Unit Title *</span>

        <input
          name="title"
          required
          maxLength={150}
          defaultValue={unit?.title ?? ""}
          placeholder="Greetings & Introductions"
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm font-semibold sm:col-span-2">
        <span className="block">Description</span>

        <textarea
          name="description"
          rows={3}
          maxLength={3000}
          defaultValue={unit?.description ?? ""}
          placeholder="Learn foundational greetings and introductions."
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className={primaryClass}
        >
          {unit
            ? "Save Unit Changes"
            : "Create Draft Unit"}
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   LESSON FORM
========================================================= */

function LessonForm({
  unit,
  courseId,
  lesson,
  suggestedNumber,
}: {
  unit: RoadmapUnit;
  courseId: string;
  lesson?: RoadmapLesson;
  suggestedNumber: number;
}) {
  return (
    <form
      action={saveLessonAction}
      className="mt-5 grid gap-4 sm:grid-cols-2"
    >
      <input
        type="hidden"
        name="unit_id"
        value={unit.id}
      />

      <input
        type="hidden"
        name="course_id"
        value={courseId}
      />

      {lesson && (
        <input
          type="hidden"
          name="id"
          value={lesson.id}
        />
      )}

      <label className="space-y-2 text-sm font-semibold">
        <span className="block">Lesson Number *</span>

        <input
          name="lesson_number"
          type="number"
          min={1}
          max={10000}
          required
          defaultValue={
            lesson?.lesson_number ?? suggestedNumber
          }
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm font-semibold">
        <span className="block">Lesson Type</span>

        <select
          name="lesson_type"
          defaultValue={
            lesson?.lesson_type ?? "standard"
          }
          className={inputClass}
        >
          <option value="standard">
            Standard Lesson
          </option>

          <option value="conversation">
            Conversation
          </option>

          <option value="review">
            Review / Checkpoint
          </option>
        </select>
      </label>

      <label className="space-y-2 text-sm font-semibold sm:col-span-2">
        <span className="block">Lesson Title *</span>

        <input
          name="title"
          required
          maxLength={150}
          defaultValue={lesson?.title ?? ""}
          placeholder="Saying Hello"
          className={inputClass}
        />
      </label>

      <label className="space-y-2 text-sm font-semibold sm:col-span-2">
        <span className="block">Description</span>

        <textarea
          name="description"
          rows={3}
          maxLength={3000}
          defaultValue={lesson?.description ?? ""}
          placeholder="Learn how to greet someone in Japanese."
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className={primaryClass}
        >
          {lesson
            ? "Save Lesson Changes"
            : "Create Draft Lesson"}
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   LESSON ACTIVITY LINK
========================================================= */

function ManageActivitiesButton({
  lessonId,
}: {
  lessonId: string;
}) {
  return (
    <Link
      href={`/admin/curriculum/activities?lesson=${encodeURIComponent(
        lessonId
      )}`}
      className={activityButtonClass}
      aria-label="Manage this lesson's interactive activities"
    >
      <Gamepad2 size={17} />

      Manage Activities

      <ArrowRight size={15} />
    </Link>
  );
}

/* =========================================================
   UNIT & LESSON BUILDER
========================================================= */

export default function UnitLessonBuilder({
  courses,
  languages,
  units,
  lessons,
  selectedCourse,
  success,
  error,
}: Props) {
  const course =
    courses.find(
      (item) => item.id === selectedCourse
    ) ?? null;

  const language = course
    ? languages.find(
        (item) =>
          item.id === course.language_id
      )
    : null;

  const currentUnits = [...units].sort(
    (a, b) =>
      a.unit_number - b.unit_number
  );

  const nextUnitNumber =
    currentUnits.reduce(
      (maximum, unit) =>
        Math.max(
          maximum,
          unit.unit_number
        ),
      0
    ) + 1;

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <header className="mt-0">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#3558AE]">
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            Unit & Lesson Roadmap Builder
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Build the ordered curriculum for each course.
            Add units, create lessons, and organize
            interactive activities for the future
            Learner Roadmap.
          </p>
        </header>

        {/* COURSE SELECTION */}

        <section className="mt-8 rounded-3xl border border-white bg-white/90 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold">
            Select a course to manage
          </h2>

          {courses.length === 0 ? (
            <div className="rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
              No courses are available.

              <Link
                href="/admin/curriculum/builder"
                className="ml-1 font-bold underline"
              >
                Create a course first.
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((item) => {
                const itemLanguage =
                  languages.find(
                    (entry) =>
                      entry.id === item.language_id
                  );

                return (
                  <Link
                    key={item.id}
                    href={`/admin/curriculum/roadmap?course=${encodeURIComponent(
                      item.id
                    )}`}
                    className={`rounded-2xl border p-4 transition ${
                      selectedCourse === item.id
                        ? "border-[#3558AE] bg-[#efedff] shadow-sm"
                        : "border-slate-200 bg-white hover:border-[#C7A9D4]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">
                        {itemLanguage?.flag_emoji || "🌐"}
                      </span>

                      <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold capitalize text-[#3558AE]">
                        {item.status}
                      </span>
                    </div>

                    <h3 className="mt-3 font-bold">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {itemLanguage?.name ?? "Language"}
                      {" · "}
                      {item.difficulty}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* MESSAGES */}

        {success && (
          <div
            role="status"
            className="mt-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700"
          >
            <CircleCheck size={19} />
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {course && (
          <>

            {/* SELECTED COURSE */}

            <section className="mt-8 rounded-3xl bg-gradient-to-r from-[#2A255C] to-[#3558AE] p-7 text-white">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl">
                  {language?.flag_emoji || "🌐"}
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                    Selected Course
                  </p>

                  <h2 className="mt-1 text-2xl font-extrabold">
                    {course.title}
                  </h2>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-white/15 px-4 py-2 capitalize">
                  {course.difficulty}
                </span>

                <span className="rounded-full bg-white/15 px-4 py-2 capitalize">
                  {course.status}
                </span>

                <span className="rounded-full bg-white/15 px-4 py-2">
                  {currentUnits.length} units
                </span>

                <span className="rounded-full bg-white/15 px-4 py-2">
                  {lessons.length} lessons
                </span>
              </div>

              {/* ACCESS ACTIVITY BUILDER */}

              <Link
                href="/admin/curriculum/activities"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#3558AE] transition hover:bg-[#f0edff]"
              >
                <Gamepad2 size={18} />

                Open Activity Builder

                <ArrowRight size={17} />
              </Link>
            </section>

            {/* CREATE UNIT */}

            <section className="mt-8 rounded-3xl border border-white bg-white/90 p-6 shadow-sm">
              <details
                className="group"
                open={currentUnits.length === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <Plus
                      size={21}
                      className="text-[#3558AE]"
                    />

                    Add New Unit
                  </span>

                  <ChevronDown className="transition group-open:rotate-180" />
                </summary>

                <UnitForm
                  courseId={course.id}
                  suggestedNumber={nextUnitNumber}
                />
              </details>
            </section>

            {/* COURSE ROADMAP */}

            <section className="mt-9 space-y-4">
              <div className="flex items-center gap-3">
                <Layers3
                  size={24}
                  className="text-[#3558AE]"
                />

                <h2 className="text-2xl font-extrabold">
                  Course Roadmap
                </h2>
              </div>

              {currentUnits.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-10 text-center">
                  <Layers3
                    size={40}
                    className="mx-auto text-[#C7A9D4]"
                  />

                  <p className="mt-4 font-bold">
                    Your course has no units yet.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Create Unit 1 to start building
                    the roadmap.
                  </p>
                </div>
              )}

              {/* UNIT LIST */}

              {currentUnits.map((unit) => {
                const unitLessons = [...lessons]
                  .filter(
                    (lesson) =>
                      lesson.unit_id === unit.id
                  )
                  .sort(
                    (a, b) =>
                      a.lesson_number -
                      b.lesson_number
                  );

                const nextLessonNumber =
                  unitLessons.reduce(
                    (maximum, lesson) =>
                      Math.max(
                        maximum,
                        lesson.lesson_number
                      ),
                    0
                  ) + 1;

                return (
                  <article
                    key={unit.id}
                    className="overflow-hidden rounded-3xl border border-white bg-white shadow-sm"
                  >
                    {/* UNIT HEADER */}

                    <div className="flex items-start gap-4 bg-[#f0edff] p-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#3558AE] font-bold text-white">
                        {unit.unit_number}
                      </div>

                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#3558AE]">
                          Unit {unit.unit_number}
                        </p>

                        <h3 className="mt-1 text-xl font-extrabold">
                          {unit.title}
                        </h3>

                        {unit.description && (
                          <p className="mt-2 text-sm text-slate-500">
                            {unit.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs font-semibold text-[#3558AE]">
                          {unitLessons.length} lesson(s)
                          {" · "}
                          {unit.status}
                        </p>
                      </div>
                    </div>

                    {/* LESSONS */}

                    <div className="space-y-3 p-6">
                      {unitLessons.length === 0 && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                          No lessons in this unit yet.
                        </p>
                      )}

                      {unitLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="rounded-xl border border-slate-100 bg-[#fcfcff] p-4 transition hover:border-[#ddd7fa]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1efff] text-[#3558AE]">
                              {lesson.lesson_type ===
                              "review" ? (
                                <ClipboardCheck
                                  size={20}
                                />
                              ) : (
                                <BookOpen size={20} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#3558AE]">
                                Lesson {lesson.lesson_number}
                              </p>

                              <h4 className="mt-1 font-bold">
                                {lesson.title}
                              </h4>

                              {lesson.description && (
                                <p className="mt-2 text-sm text-slate-500">
                                  {lesson.description}
                                </p>
                              )}

                              <p className="mt-2 text-xs capitalize text-slate-400">
                                {lesson.lesson_type}
                                {" · "}
                                {lesson.status}
                              </p>

                              {/* NEW: MANAGE ACTIVITIES */}

                              <div className="mt-4">
                                <ManageActivitiesButton
                                  lessonId={lesson.id}
                                />
                              </div>
                            </div>
                          </div>

                          {/* EDIT LESSON */}

                          <details className="group mt-4 border-t border-slate-100 pt-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#3558AE]">
                              Edit Lesson

                              <ChevronDown
                                size={16}
                                className="transition group-open:rotate-180"
                              />
                            </summary>

                            <LessonForm
                              unit={unit}
                              courseId={course.id}
                              lesson={lesson}
                              suggestedNumber={
                                lesson.lesson_number
                              }
                            />
                          </details>
                        </div>
                      ))}

                      {/* ADD LESSON */}

                      <details className="group rounded-xl border border-dashed border-[#C7A9D4] p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#3558AE]">
                          <span className="flex items-center gap-2">
                            <Plus size={16} />

                            Add Lesson to Unit{" "}
                            {unit.unit_number}
                          </span>

                          <ChevronDown
                            size={16}
                            className="transition group-open:rotate-180"
                          />
                        </summary>

                        <LessonForm
                          unit={unit}
                          courseId={course.id}
                          suggestedNumber={
                            nextLessonNumber
                          }
                        />
                      </details>

                      {/* EDIT UNIT */}

                      <details className="group border-t border-slate-100 pt-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-slate-500">
                          Edit Unit Details

                          <ChevronDown
                            size={16}
                            className="transition group-open:rotate-180"
                          />
                        </summary>

                        <UnitForm
                          unit={unit}
                          courseId={course.id}
                          suggestedNumber={
                            unit.unit_number
                          }
                        />
                      </details>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* PUBLISHING NOTE */}

            <section className="mt-8 flex items-start gap-3 rounded-2xl border border-[#dcd7fb] bg-white/85 p-5">
              <LockKeyhole
                size={22}
                className="shrink-0 text-[#3558AE]"
              />

              <div>
                <h3 className="font-bold">
                  Curriculum Publishing
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Units, lessons, and newly created
                  activities remain in draft status.

                  Open a lesson workflow to preview activities,
                  check readiness, approve content, and publish
                  a teaching snapshot.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
