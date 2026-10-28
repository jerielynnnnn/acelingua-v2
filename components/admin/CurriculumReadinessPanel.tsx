
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Layers3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type {
  ReadinessReport,
} from "@/lib/curriculum/readiness";

type CourseOption = {
  id: string;
  title: string;
};

type UnitOption = {
  id: string;
  courseId: string;
  title: string;
  number: number;
};

type LessonOption = {
  id: string;
  unitId: string;
  title: string;
  number: number;
};

type Props = {
  courses: CourseOption[];
  units: UnitOption[];
  lessons: LessonOption[];
  selectedLessonId: string;
  report: ReadinessReport | null;
};

const field =
  "w-full rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm text-[#2A255C] outline-none " +
  "transition focus:border-[#3558AE] " +
  "focus:ring-2 focus:ring-[#3558AE]/15";

export default function CurriculumReadinessPanel({
  courses,
  units,
  lessons,
  selectedLessonId,
  report,
}: Props) {
  const router = useRouter();

  const selected = lessons.find(
    (lesson) => lesson.id === selectedLessonId
  );

  const startingUnit = units.find(
    (unit) => unit.id === selected?.unitId
  );

  const [courseId, setCourseId] = useState(
    startingUnit?.courseId ?? courses[0]?.id ?? ""
  );

  const [unitId, setUnitId] = useState(
    startingUnit?.id ?? ""
  );

  const [lessonId, setLessonId] = useState(
    selectedLessonId
  );

  const [refreshing, setRefreshing] = useState(false);

  const availableUnits = units
    .filter((unit) => unit.courseId === courseId)
    .sort((a, b) => a.number - b.number);

  const availableLessons = lessons
    .filter((lesson) => lesson.unitId === unitId)
    .sort((a, b) => a.number - b.number);

  const selectionIsCurrent =
    lessonId === selectedLessonId;

  function navigateToLesson(id: string) {
    if (!id) return;

    router.push(
      "/admin/curriculum/review?lesson=" +
      encodeURIComponent(id)
    );
  }

  function changeCourse(nextId: string) {
    const nextUnit = units
      .filter((unit) => unit.courseId === nextId)
      .sort((a, b) => a.number - b.number)[0];

    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === nextUnit?.id)
      .sort((a, b) => a.number - b.number)[0];

    setCourseId(nextId);
    setUnitId(nextUnit?.id ?? "");
    setLessonId(nextLesson?.id ?? "");

    if (nextLesson) navigateToLesson(nextLesson.id);
  }

  function changeUnit(nextId: string) {
    const nextLesson = lessons
      .filter((lesson) => lesson.unitId === nextId)
      .sort((a, b) => a.number - b.number)[0];

    setUnitId(nextId);
    setLessonId(nextLesson?.id ?? "");

    if (nextLesson) navigateToLesson(nextLesson.id);
  }

  function changeLesson(nextId: string) {
    setLessonId(nextId);
    navigateToLesson(nextId);
  }

  function refreshReport() {
    setRefreshing(true);
    router.refresh();

    // This is a visual request state only. The button
    // remains usable on the next interaction.
    setRefreshing(false);
  }

  const selectedReport =
    selectionIsCurrent ? report : null;

  const passed =
    selectedReport?.checks.filter(
      (item) => item.status === "pass"
    ).length ?? 0;

  const total =
    selectedReport?.checks.length ?? 0;

  const lessonParam =
    encodeURIComponent(selectedLessonId);

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C] ">
      {selectedLessonId && <AdminWorkflowNavigation slug="review" lesson={selectedLessonId} />}
      <div className="mx-auto max-w-6xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#3558AE]">
            <ShieldCheck size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            Curriculum Readiness Checker
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Inspect real Supabase curriculum records,
            identify missing learning components,
            and prepare lessons for final review.
            Continue to approval and secure publishing after review.
          </p>
        </header>

        {/* SELECTORS */}

        <section className="mt-9 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#3558AE]">
              <Layers3 size={23} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold">
                Select Content to Review
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Course → Unit → Lesson
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            <label className="block space-y-2 text-sm font-bold">
              1. Course
              <select
                value={courseId}
                onChange={(event) =>
                  changeCourse(event.target.value)
                }
                className={field}
              >
                {!courses.length && (
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
                disabled={!availableUnits.length}
                onChange={(event) =>
                  changeUnit(event.target.value)
                }
                className={field}
              >
                {!availableUnits.length && (
                  <option value="">No units</option>
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
                disabled={!availableLessons.length}
                onChange={(event) =>
                  changeLesson(event.target.value)
                }
                className={field}
              >
                {!availableLessons.length && (
                  <option value="">No lessons</option>
                )}

                {availableLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    Lesson {lesson.number} — {lesson.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {!selectedReport ? (
          <section className="mt-7 rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            {lessonId
              ? "Loading the selected lesson report..."
              : "Select a draft lesson to view its readiness report."}
          </section>
        ) : (
          <>
            {/* REPORT SUMMARY */}

            <section className="mt-7 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-[#3558AE]">
                    {selectedReport.courseTitle}
                    {" / "}
                    {selectedReport.unitTitle}
                  </p>

                  <h2 className="mt-3 text-2xl font-extrabold">
                    {selectedReport.lessonTitle}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Curriculum readiness report
                  </p>
                </div>

                <span
                  className={
                    "rounded-full px-4 py-2 text-xs font-bold " +
                    (selectedReport.ready
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-800")
                  }
                >
                  {selectedReport.ready
                    ? "Structural Checks Passed"
                    : "Needs Attention"}
                </span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Vocabulary",
                    value: selectedReport.counts.vocabulary,
                  },
                  {
                    label: "Teaching Steps",
                    value: selectedReport.counts.steps,
                  },
                  {
                    label: "Activities",
                    value: selectedReport.counts.activities,
                  },
                  {
                    label: "Assessments",
                    value: selectedReport.counts.assessments,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-[#f7f5ff] p-4"
                  >
                    <p className="text-3xl font-extrabold">
                      {item.value}
                    </p>

                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <div className="flex justify-between gap-3 text-sm font-bold">
                  <span>Validation progress</span>
                  <span>{passed}/{total} passed</span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#3558AE] transition-all"
                    style={{
                      width:
                        total > 0
                          ? `${(passed / total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {selectedReport.errors} blocking issues
                  {" · "}
                  {selectedReport.warnings} warnings
                </p>
              </div>

              <button
                type="button"
                onClick={refreshReport}
                disabled={refreshing}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#d9d3f7] bg-white px-5 py-3 text-sm font-bold text-[#3558AE] hover:bg-[#f7f5ff]"
              >
                <RefreshCw size={17} />
                Refresh Report
              </button>
            </section>

            {/* CHECKLIST */}

            <section className="mt-9">
              <h2 className="text-xl font-extrabold">
                Content Validation Checklist
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Review each check before requesting
                final approval.
              </p>

              <div className="mt-5 space-y-3">
                {selectedReport.checks.map((check) => {
                  const passedCheck =
                    check.status === "pass";

                  return (
                    <article
                      key={check.id}
                      className="flex items-start gap-4 rounded-2xl border border-white bg-white/95 p-5 shadow-sm"
                    >
                      <div
                        className={
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
                          (passedCheck
                            ? "bg-green-50 text-green-600"
                            : check.status === "warning"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600")
                        }
                      >
                        {passedCheck ? (
                          <CheckCircle2 size={21} />
                        ) : (
                          <AlertCircle size={21} />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-extrabold">
                            {check.label}
                          </h3>

                          <span className="text-xs font-semibold capitalize text-slate-400">
                            {check.status}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {check.details}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-9 rounded-3xl border border-[#ded8f8] bg-white/95 p-6 shadow-sm">
              <h2 className="text-xl font-extrabold">Approval &amp; Publishing</h2>
              <p className="mt-2 text-sm text-slate-600">Resolve blocking readiness issues, test the learner preview, then approve this lesson. Secure publishing verifies approval and content changes on the server.</p>
              <Link href={"/admin/curriculum/approve?lesson=" + lessonParam} className="mt-5 inline-flex rounded-xl bg-[#3558AE] px-5 py-3 font-bold text-white">Continue to Admin Approval</Link>
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-[#ded9f5] pt-5 text-center text-xs text-slate-500">
          ACELINGUA V2 · Curriculum Review · Admin Only
        </footer>
      </div>
    </main>
  );
}
