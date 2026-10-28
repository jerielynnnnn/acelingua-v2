
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Gamepad2,
  Layers3,
  Plus,
  Save,
  AlertTriangle,
} from "lucide-react";

import { saveActivityAction } from "@/lib/curriculum/activity-actions";

export type CourseOption = {
  id: string;
  title: string;
  status: string;
  languageName: string;
  flagEmoji: string;
};

export type UnitOption = {
  id: string;
  courseId: string;
  number: number;
  title: string;
};

export type LessonOption = {
  id: string;
  unitId: string;
  number: number;
  title: string;
};

type ActivityType =
  | "flip_cards"
  | "matching"
  | "multiple_choice"
  | "word_order";

export type ActivityRow = {
  id: string;
  lesson_id: string;
  activity_number: number;
  title: string;
  instructions: string | null;
  activity_type: string;
  content: Record<string, unknown>;
  answer_config: Record<string, unknown>;
  status: string;
};

type Props = {
  courses: CourseOption[];
  units: UnitOption[];
  lessons: LessonOption[];
  courseId: string | null;
  unitId: string | null;
  lessonId: string | null;
  activities: ActivityRow[];
  success?: string;
  error?: string;
};

const activityTypes: {
  id: ActivityType;
  label: string;
  description: string;
}[] = [
  {
    id: "flip_cards",
    label: "Flip Cards",
    description: "Create Japanese-to-English vocabulary cards.",
  },
  {
    id: "matching",
    label: "Matching Words",
    description: "Pair words with their correct meanings.",
  },
  {
    id: "multiple_choice",
    label: "Multiple Choice",
    description: "Create a question with answer choices.",
  },
  {
    id: "word_order",
    label: "Word Jumble",
    description: "Arrange word tiles into a sentence.",
  },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#2A255C] outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/15";

const labelClass =
  "block space-y-2 text-sm font-semibold text-[#2A255C]";

function getList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string"
  );
}

function getPairs(
  value: unknown,
  leftKey: "left" | "front",
  rightKey: "right" | "back"
): string {
  if (!Array.isArray(value)) return "";

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .filter(
      (item) =>
        typeof item[leftKey] === "string" &&
        typeof item[rightKey] === "string"
    )
    .map(
      (item) =>
        `${item[leftKey]} | ${item[rightKey]}`
    )
    .join("\n");
}

function urlForSelection(
  courseId: string,
  unitId?: string,
  lessonId?: string
): string {
  const params = new URLSearchParams();

  params.set("course", courseId);

  if (unitId) {
    params.set("unit", unitId);
  }

  if (lessonId) {
    params.set("lesson", lessonId);
  }

  return `/admin/curriculum/activities?${params.toString()}`;
}

/* =========================================================
   ACTIVITY FORM
========================================================= */

