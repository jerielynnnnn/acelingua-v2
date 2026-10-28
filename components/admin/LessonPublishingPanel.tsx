
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  LoaderCircle,
  LockKeyhole,
  Send,
  ShieldCheck,
  Undo2,
} from "lucide-react";

import type {
  ReadinessReport,
} from "@/lib/curriculum/readiness";

import {
  getPublishingStatusAction,
  publishLessonAction,
  withdrawLessonAction,
  type PublishingStatus,
} from "@/lib/curriculum/lesson-publishing-actions";

type Props = {
  report: ReadinessReport;
};

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-[#3558AE] px-6 py-3 text-sm font-bold text-white " +
  "transition hover:bg-[#2A255C] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-[#ddd7f6] bg-white px-5 py-3 text-sm " +
  "font-bold text-[#3558AE] hover:bg-[#f5f2ff] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function LessonPublishingPanel({
  report,
}: Props) {
  const [state, setState] =
    useState<PublishingStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const lessonId = report.lessonId;

  async function loadStatus() {
    const result =
      await getPublishingStatusAction(lessonId);

    if (result.ok) {
      setState(result.data);
      setError("");
    } else {
      setError(result.error);
    }

    return result.ok;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const result =
        await getPublishingStatusAction(lessonId);

      if (!active) return;

      if (result.ok) {
        setState(result.data);
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

  const missingPrompt = report.checks.some(
    (check) =>
      check.id === "multiple-choice-prompt" &&
      check.status !== "pass"
  );

  const isApproved =
    state?.approvalStatus === "approved";

  const isPublished =
    state?.publicationStatus === "published";

  const canPublish =
    report.ready &&
    !missingPrompt &&
    isApproved &&
    state?.publicationStatus === "not_published" &&
    confirmed &&
    !busy &&
    !loading;

  async function publish() {
    if (!canPublish) return;

    if (
      !window.confirm(
        "Publish this approved lesson's teaching content " +
        "to authenticated learners?"
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await publishLessonAction(lessonId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(result.message);
      setConfirmed(false);
      await loadStatus();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Publication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!isPublished || busy) return;

    if (
      !window.confirm(
        "Withdraw this lesson from learners? " +
        "The saved source curriculum will remain unchanged."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await withdrawLessonAction(lessonId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(result.message);
      await loadStatus();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Withdrawal failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      {lessonId && <AdminWorkflowNavigation slug="publish" lesson={lessonId} />}
      <div className="mx-auto max-w-3xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#3558AE]">
            <ShieldCheck size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            Secure Lesson Publishing
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Publish a learner-safe teaching snapshot after
            verifying Admin approval and curriculum readiness.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#3558AE]">
            {report.courseTitle} / {report.unitTitle}
          </p>

          <h2 className="mt-2 text-2xl font-extrabold">
            {report.lessonTitle}
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f5f2ff] p-4">
              <p className="text-xs text-slate-500">
                Readiness
              </p>
              <p className="mt-2 font-extrabold">
                {report.ready && !missingPrompt
                  ? "Checks passed"
                  : "Needs corrections"}
              </p>
            </div>

            <div className="rounded-xl bg-[#f5f2ff] p-4">
              <p className="text-xs text-slate-500">
                Admin Approval
              </p>

              <p className="mt-2 font-extrabold capitalize">
                {loading
                  ? "Checking..."
                  : (state?.approvalStatus ?? "Unknown")
                      .replace(/_/g, " ")}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#e4def8] p-5">
            <p className="text-xs font-bold uppercase text-[#3558AE]">
              Publication Status
            </p>

            <p className="mt-2 text-xl font-extrabold capitalize">
              {loading
                ? "Checking..."
                : (state?.publicationStatus ?? "Unknown")
                    .replace(/_/g, " ")}
            </p>

            {state?.publishedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Published:{" "}
                {new Date(state.publishedAt).toLocaleString()}
              </p>
            )}
          </div>

          {!isApproved && !loading && (
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle
                size={18}
                className="shrink-0"
              />
              This lesson needs a current Admin approval
              before its teaching content can be published.
            </div>
          )}

          {!report.ready && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Fix the blocking readiness issues before publishing.
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={
                "/admin/curriculum/approve?lesson=" +
                encodeURIComponent(lessonId)
              }
              className={secondary}
            >
              <ShieldCheck size={17} />
              Admin Approval
            </Link>

            <Link
              href={
                "/admin/curriculum/lesson-preview?lesson=" +
                encodeURIComponent(lessonId)
              }
              className={secondary}
            >
              <Eye size={17} />
              Test Full Preview
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white bg-white/95 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <LockKeyhole size={22} className="text-[#3558AE]" />
            Learner Content Release
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            This release includes vocabulary, selected teaching
            steps, pronunciation controls, and flashcards.
            Graded practice and Knowledge Check answer keys
            remain unpublished.
          </p>

          {!isPublished && (
            <>
              <label className="mt-6 flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) =>
                    setConfirmed(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-[#3558AE]"
                />

                <span>
                  I have checked the lesson translations,
                  learning sequence, and teaching content.
                  I understand this publishes a teaching-only
                  snapshot to authenticated learners.
                </span>
              </label>

              <button
                type="button"
                onClick={publish}
                disabled={!canPublish}
                className={`${primary} mt-6`}
              >
                {busy ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}

                {busy
                  ? "Publishing..."
                  : "Publish Teaching Content"}
              </button>
            </>
          )}

          {isPublished && (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800">
                <CheckCircle2
                  size={19}
                  className="shrink-0"
                />
                The teaching snapshot is currently available
                to authenticated learners.
              </div>

              <button
                type="button"
                onClick={withdraw}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Undo2 size={17} />
                Withdraw Lesson
              </button>
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        <p className="mt-7 text-center text-xs text-slate-500">
          Admin approval and publication are separate actions.
          This release does not award learner XP or save progress.
        </p>
      </div>
    </main>
  );
}
