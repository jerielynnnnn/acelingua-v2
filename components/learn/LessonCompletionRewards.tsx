
"use client";

import { useState } from "react";
import Link from "next/link";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Gift,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

import {
  completeLearnerLessonAction,
  type LessonCompletionResult,
} from "@/lib/learn/progress-actions";

import type {
  KnowledgeResult,
} from "@/lib/learn/knowledge-check-actions";

// ======================================================
// TYPES
// ======================================================

type LessonCompletionRewardsProps = {
  lessonId: string;
  assessment: KnowledgeResult | null;
  onReview: () => void;
};

// ======================================================
// COMPONENT
// ======================================================

export default function LessonCompletionRewards({
  lessonId,
  assessment,
  onReview,
}: LessonCompletionRewardsProps) {
  const [isClaiming, setIsClaiming] = useState(false);

  const [completion, setCompletion] =
    useState<LessonCompletionResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ====================================================
  // CLAIM REWARDS
  // ====================================================

  async function handleClaimRewards() {
    if (isClaiming || completion || !assessment) {
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      const response = await completeLearnerLessonAction(
        lessonId
      );

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setCompletion(response.data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete the lesson."
      );
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <div className="mt-8 space-y-6 text-center">

      {/* =================================================
          COMPLETION HEADER
      ================================================= */}

      <div className="flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f0edff] text-[#3558AE]">
          <Trophy size={42} />
        </div>

        <h3 className="mt-5 text-2xl font-extrabold text-[#2A255C]">
          Great Work, Explorer!
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve reached the end of this lesson.
        </p>
      </div>

      {/* =================================================
          KNOWLEDGE CHECK SCORE
      ================================================= */}

      {assessment ? (
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#3558AE]">
            Knowledge Check Score
          </p>

          <p className="text-5xl font-extrabold tabular-nums text-[#3558AE]">
            {assessment.score}%
          </p>

          <p className="text-sm text-slate-600">
            {assessment.correct_count} correct out of{" "}
            {assessment.question_count} questions
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">
          Complete the Knowledge Check before claiming
          your lesson rewards.
        </div>
      )}

      {/* =================================================
          REWARDS SUCCESS
      ================================================= */}

      {completion ? (
        <div
          role="status"
          className="rounded-2xl border border-green-200 bg-green-50 p-6"
        >
          <CheckCircle2
            size={40}
            className="mx-auto text-green-700"
          />

          <h4 className="mt-4 text-xl font-extrabold text-green-900">
            Lesson Completed!
          </h4>

          <p className="mt-3 text-sm leading-7 text-green-800">
            {completion.alreadyCompleted
              ? "You have already completed this lesson. Your original rewards are shown below."
              : "Your progress and rewards have been saved successfully."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {/* XP REWARD */}

            <div className="rounded-2xl bg-white p-5">
              <Sparkles
                size={27}
                className="mx-auto text-[#3558AE]"
              />

              <p className="mt-3 text-3xl font-extrabold text-[#2A255C]">
                +{completion.xpAwarded}
              </p>

              <p className="mt-2 text-xs font-semibold text-slate-500">
                XP Awarded
              </p>
            </div>

            {/* COIN REWARD */}

            <div className="rounded-2xl bg-white p-5">
              <Coins
                size={27}
                className="mx-auto text-[#B64074]"
              />

              <p className="mt-3 text-3xl font-extrabold text-[#2A255C]">
                +{completion.coinsAwarded}
              </p>

              <p className="mt-2 text-xs font-semibold text-slate-500">
                Coins Awarded
              </p>
            </div>
          </div>

          <Link
            href="/learn/published"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#2A255C]"
          >
            Continue Your Adventure
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        /* =================================================
           CLAIM REWARDS PANEL
        ================================================= */

        <div className="rounded-2xl bg-[#f5f2ff] p-6">
          <Gift
            size={32}
            className="mx-auto text-[#3558AE]"
          />

          <h4 className="mt-4 text-lg font-extrabold text-[#2A255C]">
            Your Rewards Are Ready!
          </h4>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Your Knowledge Check result has been saved.
            Claim your lesson completion rewards to
            update your XP, coins, and learning progress.
          </p>

          <button
            type="button"
            onClick={handleClaimRewards}
            disabled={isClaiming || !assessment}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-4 text-sm font-extrabold text-white transition hover:bg-[#2A255C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isClaiming ? (
              <>
                <LoaderCircle
                  size={19}
                  className="animate-spin"
                />
                Saving Completion...
              </>
            ) : (
              <>
                <Gift size={19} />
                Complete Lesson & Claim Rewards
              </>
            )}
          </button>
        </div>
      )}

      {/* =================================================
          ERROR HANDLING
      ================================================= */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700"
        >
          <AlertCircle
            size={20}
            className="shrink-0"
          />
          <span>{error}</span>
        </div>
      )}

      {/* =================================================
          OTHER ACTIONS
      ================================================= */}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-5 py-3 text-sm font-bold text-[#3558AE] transition hover:bg-[#f5f2ff]"
        >
          <RotateCcw size={17} />
          Review Again
        </button>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#ddd7f6] bg-white px-5 py-3 text-sm font-bold text-[#3558AE] transition hover:bg-[#f5f2ff]"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