function ActivityForm({
  lessonId,
  activity,
  suggestedNumber,
  onDirtyChange,
}: {
  lessonId: string;
  activity?: ActivityRow;
  suggestedNumber: number;
  onDirtyChange: () => void;
}) {
  const originalType =
    activityTypes.find(
      (item) => item.id === activity?.activity_type
    )?.id ?? "flip_cards";

  const [type, setType] = useState<ActivityType>(
    originalType
  );

  const [pairText, setPairText] = useState(
    activity?.activity_type === "flip_cards"
      ? getPairs(activity.content.cards, "front", "back")
      : activity?.activity_type === "matching"
        ? getPairs(
            activity.answer_config.pairs,
            "left",
            "right"
          )
        : ""
  );

  const [options, setOptions] = useState(
    getList(activity?.content.options).join("\n")
  );

  const [answer, setAnswer] = useState(
    typeof activity?.answer_config.answer === "string"
      ? activity.answer_config.answer
      : ""
  );

  const [phrase, setPhrase] = useState(
    getList(activity?.answer_config.tokens).join(" ")
  );

  const choices = options
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <form
      action={saveActivityAction}
      onChangeCapture={onDirtyChange}
      onInputCapture={onDirtyChange}
      className="mt-5 space-y-5"
    >
      <input
        type="hidden"
        name="lesson_id"
        value={lessonId}
      />

      {activity && (
        <input
          type="hidden"
          name="id"
          value={activity.id}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Activity Number *
          <input
            type="number"
            name="activity_number"
            min={1}
            max={10000}
            required
            defaultValue={
              activity?.activity_number ?? suggestedNumber
            }
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Activity Type *
          <select
            name="activity_type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as ActivityType)
            }
            className={inputClass}
          >
            {activityTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        Activity Title *
        <input
          type="text"
          name="title"
          maxLength={150}
          required
          defaultValue={activity?.title ?? ""}
          placeholder="Japanese Greeting Flashcards"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Instructions
        <textarea
          name="instructions"
          maxLength={1000}
          rows={3}
          defaultValue={activity?.instructions ?? ""}
          placeholder="Read each Japanese expression and find its meaning."
          className={`${inputClass} resize-y`}
        />
      </label>

      {(type === "flip_cards" ||
        type === "matching") && (
        <section className="rounded-2xl bg-[#f7f5ff] p-5">
          <h3 className="font-bold">
            {type === "flip_cards"
              ? "Flashcard Vocabulary"
              : "Matching Word Pairs"}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Enter one pair per line, using | between
            the Japanese and English expressions.
          </p>

          <div className="mt-4 rounded-xl bg-white p-3 font-mono text-xs leading-6 text-[#3558AE]">
            <div>こんにちは | Hello</div>
            <div>ありがとう | Thank you</div>
            <div>さようなら | Goodbye</div>
          </div>

          <textarea
            name="pairs"
            required
            rows={7}
            value={pairText}
            onChange={(event) =>
              setPairText(event.target.value)
            }
            placeholder={
              "こんにちは | Hello\nありがとう | Thank you"
            }
            className={`${inputClass} mt-4 resize-y font-mono`}
          />
        </section>
      )}

      {type === "multiple_choice" && (
        <section className="space-y-4 rounded-2xl bg-[#f7f5ff] p-5">
          <h3 className="font-bold">
            Multiple Choice Options
          </h3>

          <p className="text-sm text-slate-500">
            Put the question in Instructions and
            write one possible answer per line.
          </p>

          <label className={labelClass}>
            Answer Choices *
            <textarea
              name="options"
              required
              rows={5}
              value={options}
              onChange={(event) =>
                setOptions(event.target.value)
              }
              placeholder={"Hello\nGoodbye\nThank you"}
              className={`${inputClass} resize-y`}
            />
          </label>

          <label className={labelClass}>
            Correct Answer *
            <select
              name="correct_answer"
              required
              value={answer}
              onChange={(event) =>
                setAnswer(event.target.value)
              }
              className={inputClass}
            >
              <option value="">
                Select the correct answer
              </option>

              {choices.map((choice, index) => (
                <option
                  key={`${index}-${choice}`}
                  value={choice}
                >
                  {choice}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {type === "word_order" && (
        <section className="rounded-2xl bg-[#f7f5ff] p-5">
          <h3 className="font-bold">
            Correct Word Order
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Write the sentence in its correct order.
            Each space-separated word becomes a tile.
          </p>

          <textarea
            name="phrase"
            required
            rows={3}
            value={phrase}
            onChange={(event) =>
              setPhrase(event.target.value)
            }
            placeholder="Nice to meet you"
            className={`${inputClass} mt-4 resize-y`}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {phrase
              .split(/\s+/)
              .filter(Boolean)
              .map((word, index) => (
                <span
                  key={`${index}-${word}`}
                  className="rounded-lg border border-[#ddd7fa] bg-white px-3 py-2 text-sm"
                >
                  {word}
                </span>
              ))}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Advanced Japanese tokenization will be added
            later. Use space-separated phrases for now.
          </p>
        </section>
      )}

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2A255C]"
      >
        <Save size={17} />
        {activity
          ? "Save Activity Changes"
          : "Create Draft Activity"}
      </button>
    </form>
  );
}

/* =========================================================
   MAIN BUILDER
========================================================= */

export default function ActivityBuilder({
  courses,
  units,
  lessons,
  courseId,
  unitId,
  lessonId,
  activities,
  success,
  error,
}: Props) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] =
    useState(false);

  const selectedCourse = courses.find(
    (item) => item.id === courseId
  );

  const availableUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort(
      (a, b) =>
        a.number - b.number ||
        a.title.localeCompare(b.title)
    );

  const selectedUnit = availableUnits.find(
    (unit) => unit.id === unitId
  );

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort(
      (a, b) =>
        a.number - b.number ||
        a.title.localeCompare(b.title)
    );

  const selectedLesson = availableLessons.find(
    (lesson) => lesson.id === lessonId
  );

  const nextActivityNumber =
    activities.reduce(
      (highest, item) =>
        Math.max(highest, item.activity_number),
      0
    ) + 1;

  function navigate(
    nextCourseId: string,
    nextUnitId?: string,
    nextLessonId?: string
  ) {
    const destination = urlForSelection(
      nextCourseId,
      nextUnitId,
      nextLessonId
    );

    if (
      hasUnsavedChanges &&
      !window.confirm(
        "You have unsaved activity changes. Switch lessons and discard these changes?"
      )
    ) {
      return;
    }

    setHasUnsavedChanges(false);
    router.push(destination);
  }

  function changeCourse(nextCourseId: string) {
    const nextUnit = units
      .filter((unit) => unit.courseId === nextCourseId)
      .sort((a, b) => a.number - b.number)[0];

    const nextLesson = nextUnit
      ? lessons
          .filter((lesson) => lesson.unitId === nextUnit.id)
          .sort((a, b) => a.number - b.number)[0]
      : undefined;

    navigate(
      nextCourseId,
      nextUnit?.id,
      nextLesson?.id
    );
  }

  function changeUnit(nextUnitId: string) {
    if (!courseId) return;

    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === nextUnitId)
      .sort((a, b) => a.number - b.number)[0];

    navigate(
      courseId,
      nextUnitId,
      nextLesson?.id
    );
  }

  function changeLesson(nextLessonId: string) {
    if (!courseId || !unitId) return;

    navigate(courseId, unitId, nextLessonId);
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      {lessonId && <AdminWorkflowNavigation slug="activities" lesson={lessonId} />}
      <div className="mx-auto max-w-5xl">


        <header className="mt-0">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#3558AE]">
            <Gamepad2 size={19} />
            Curriculum Studio
          </div>

          <h1 className="mt-3 text-3xl font-extrabold">
            Interactive Activity Builder
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Select a course, unit, and lesson before creating
            or editing activities. Every activity is saved
            to the selected lesson in Supabase.
          </p>
        </header>

        {/* HIERARCHICAL SELECTOR */}

        <section className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <BookOpen
              size={23}
              className="text-[#3558AE]"
            />
            <div>
              <h2 className="text-lg font-bold">
                Curriculum Location
              </h2>
              <p className="text-xs text-slate-500">
                Course → Unit → Lesson
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className={labelClass}>
              Course
              <select
                value={courseId ?? ""}
                onChange={(event) =>
                  changeCourse(event.target.value)
                }
                disabled={courses.length === 0}
                className={inputClass}
              >
                {courses.length === 0 && (
                  <option value="">No courses</option>
                )}

                {courses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.flagEmoji} {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Unit
              <select
                value={unitId ?? ""}
                onChange={(event) =>
                  changeUnit(event.target.value)
                }
                disabled={
                  !courseId ||
                  availableUnits.length === 0
                }
                className={inputClass}
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
            </label>

            <label className={labelClass}>
              Lesson
              <select
                value={lessonId ?? ""}
                onChange={(event) =>
                  changeLesson(event.target.value)
                }
                disabled={
                  !unitId ||
                  availableLessons.length === 0
                }
                className={inputClass}
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
            </label>
          </div>

          {selectedLesson && (
            <div className="mt-6 rounded-2xl bg-[#f0edff] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#3558AE]">
                Currently editing
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span>
                  {selectedCourse?.flagEmoji}{" "}
                  {selectedCourse?.title}
                </span>
                <span className="text-slate-400">/</span>
                <span>
                  Unit {selectedUnit?.number}
                </span>
                <span className="text-slate-400">/</span>
                <span>
                  Lesson {selectedLesson.number}:{" "}
                  {selectedLesson.title}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-green-700">
                <CheckCircle2 size={17} />
                New activities will belong to this lesson.
              </div>
            </div>
          )}

          {hasUnsavedChanges && (
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-700">
              <AlertTriangle size={17} />
              You have unsaved form changes.
            </p>
          )}
        </section>

        {/* NOTIFICATIONS */}

        {success && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700"
          >
            {success}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-white bg-white/90 p-5">
          <h2 className="text-lg font-bold">Manual authoring &amp; generated practice</h2>
          <p className="mt-2 text-sm text-slate-600">Create activities manually below, or use AI Practice Generator from the lesson workflow. Saved activities from both tools appear in the same list; older records do not track authoring origin.</p>
          {lessonId && <Link className="mt-3 inline-flex font-semibold text-[#3558AE] hover:underline" href={"/admin/curriculum/practice-ai?lesson=" + encodeURIComponent(lessonId)}>Open AI Practice Generator</Link>}
        </section>
        {/* ACTIVITY EDITOR */}

        {selectedLesson && lessonId ? (
          <section
            key={lessonId}
            className="mt-8 space-y-6"
          >
            <div className="rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Layers3
                  size={23}
                  className="text-[#3558AE]"
                />
                <div>
                  <p className="text-xs font-bold text-[#3558AE]">
                    SELECTED LESSON
                  </p>
                  <h2 className="text-xl font-bold">
                    {selectedLesson.title}
                  </h2>
                </div>
              </div>

              <details
                className="group mt-6 rounded-2xl border border-dashed border-[#C7A9D4] p-5"
                open={activities.length === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  <span className="flex items-center gap-2">
                    <Plus size={18} />
                    Create Manual Activity
                  </span>

                  <ChevronDown className="transition group-open:rotate-180" />
                </summary>

                <ActivityForm
                  key={`new-${lessonId}`}
                  lessonId={lessonId}
                  suggestedNumber={nextActivityNumber}
                  onDirtyChange={() =>
                    setHasUnsavedChanges(true)
                  }
                />
              </details>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-extrabold">
                Lesson Activities ({activities.length})
              </h2>

              {activities.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
                  There are no activities in this lesson yet.
                  Create a draft activity above.
                </div>
              )}

              {activities.map((activity) => {
                const typeDefinition = activityTypes.find(
                  (item) =>
                    item.id === activity.activity_type
                );

                return (
                  <article
                    key={activity.id}
                    className="rounded-2xl border border-white bg-white/95 p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#3558AE]">
                          Activity {activity.activity_number}
                        </p>

                        <h3 className="mt-1 text-lg font-bold">
                          {activity.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#3558AE]">
                          {typeDefinition?.label ??
                            activity.activity_type}
                        </span>

                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-700">
                          {activity.status}
                        </span>
                      </div>
                    </div>

                    {activity.instructions && (
                      <p className="mt-3 text-sm text-slate-500">
                        {activity.instructions}
                      </p>
                    )}

                    <details className="group mt-5 border-t border-slate-100 pt-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#3558AE]">
                        Edit Activity
                        <ChevronDown
                          size={17}
                          className="transition group-open:rotate-180"
                        />
                      </summary>

                      {activity.status === "published" ? (
                        <p className="mt-4 text-sm text-amber-700">
                          This activity is published and
                          cannot be edited in this draft editor.
                        </p>
                      ) : typeDefinition ? (
                        <ActivityForm
                          key={`${lessonId}-${activity.id}`}
                          lessonId={lessonId}
                          activity={activity}
                          suggestedNumber={
                            activity.activity_number
                          }
                          onDirtyChange={() =>
                            setHasUnsavedChanges(true)
                          }
                        />
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">
                          This activity format is not yet
                          supported by the visual editor.
                        </p>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/90 p-10 text-center">
            <BookOpen
              size={35}
              className="mx-auto text-[#3558AE]"
            />
            <h2 className="mt-4 font-bold">
              Select a lesson to begin
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              If no lessons are available, create a unit
              and lesson in the Roadmap Builder first.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
