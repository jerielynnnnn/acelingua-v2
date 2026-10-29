
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  GraduationCap,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  Play,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";

import { requireAccount } from "@/lib/auth/roles";
import { signOutAction } from "@/lib/auth/actions";

import {
  getLearnerLearningStateAction,
  type LearnerLearningState,
  type LearnerRoadmapLesson,
} from "@/lib/learn/progress-actions";

type DashboardStat = {
  label: string;
  value: number;
  icon: typeof BookOpen;
  color: string;
};

function lessonHref(lessonId: string): string {
  return `/learn/published/${encodeURIComponent(lessonId)}`;
}

async function LearnerDashboardContent() {
  await connection();

  const account = await requireAccount("learner");

  const response = await getLearnerLearningStateAction();

  if (!response.ok) {
    throw new Error(response.error);
  }

  const learningState: LearnerLearningState = response.data;

  const lessons: LearnerRoadmapLesson[] = learningState.lessons;
  const xp: number = learningState.xp;
  const coins: number = learningState.coins;

  const totalCourses = new Set<string>(
    lessons.map((lesson: LearnerRoadmapLesson) => lesson.courseId)
  ).size;

  const completedLessons = lessons.filter(
    (lesson: LearnerRoadmapLesson) => lesson.completed
  ).length;

  const nextLesson: LearnerRoadmapLesson | null =
    lessons.find(
      (lesson: LearnerRoadmapLesson) =>
        lesson.unlocked && !lesson.completed
    ) ?? null;

  const reviewLesson: LearnerRoadmapLesson | null =
    lessons.find(
      (lesson: LearnerRoadmapLesson) => lesson.completed
    ) ?? null;

  const featuredLesson: LearnerRoadmapLesson | null =
    nextLesson ?? reviewLesson;

  const nextHref = featuredLesson
    ? lessonHref(featuredLesson.lessonId)
    : "/learn/published";

  const stats: DashboardStat[] = [
    {
      label: "Available Courses",
      value: totalCourses,
      icon: GraduationCap,
      color: "bg-[#f0edff] text-[#3558AE]",
    },
    {
      label: "Published Lessons",
      value: lessons.length,
      icon: BookOpen,
      color: "bg-[#edf8ff] text-[#3558AE]",
    },
    {
      label: "Completed Lessons",
      value: completedLessons,
      icon: Trophy,
      color: "bg-[#fff1f6] text-[#B64074]",
    },
    {
      label: "Total XP",
      value: xp,
      icon: Sparkles,
      color: "bg-[#f0edff] text-[#3558AE]",
    },
    {
      label: "Coins",
      value: coins,
      icon: Coins,
      color: "bg-[#fff1f6] text-[#B64074]",
    },
  ];

  const recentLessons: LearnerRoadmapLesson[] =
    lessons.slice(0, 6);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-5 py-8 text-[#2A255C] md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}

        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3558AE] text-white">
              <BookOpen size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold">
                ACElingua
              </h1>

              <p className="text-xs text-slate-500">
                Learn. Speak. Explore.
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-white bg-white/80 px-4 py-3 text-sm font-bold text-[#3558AE] transition hover:bg-white"
            >
              <UserRound size={18} />
              My Profile
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-white bg-white/80 px-4 py-3 text-sm font-bold transition hover:bg-white"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* DASHBOARD OVERVIEW */}

        <section className="mt-10 rounded-[30px] border border-white bg-white/90 p-7 shadow-sm md:p-9">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#3558AE]">
            <Compass size={17} />
            Your Learning Adventure
          </p>

          <h2 className="mt-4 text-3xl font-extrabold md:text-4xl">
            Welcome back, {account.displayName || "Explorer"}!
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Build your language skills, complete published
            lessons, and collect rewards as you progress.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {stats.map((stat: DashboardStat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#f0ecfa] bg-white p-5"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}
                  >
                    <Icon size={21} />
                  </div>

                  <p className="mt-4 text-3xl font-extrabold tabular-nums">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CONTINUE LEARNING */}

        <section className="mt-7 rounded-3xl bg-[#2A255C] p-7 text-white shadow-sm md:p-9">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#d6ccff]">
            <Sparkles size={17} />
            Continue Your Adventure
          </p>

          {featuredLesson ? (
            <>
              <h2 className="mt-4 text-2xl font-extrabold">
                {featuredLesson.courseTitle}
              </h2>

              <p className="mt-2 text-sm text-[#ddd5f9]">
                Unit {featuredLesson.unitNumber} ·{" "}
                {featuredLesson.unitTitle}
              </p>

              <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-5">
                <p className="text-xs font-bold uppercase text-[#d8d0ff]">
                  {featuredLesson.completed
                    ? "Completed Lesson"
                    : "Next Available Lesson"}
                </p>

                <h3 className="mt-2 text-xl font-extrabold">
                  {featuredLesson.lessonTitle}
                </h3>

                {featuredLesson.completed ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-green-200">
                    <CheckCircle2 size={17} />
                    Completed · Score{" "}
                    {featuredLesson.score ?? 0}%
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[#ddd5f9]">
                    Ready for your next learning adventure.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-2xl font-extrabold">
                More lessons are coming soon!
              </h2>

              <p className="mt-3 text-sm text-white/80">
                Your available lessons will appear here
                when they are published.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={nextHref}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-[#3558AE] transition hover:bg-[#f0edff]"
            >
              <Play size={17} />
              {nextLesson
                ? "Continue Learning"
                : featuredLesson
                  ? "Review Lesson"
                  : "Explore Courses"}
              <ArrowRight size={17} />
            </Link>

            <Link
              href="/learn/published"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <MapIcon size={18} />
              Course Roadmap
            </Link>
          </div>
        </section>

        {/* PUBLISHED LESSONS */}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">
                Your Published Lessons
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Your actual progress from Supabase.
              </p>
            </div>

            <Link
              href="/learn/published"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] hover:underline"
            >
              View Roadmap
              <ArrowRight size={17} />
            </Link>
          </div>

          {recentLessons.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-600">
              No published lessons are available yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentLessons.map(
                (lesson: LearnerRoadmapLesson) => (
                  <article
                    key={lesson.lessonId}
                    className="flex flex-col rounded-2xl border border-white bg-white/95 p-6 shadow-sm"
                  >
                    <div
                      className={
                        "flex h-12 w-12 items-center justify-center rounded-xl " +
                        (lesson.completed
                          ? "bg-green-100 text-green-700"
                          : lesson.unlocked
                            ? "bg-[#f0edff] text-[#3558AE]"
                            : "bg-slate-100 text-slate-500")
                      }
                    >
                      {lesson.completed ? (
                        <CheckCircle2 size={23} />
                      ) : lesson.unlocked ? (
                        <BookOpen size={23} />
                      ) : (
                        <LockKeyhole size={23} />
                      )}
                    </div>

                    <p className="mt-5 text-xs font-bold uppercase text-[#3558AE]">
                      {lesson.courseTitle}
                    </p>

                    <h3 className="mt-2 text-lg font-extrabold">
                      {lesson.lessonTitle}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {lesson.unitTitle}
                    </p>

                    <p className="mt-3 text-xs font-semibold text-[#3558AE]">
                      {lesson.completed
                        ? `Completed · ${lesson.score ?? 0}%`
                        : lesson.unlocked
                          ? "Available to Start"
                          : "Locked"}
                    </p>

                    <div className="mt-auto border-t border-slate-100 pt-5">
                      {lesson.unlocked ? (
                        <Link
                          href={lessonHref(lesson.lessonId)}
                          className="inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] hover:underline"
                        >
                          {lesson.completed
                            ? "Review Lesson"
                            : "Open Lesson"}
                          <ArrowRight size={17} />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <LockKeyhole size={14} />
                          Complete earlier lessons to unlock.
                        </span>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-xs text-slate-500">
          ACElingua · Learn. Speak. Explore.
        </footer>
      </div>
    </main>
  );
}

function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] px-6">
      <div
        role="status"
        className="rounded-3xl bg-white p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <p className="font-bold text-[#2A255C]">
          Loading your learning progress...
        </p>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <LearnerDashboardContent />
    </Suspense>
  );
}
