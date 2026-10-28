
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import PublishedLessonPlayer, {
  type PublishedLessonData,
} from "@/components/learn/PublishedLessonPlayer";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{
    lessonId: string;
  }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function LessonContent({ params }: Props) {
  await connection();

  // Require a learner account, not an Admin session.
  await requireAccount("learner");

  const { lessonId } = await params;

  if (!UUID.test(lessonId)) {
    notFound();
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("published_lesson_snapshots")
    .select(
      "lesson_id, lesson_title, course_title, unit_title, learning_content"
    )
    .eq("lesson_id", lessonId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load published lesson: ${error.message}`
    );
  }

  if (!data) {
    notFound();
  }

  // Parse only learner-safe fields from the snapshot.
  // Never load answer_config or assessment answers.
  const content = isObject(data.learning_content)
    ? data.learning_content
    : {};

  const lesson: PublishedLessonData = {
    lessonId: data.lesson_id,
    lessonTitle: data.lesson_title,
    courseTitle: data.course_title,
    unitTitle: data.unit_title,
    vocabulary: getArray(content.vocabulary),
    steps: getArray(content.steps),
    flashcards: getArray(content.flashcards),
  };

  return <PublishedLessonPlayer lesson={lesson} />;
}

export default function PublishedLessonPage(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-[#f9f2ff] px-6 text-center text-[#3558AE]"
        >
          Loading your learning adventure...
        </main>
      }
    >
      <LessonContent {...props} />
    </Suspense>
  );
}
