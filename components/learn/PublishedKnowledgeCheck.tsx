
"use client";

import { useEffect, useState } from "react";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  Send,
  Trophy,
} from "lucide-react";

import {
  loadKnowledgeCheckAction,
  submitKnowledgeCheckAction,
  type KnowledgeCheckData,
  type KnowledgeResult,
} from "@/lib/learn/knowledge-check-actions";

type Props = {
  lessonId: string;
  onFinished: (result: KnowledgeResult) => void;
};

export default function PublishedKnowledgeCheck({
  lessonId,
  onFinished,
}: Props) {
  const [data, setData] =
    useState<KnowledgeCheckData | null>(null);

  const [answers, setAnswers] = useState<
    Record<number, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const result = await loadKnowledgeCheckAction(lessonId);

      if (!active) return;

      if (result.ok) {
        setData(result.data);
        setError("");
      } else {
        setError(result.error);
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [lessonId]);

  async function submit() {
    if (
      !data ||
      data.attempted ||
      submitting
    ) {
      return;
    }

    const orderedAnswers = data.questions.map(
      (question) => answers[question.id] ?? ""
    );

    if (orderedAnswers.some((answer) => !answer)) {
      setError("Answer all questions before submitting.");
      return;
    }

    if (
      !window.confirm(
        "Submit your Knowledge Check? " +
        "Only one recorded attempt is allowed."
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await submitKnowledgeCheckAction(
        lessonId,
        orderedAnswers
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setData(result.data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not submit answers."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        className="mt-8 flex flex-col items-center gap-3 py-12 text-[#3558AE]"
      >
        <LoaderCircle
          size={30}
          className="animate-spin"
        />
        <p className="text-sm font-semibold">
          Loading Knowledge Check...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <AlertCircle
          size={34}
          className="mx-auto text-red-500"
        />

        <p className="text-sm text-red-700">
          {error || "Knowledge Check is unavailable."}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-[#ded9fa] px-5 py-3 text-sm font-bold text-[#3558AE]"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (data.attempted) {
    return (
      <div className="mt-8 space-y-5 text-center">
        <Trophy
          size={52}
          className="mx-auto text-[#3558AE]"
        />

        <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
          Knowledge Check Results
        </p>

        <p className="text-5xl font-extrabold text-[#3558AE]">
          {data.score}%
        </p>

        <p className="text-sm text-slate-600">
          {data.correct_count} correct answers out of{" "}
          {data.question_count}
        </p>

        <div className="rounded-2xl bg-[#f5f2ff] p-5 text-sm leading-7 text-slate-600">
          Your score has been saved to Supabase.
          Completing the Knowledge Check does not yet
          award XP or unlock your next lesson.
        </div>

        <button
          type="button"
          onClick={() => onFinished(data)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2A255C]"
        >
          Finish Lesson
          <ArrowRight size={17} />
        </button>
      </div>
    );
  }

  const answered = data.questions.filter(
    (question) => Boolean(answers[question.id])
  ).length;

  return (
    <div className="mt-7 space-y-6">
      <div className="rounded-2xl bg-[#f5f2ff] p-5">
        <div className="flex items-center gap-3">
          <ClipboardCheck
            size={23}
            className="text-[#3558AE]"
          />

          <div>
            <p className="font-extrabold">
              {data.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Answer each question. Your final score
              will be recorded.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#3558AE]">
          <span>
            {answered} of {data.questions.length} answered
          </span>

          <span>
            {data.questions.length} questions
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#3558AE] transition-all"
            style={{
              width: `${
                (answered / data.questions.length) * 100
              }%`,
            }}
          />
        </div>
      </div>

      {data.questions.map((question, questionIndex) => (
        <fieldset
          key={question.id}
          className="rounded-2xl border border-[#e7e2f8] bg-white p-5"
        >
          <legend className="sr-only">
            Question {questionIndex + 1}
          </legend>

          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#3558AE]">
            Question {questionIndex + 1}
          </p>

          <p className="mb-5 text-base font-bold leading-7">
            {question.prompt}
          </p>

          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const selected =
                answers[question.id] === option;

              return (
                <label
                  key={`${question.id}-${optionIndex}`}
                  className={
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition " +
                    (selected
                      ? "border-[#3558AE] bg-[#f0edff] text-[#2A255C]"
                      : "border-[#e7e2f8] bg-white hover:bg-[#f9f7ff]")
                  }
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option}
                    checked={selected}
                    disabled={submitting}
                    onChange={() => {
                      setAnswers((previous) => ({
                        ...previous,
                        [question.id]: option,
                      }));

                      setError("");
                    }}
                    className="h-4 w-4 accent-[#3558AE]"
                  />

                  <span className="min-w-0 flex-1">
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={18}
            className="shrink-0"
          />
          {error}
        </div>
      )}

      <div className="rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-800">
        Review your answers before submitting.
        You will not be able to change them afterward.
      </div>

      <button
        type="button"
        disabled={
          submitting ||
          answered !== data.questions.length
        }
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-4 text-sm font-extrabold text-white transition hover:bg-[#2A255C] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        ) : (
          <Send size={18} />
        )}

        {submitting
          ? "Grading Answers..."
          : "Submit Knowledge Check"}
      </button>
    </div>
  );
}
