
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import LessonPublishingPanel from "@/components/admin/LessonPublishingPanel";

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
      <main className="flex min-h-0 flex-col items-center justify-center gap-4 bg-[#f9f2ff] px-6 text-center">
        <h1 className="text-2xl font-extrabold text-[#2A255C]">
          Select a Lesson to Publish
        </h1>

        <p className="text-sm text-slate-600">
          Choose the lesson from Curriculum Review,
          then complete Admin approval.
        </p>

        <Link
          href="/admin/curriculum/review"
          className="rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-bold text-white"
        >
          Open Curriculum Review
        </Link>
      </main>
    );
  }

  const report = await getLessonReadiness(lessonId);

  return <LessonPublishingPanel report={report} />;
}

export default function PublishingPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-0 items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading publishing workflow...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
