
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  Info,
  PencilLine,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

import type {
  ConsistencyReport,
  ConsistencySeverity,
} from "@/lib/curriculum/consistency";

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
};

type Props = {
  courses: Course[];
  units: Unit[];
  lessons: Lesson[];
  selectedLessonId: string;
  report: ConsistencyReport;
};

type Filter = "all" | ConsistencySeverity;

const field =
  "w-full rounded-xl border border-[#dedcf0] bg-white " +
  "px-4 py-3 text-sm text-[#2A255C] outline-none " +
  "focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/15";

export default function LessonConsistencyPanel({
  courses,
  units,
  lessons,
  selectedLessonId,
  report,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const selectedLesson = lessons.find(
    (lesson) => lesson.id === selectedLessonId
  );

  const selectedUnit = units.find(
    (unit) => unit.id === selectedLesson?.unitId
  );

  const selectedCourse = courses.find(
    (course) => course.id === selectedUnit?.courseId
  );

  const availableUnits = units
    .filter((unit) => unit.courseId === selectedCourse?.id)
    .sort((a, b) => a.number - b.number);

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === selectedUnit?.id)
    .sort((a, b) => a.number - b.number);

  const visibleIssues = report.issues.filter(
    (issue) =>
      filter === "all" || issue.severity === filter
  );

  const editorUrl =
    "/admin/curriculum/lesson-editor?lesson=" +
    encodeURIComponent(selectedLessonId);

  const previewUrl =
    "/admin/curriculum/lesson-preview?lesson=" +
    encodeURIComponent(selectedLessonId);

  const reviewUrl =
    "/admin/curriculum/review?lesson=" +
    encodeURIComponent(selectedLessonId);

  function navigateLesson(id: string) {
    if (!id || id === selectedLessonId) return;

    startTransition(() => {
      router.push(
        "/admin/curriculum/consistency?lesson=" +
        encodeURIComponent(id)
      );
    });
  }

  function changeCourse(id: string) {
    const nextUnit = units
      .filter((unit) => unit.courseId === id)
      .sort((a, b) => a.number - b.number)[0];

    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === nextUnit?.id)
      .sort((a, b) => a.number - b.number)[0];

    if (nextLesson) navigateLesson(nextLesson.id);
  }

  function changeUnit(id: string) {
    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === id)
      .sort((a, b) => a.number - b.number)[0];

    if (nextLesson) navigateLesson(nextLesson.id);
  }

  const summaryCards = [
    {
      name: "Blocking Issues",
      count: report.errors,
      icon: AlertCircle,
      style: "bg-red-50 text-red-700",
    },
    {
      name: "Review Warnings",
      count: report.warnings,
      icon: AlertTriangle,
      style: "bg-amber-50 text-amber-700",
    },
    {
      name: "Recommendations",
      count: report.infos,
      icon: Info,
      style: "bg-blue-50 text-blue-700",
    },
  ];

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C] ">
      {selectedLessonId && <AdminWorkflowNavigation slug="consistency" lesson={selectedLessonId} />}
      <div className="mx-auto max-w-5xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#3558AE]">
            <ScanSearch size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            Lesson Consistency Checker
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Find potentially repeated vocabulary, mismatched
            translations, incorrect activity configurations,
            and dialogue issues before approving lessons.
          </p>
        </header>

        {/* CURRICULUM FILTERS */}

        <section className="mt-9 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#3558AE]">
              <BookOpen size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">
                Choose a Lesson
              </h2>
              <p className="text-xs text-slate-500">
                Course → Unit → Lesson
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="block space-y-2 text-sm font-bold">
              Course
              <select
                value={selectedCourse?.id ?? ""}
                onChange={(event) =>
                  changeCourse(event.target.value)
                }
                disabled={pending}
                className={field}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-bold">
              Unit
              <select
                value={selectedUnit?.id ?? ""}
                onChange={(event) =>
                  changeUnit(event.target.value)
                }
                disabled={pending}
                className={field}
              >
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    Unit {unit.number} — {unit.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-bold">
              Lesson
              <select
                value={selectedLessonId}
                onChange={(event) =>
                  navigateLesson(event.target.value)
                }
                disabled={pending}
                className={field}
              >
                {availableLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    Lesson {lesson.number} — {lesson.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* RESULTS */}

        <section className="mt-7 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#3558AE]">
                {selectedCourse?.title} / {selectedUnit?.title}
              </p>

              <h2 className="mt-2 text-2xl font-extrabold">
                {report.lessonTitle}
              </h2>

              <p className="mt-2 text-xs text-slate-500">
                Quality-control results from saved Supabase data
              </p>
            </div>

            <span
              className={
                "rounded-full px-4 py-2 text-xs font-bold " +
                (report.errors
                  ? "bg-red-50 text-red-700"
                  : report.warnings
                    ? "bg-amber-50 text-amber-700"
                    : "bg-green-50 text-green-700")
              }
            >
              {report.errors
                ? "Corrections Required"
                : report.warnings
                  ? "Manual Review Needed"
                  : "No Blocking Issues Detected"}
            </span>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.name}
                  className={`rounded-2xl p-5 ${card.style}`}
                >
                  <Icon size={22} />

                  <p className="mt-4 text-3xl font-extrabold tabular-nums">
                    {card.count}
                  </p>

                  <p className="mt-1 text-xs font-semibold">
                    {card.name}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[
              ["Vocabulary", report.counts.vocabulary],
              ["Steps", report.counts.steps],
              ["Activities", report.counts.activities],
              ["Questions", report.counts.questions],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-xl bg-[#f7f5ff] p-3"
              >
                <p className="text-xl font-extrabold">
                  {count}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(() => router.refresh());
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-4 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f6f3ff]"
            >
              <RefreshCw size={17} />
              Refresh Results
            </button>

            <Link
              href={editorUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3558AE] px-4 py-3 text-sm font-bold text-white hover:bg-[#2A255C]"
            >
              <PencilLine size={17} />
              Open Lesson Editor
            </Link>
          </div>
        </section>

        {/* ISSUE LIST */}

        <section className="mt-9">
          <h2 className="text-xl font-extrabold">
            Consistency Findings
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Every warning links to a review action.
            Nothing is changed automatically.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["all", "All Findings"],
                ["error", "Blocking Issues"],
                ["warning", "Warnings"],
                ["info", "Recommendations"],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                className={
                  "rounded-xl px-4 py-2 text-xs font-bold transition " +
                  (filter === key
                    ? "bg-[#3558AE] text-white"
                    : "border border-[#ded9f5] bg-white text-[#3558AE] hover:bg-[#f3f0ff]")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {visibleIssues.length === 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-green-100 bg-white p-6 text-sm text-green-700">
              <CheckCircle2 size={22} />
              No findings for this filter.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleIssues.map((issue) => {
                const Icon =
                  issue.severity === "error"
                    ? AlertCircle
                    : issue.severity === "warning"
                      ? AlertTriangle
                      : Info;

                const style =
                  issue.severity === "error"
                    ? "bg-red-50 text-red-700"
                    : issue.severity === "warning"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-blue-50 text-blue-700";

                return (
                  <article
                    key={issue.id}
                    className="rounded-2xl border border-white bg-white/95 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style}`}
                      >
                        <Icon size={21} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
                          {issue.category} · {issue.severity}
                        </p>

                        <h3 className="mt-2 text-base font-extrabold">
                          {issue.title}
                        </h3>

                        <p className="mt-2 break-words text-sm leading-7 text-slate-600">
                          {issue.details}
                        </p>

                        <div className="mt-4 rounded-xl bg-[#f7f5ff] p-4">
                          <p className="text-xs font-bold uppercase text-[#3558AE]">
                            Recommended action
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {issue.action}
                          </p>
                        </div>

                        <Link
                          href={editorUrl}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] hover:underline"
                        >
                          Open Lesson Content Manager
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* FINAL WORKFLOW */}

        <section className="mt-9 rounded-3xl border border-[#ded9fa] bg-white/95 p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <ShieldCheck size={22} className="text-[#3558AE]" />
            Quality Assurance Workflow
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Correct the relevant records, refresh this report,
            test the playable lesson, then perform a separate
            readiness check and final Admin review.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={editorUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-4 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f6f3ff]"
            >
              <PencilLine size={17} />
              Edit Content
            </Link>

            <Link
              href={previewUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-4 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f6f3ff]"
            >
              <Eye size={17} />
              Test Preview
            </Link>

            <Link
              href={reviewUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-4 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f6f3ff]"
            >
              <ShieldCheck size={17} />
              Readiness Checker
            </Link>
          </div>

          <p className="mt-5 text-xs leading-6 text-slate-500">
            This is an advisory content-quality report.
            It does not publish lessons, change answer keys,
            or replace a qualified language review.
          </p>
        </section>
      </div>
    </main>
  );
}
