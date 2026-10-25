
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  FolderOpen,
  Gamepad2,
  Globe2,
  Layers3,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { activityTypes } from "@/lib/curriculum/activity-types";

const contentTables = [
  {
    table: "languages",
    label: "Languages",
    icon: Globe2,
  },
  {
    table: "courses",
    label: "Courses",
    icon: BookOpen,
  },
  {
    table: "units",
    label: "Units",
    icon: Layers3,
  },
  {
    table: "lessons",
    label: "Lessons",
    icon: FolderOpen,
  },
  {
    table: "questions",
    label: "Questions",
    icon: ListChecks,
  },
  {
    table: "lesson_activities",
    label: "Activities",
    icon: Gamepad2,
  },
  {
    table: "assessments",
    label: "Assessments",
    icon: ClipboardCheck,
  },
] as const;

const studioSections = [
  {
    label: "Course Builder",
    description:
      "Create languages, courses, units, and ordered lessons.",
    icon: BookOpen,
    stage: "Phase 3B",
  },
  {
    label: "Activity Builder",
    description:
      "Configure matching, flip cards, listening, and more.",
    icon: Gamepad2,
    stage: "Phase 3B",
  },
  {
    label: "Bulk Curriculum Import",
    description:
      "Validate and import Excel, CSV, or JSON lesson content.",
    icon: FileSpreadsheet,
    stage: "Phase 3C",
  },
  {
    label: "Assessment Builder",
    description:
      "Build placement tests, unit reviews, and final exams.",
    icon: ClipboardCheck,
    stage: "Phase 3B",
  },
  {
    label: "Preview & Publish",
    description:
      "Review the learner experience before releasing content.",
    icon: Sparkles,
    stage: "Phase 3D",
  },
] as const;

async function CurriculumStudioContent() {
  await connection();

  const account = await requireAccount("admin");
  const supabase = await createClient();

  const counts = await Promise.all(
    contentTables.map(async (item) => {
      const { count, error } = await supabase
        .from(item.table)
        .select("id", {
          count: "exact",
          head: true,
        });

      if (error) {
        throw new Error(
          `Unable to load ${item.label}: ${error.message}`
        );
      }

      return {
        ...item,
        count: count ?? 0,
      };
    })
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-5 py-9 text-[#2A255C] md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#3558AE] hover:underline"
        >
          <ArrowLeft size={17} />
          Admin Dashboard
        </Link>

        <header className="mt-9">
          <div className="flex items-center gap-2 text-sm font-bold text-[#3558AE]">
            <ShieldCheck size={19} />
            ACELINGUA V2 · ADMIN
          </div>

          <h1 className="mt-4 text-4xl font-extrabold">
            Curriculum Studio
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Organize your languages, courses, lessons,
            interactive activities, and assessments
            in one connected learning system.
          </p>

          <p className="mt-4 text-xs text-slate-500">
            Administrator:
            {" "}
            {account.displayName || "Admin"}
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-xl font-bold">
            Curriculum Overview
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Live record counts from Supabase.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {counts.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.table}
                  className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#efedff] text-[#3558AE]">
                    <Icon size={21} />
                  </div>

                  <p className="mt-5 text-3xl font-extrabold">
                    {item.count}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {item.label}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">
            Content Creation Tools
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Upcoming tools in our Phase 3 development sequence.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {studioSections.map((section) => {
              const Icon = section.icon;

              return (
                <article
                  key={section.label}
                  className="rounded-3xl border border-white bg-white/90 p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efedff] text-[#3558AE]">
                      <Icon size={24} />
                    </div>

                    <span className="rounded-full bg-[#f4f1ff] px-3 py-1 text-xs font-semibold text-[#3558AE]">
                      {section.stage}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold">
                    {section.label}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {section.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-white bg-white/90 p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Supported Activity Types
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                These definitions will power the visual
                activity editor and learner lesson engine.
              </p>
            </div>

            <span className="rounded-full bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#3558AE]">
              {activityTypes.length} Types
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activityTypes.map((activity) => (
              <article
                key={activity.id}
                className="rounded-2xl border border-slate-100 bg-[#fafaff] p-4"
              >
                <div className="flex items-center gap-2">
                  <Gamepad2 size={18} className="text-[#3558AE]" />

                  <h3 className="text-sm font-bold">
                    {activity.label}
                  </h3>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  {activity.description}
                </p>

                <p className="mt-3 text-xs font-semibold capitalize text-[#3558AE]">
                  {activity.category}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-9 rounded-2xl border border-[#dcd7fb] bg-white/80 p-5 text-sm text-[#3558AE]">
          Phase 3A establishes the structure. The next
          step is the interactive course and activity editor.
        </div>
      </div>
    </main>
  );
}

export default function CurriculumStudioPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff]">
          <p className="text-sm font-medium text-[#3558AE]">
            Loading Curriculum Studio...
          </p>
        </main>
      }
    >
      <CurriculumStudioContent />
    </Suspense>
  );
}
