
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import LessonApprovalPanel from "@/components/admin/LessonApprovalPanel";

import { requireAccount } from "@/lib/auth/roles";
import { getLessonReadiness } from "@/lib/curriculum/readiness";

type Props = {
  searchParams: Promise<{
    lesson?: string;
  }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const lessonId = params.lesson;

  if (!lessonId || !UUID.test(lessonId)) {
    return (
      <main className="flex min-h-0 flex-col items-center justify-center gap-5 bg-[#f9f2ff] p-8">
        <h1 className="text-2xl font-extrabold text-[#2A255C]">
          Select a Lesson for Approval
        </h1>

        <p className="text-center text-sm text-slate-600">
          Choose a lesson through the Curriculum
          Readiness Checker first.
        </p>

        <Link
          href="/admin/curriculum/review"
          className="rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white"
        >
          Open Curriculum Review
        </Link>
      </main>
    );
  }

  const report = await getLessonReadiness(lessonId);

  return <LessonApprovalPanel report={report} />;
}

export default function ApprovalPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-0 items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading approval workflow...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
