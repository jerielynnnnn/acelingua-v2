
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  GraduationCap,
  LockKeyhole,
  Map as MapIcon,
  Play,
  Sparkles,
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================

export type PublishedLesson = {
  lessonId: string;
  courseId: string;
  unitId: string;
  courseTitle: string;
  unitTitle: string;
  lessonTitle: string;
  publishedAt: string;
};

type Props = {
  lessons: PublishedLesson[];
};

type RoadmapUnit = {
  id: string;
  title: string;
  lessons: PublishedLesson[];
};

type RoadmapCourse = {
  id: string;
  title: string;
  units: RoadmapUnit[];
};

// ======================================================
// BUILD ROADMAP STRUCTURE
// ======================================================

function buildCourses(
  lessons: PublishedLesson[]
): RoadmapCourse[] {
  // JavaScript Map, not the Lucide icon.
  const courseMap = new Map<string, RoadmapCourse>();

  for (const lesson of lessons) {
    let course = courseMap.get(lesson.courseId);

    if (!course) {
      course = {
        id: lesson.courseId,
        title: lesson.courseTitle,
        units: [],
      };

      courseMap.set(lesson.courseId, course);
    }

    let unit = course.units.find(
      (item) => item.id === lesson.unitId
    );

    if (!unit) {
      unit = {
        id: lesson.unitId,
        title: lesson.unitTitle,
        lessons: [],
      };

      course.units.push(unit);
    }

    unit.lessons.push(lesson);
  }

  return Array.from(courseMap.values());
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function PublishedCourseRoadmap({
  lessons,
}: Props) {
  const courses = useMemo(
    () => buildCourses(lessons),
    [lessons]
  );

  const [selectedCourseId, setSelectedCourseId] =
    useState(courses[0]?.id ?? "");

  const activeCourse =
    courses.find(
      (course) => course.id === selectedCourseId
    ) ?? courses[0];

  const totalPublished = lessons.length;

  const activeLessons =
    activeCourse?.units.flatMap(
      (unit) => unit.lessons
    ) ?? [];

  const firstLesson = activeLessons[0];

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-5 py-8 text-[#2A255C] md:px-8">
      <div className="mx-auto max-w-5xl">

        {/* BACK TO LEARNER DASHBOARD */}

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] transition hover:underline"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        {/* ROADMAP HEADER */}

        <header className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3558AE]">
                <Compass size={17} />
                Learn · Speak · Explore
              </p>

              <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">
                Your Learning Roadmap
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Explore lessons published by ACELINGUA.
                Choose a course and begin learning at
                your own pace.
              </p>
            </div>

            {/* MAP ICON */}

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#3558AE]">
              <MapIcon size={30} />
            </div>
          </div>

          {/* OVERVIEW STATS */}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f5f2ff] p-5">
              <p className="text-3xl font-extrabold">
                {courses.length}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Available courses
              </p>
            </div>

            <div className="rounded-2xl bg-[#f5f2ff] p-5">
              <p className="text-3xl font-extrabold">
                {totalPublished}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Published lessons
              </p>
            </div>
          </div>
        </header>

        {/* EMPTY STATE */}

        {courses.length === 0 ? (
          <section className="mt-7 rounded-3xl bg-white p-8 text-center shadow-sm">
            <BookOpen
              size={42}
              className="mx-auto text-[#3558AE]"
            />

            <h2 className="mt-5 text-xl font-extrabold">
              Lessons are coming soon
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
              No published lessons are currently available
              for this account. Check again when your
              learning content is released.
            </p>

            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white"
            >
              Return to Dashboard
              <ArrowRight size={17} />
            </Link>
          </section>
        ) : (
          <>
            {/* COURSE SELECTOR */}

            <section className="mt-7 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <GraduationCap
                  size={22}
                  className="text-[#3558AE]"
                />
                Select Your Course
              </h2>

              <label className="mt-5 block text-sm font-semibold">
                <span className="mb-2 block">
                  Available courses
                </span>

                <select
                  value={activeCourse?.id ?? ""}
                  onChange={(event) =>
                    setSelectedCourseId(event.target.value)
                  }
                  className="w-full rounded-xl border border-[#ded9f5] bg-white px-4 py-3 text-sm text-[#2A255C] outline-none focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/15"
                >
                  {courses.map((course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {/* ACTIVE COURSE */}

            {activeCourse && (
              <section className="mt-7 space-y-6">

                {/* COURSE HERO */}

                <div className="rounded-3xl bg-[#2A255C] p-6 text-white shadow-sm md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#d4c9ff]">
                        <Sparkles size={16} />
                        Ready to Explore
                      </p>

                      <h2 className="mt-3 text-2xl font-extrabold">
                        {activeCourse.title}
                      </h2>

                      <p className="mt-3 text-sm text-[#e4ddff]">
                        {activeCourse.units.length} available{" "}
                        {activeCourse.units.length === 1
                          ? "unit"
                          : "units"}
                        {" · "}
                        {activeLessons.length} published{" "}
                        {activeLessons.length === 1
                          ? "lesson"
                          : "lessons"}
                      </p>
                    </div>

                    {firstLesson && (
                      <Link
                        href={
                          "/learn/published/" +
                          encodeURIComponent(
                            firstLesson.lessonId
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#3558AE] transition hover:bg-[#f0edff]"
                      >
                        <Play size={17} />
                        Start Learning
                      </Link>
                    )}
                  </div>
                </div>

                {/* UNITS AND LESSONS */}

                {activeCourse.units.map(
                  (unit, unitIndex) => (
                    <article
                      key={unit.id}
                      className="rounded-3xl border border-white bg-white/95 p-6 shadow-sm md:p-8"
                    >
                      {/* UNIT HEADING */}

                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] font-extrabold text-[#3558AE]">
                          {unitIndex + 1}
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
                            Available Unit
                          </p>

                          <h3 className="mt-1 text-xl font-extrabold">
                            {unit.title}
                          </h3>
                        </div>
                      </div>

                      {/* LESSON ROADMAP */}

                      <div className="relative mt-7 space-y-4">
                        <div
                          aria-hidden="true"
                          className="absolute bottom-10 left-6 top-10 w-0.5 bg-[#ddd8f8]"
                        />

                        {unit.lessons.map(
                          (lesson, lessonIndex) => (
                            <div
                              key={lesson.lessonId}
                              className="relative flex items-center gap-4"
                            >
                              {/* LESSON NODE */}

                              <div className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#3558AE] text-white shadow-sm">
                                <BookOpen size={18} />
                              </div>

                              {/* LESSON CARD */}

                              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e7e2f8] bg-[#faf9ff] p-4 transition hover:border-[#bfb3e8] hover:shadow-sm">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#3558AE]">
                                    Available lesson{" "}
                                    {lessonIndex + 1}
                                  </p>

                                  <h4 className="mt-1 text-base font-extrabold">
                                    {lesson.lessonTitle}
                                  </h4>

                                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                                    <CheckCircle2 size={14} />
                                    Published content
                                  </p>
                                </div>

                                <Link
                                  href={
                                    "/learn/published/" +
                                    encodeURIComponent(
                                      lesson.lessonId
                                    )
                                  }
                                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#3558AE] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#2A255C]"
                                >
                                  <Play size={15} />
                                  Open Lesson
                                </Link>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </article>
                  )
                )}

                {/* PROGRESSION NOTICE */}

                <div className="flex items-start gap-3 rounded-2xl border border-[#ded9f5] bg-white/90 p-5">
                  <LockKeyhole
                    size={21}
                    className="shrink-0 text-[#3558AE]"
                  />

                  <p className="text-sm leading-7 text-slate-600">
                    This roadmap currently displays published
                    lessons only. Lesson completion, score-based
                    unlocks, streaks, and rewards will be added
                    in the secure learner progression phase.
                  </p>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="mt-10 text-center text-xs text-slate-500">
          ACELINGUA · Your Language Learning Adventure
        </footer>
      </div>
    </main>
  );
}
