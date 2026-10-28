
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{
    lessonId: string;
  }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Json)
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function PublishedLessonContent({
  params,
}: Props) {
  await connection();

  // Only authenticated learners can view this route.
  // The table's RLS also requires authentication.
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
    throw new Error(error.message);
  }

  if (!data) {
    notFound();
  }

  const content = obj(data.learning_content);
  const vocabulary = arr(content.vocabulary);
  const steps = arr(content.steps);
  const flashcards = arr(content.flashcards);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-5 py-10 text-[#2A255C]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm font-bold text-[#3558AE] hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <header className="mt-8 rounded-3xl border border-white bg-white/95 p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
            {data.course_title} / {data.unit_title}
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            {data.lesson_title}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Learn the vocabulary and expressions in this
            published lesson. Interactive assessments and
            progress rewards will be available in a later phase.
          </p>
        </header>

        {/* VOCABULARY */}

        <section className="mt-7 rounded-3xl border border-white bg-white/95 p-7 shadow-sm">
          <h2 className="text-xl font-extrabold">
            Lesson Vocabulary
          </h2>

          <div className="mt-5 space-y-3">
            {vocabulary.map((raw, index) => {
              const item = obj(raw);

              return (
                <article
                  key={index}
                  className="rounded-2xl bg-[#f5f2ff] p-5"
                >
                  <p
                    className="text-2xl font-extrabold"
                    lang={str(item.locale).split("-")[0] || undefined}
                  >
                    {str(item.phrase)}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#3558AE]">
                    {str(item.romanization)}
                  </p>

                  <p className="mt-3 font-bold">
                    {str(item.meaning)}
                  </p>

                  {str(item.usage_note) && (
                    <p className="mt-2 text-sm text-slate-600">
                      {str(item.usage_note)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* PUBLISHED TEACHING CONTENT */}

        <section className="mt-7 rounded-3xl border border-white bg-white/95 p-7 shadow-sm">
          <h2 className="text-xl font-extrabold">
            Learning Guide
          </h2>

          <div className="mt-5 space-y-4">
            {steps.map((raw, index) => {
              const step = obj(raw);
              const details = obj(step.content);
              const stepType = str(step.type);

              return (
                <article
                  key={index}
                  className="rounded-2xl border border-[#e9e4f8] p-5"
                >
                  <p className="text-xs font-bold uppercase text-[#3558AE]">
                    {stepType.replace(/_/g, " ")}
                  </p>

                  <h3 className="mt-2 text-lg font-extrabold">
                    {str(step.title)}
                  </h3>

                  {["introduction", "summary"].includes(stepType) && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                      {str(details.text)}
                    </p>
                  )}

                  {["vocabulary", "speaking"].includes(stepType) && (
                    <div className="mt-4">
                      <p className="text-xl font-bold">
                        {str(details.phrase)}
                      </p>

                      <p className="mt-2 text-sm text-[#3558AE]">
                        {str(details.romanization)}
                      </p>

                      <p className="mt-2 text-sm font-semibold">
                        {str(details.meaning)}
                      </p>
                    </div>
                  )}

                  {stepType === "dialogue" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl bg-[#f5f2ff] p-4">
                        <p className="text-xs font-bold text-[#3558AE]">
                          {str(details.speaker_a)}
                        </p>
                        <p className="mt-2 font-semibold">
                          {str(details.line_a)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#f5f2ff] p-4">
                        <p className="text-xs font-bold text-[#3558AE]">
                          {str(details.speaker_b)}
                        </p>
                        <p className="mt-2 font-semibold">
                          {str(details.line_b)}
                        </p>
                      </div>

                      <p className="text-sm leading-7 text-slate-600">
                        {str(details.translation)}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* FLASHCARDS — SAFE TO SHOW BOTH SIDES */}

        {flashcards.length > 0 && (
          <section className="mt-7 rounded-3xl border border-white bg-white/95 p-7 shadow-sm">
            <h2 className="text-xl font-extrabold">
              Vocabulary Flashcards
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {flashcards.flatMap((raw, activityIndex) => {
                const activity = obj(raw);

                return arr(activity.cards).map(
                  (cardValue, cardIndex) => {
                    const card = obj(cardValue);

                    return (
                      <div
                        key={`${activityIndex}-${cardIndex}`}
                        className="rounded-2xl bg-[#f5f2ff] p-5"
                      >
                        <p className="text-xl font-extrabold">
                          {str(card.front)}
                        </p>
                        <p className="mt-3 text-sm text-slate-600">
                          {str(card.back)}
                        </p>
                      </div>
                    );
                  }
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-7 rounded-2xl border border-[#ded9f5] bg-white/90 p-5 text-sm leading-7 text-slate-600">
          This is the initial published learning-content view.
          Knowledge Check answers, scored activities, and
          reward transactions are not included.
        </div>
      </div>
    </main>
  );
}

export default function PublishedLessonPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading published lesson...
        </main>
      }
    >
      <PublishedLessonContent {...props} />
    </Suspense>
  );
}
