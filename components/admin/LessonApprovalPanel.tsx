
"use client";
import AdminWorkflowNavigation from "./AdminWorkflowNavigation";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  approveLessonAction,
  loadLessonApprovalAction,
  type ApprovalState,
} from "@/lib/curriculum/lesson-approval-actions";

import type {
  ReadinessReport,
} from "@/lib/curriculum/readiness";

type Props = {
  report: ReadinessReport;
};

const button =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl bg-[#3558AE] px-6 py-3 text-sm " +
  "font-bold text-white transition hover:bg-[#2A255C] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function LessonApprovalPanel({
  report,
}: Props) {
  const [approval, setApproval] =
    useState<ApprovalState | null>(null);

  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const missingPrompt = report.checks.some(
    (check) =>
      check.id === "multiple-choice-prompt" &&
      check.status !== "pass"
  );

  const canApprove =
    report.ready &&
    !missingPrompt &&
    confirmed &&
    notes.trim().length >= 10 &&
    !saving &&
    !loading;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      const result =
        await loadLessonApprovalAction(report.lessonId);

      if (!active) return;

      if (result.ok) {
        setApproval(result.data);
        setNotes(result.data.review_notes ?? "");
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
  }, [report.lessonId]);

  async function approve() {
    if (!canApprove) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await approveLessonAction({
        lessonId: report.lessonId,
        reviewNotes: notes,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const refreshed =
        await loadLessonApprovalAction(report.lessonId);

      if (refreshed.ok) {
        setApproval(refreshed.data);
      }

      setConfirmed(false);
      setSuccess(
        "Lesson approved successfully. Publication " +
        "to learners remains locked."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not approve lesson."
      );
    } finally {
      setSaving(false);
    }
  }

  const approvalStatus = approval?.status ?? "not_approved";

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      {report.lessonId && <AdminWorkflowNavigation slug="approve" lesson={report.lessonId} />}
      <div className="mx-auto max-w-3xl">


        <header className="mt-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#3558AE]">
            <ShieldCheck size={18} />
            Curriculum Studio
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            Admin Content Approval
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Review the completed curriculum and record
            a formal Admin approval before publication.
          </p>
        </header>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#3558AE]">
            {report.courseTitle}
            {" / "}
            {report.unitTitle}
          </p>

          <h2 className="mt-3 text-2xl font-extrabold">
            {report.lessonTitle}
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Vocabulary", report.counts.vocabulary],
              ["Steps", report.counts.steps],
              ["Activities", report.counts.activities],
              ["Assessments", report.counts.assessments],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-xl bg-[#f5f2ff] p-3"
              >
                <p className="text-2xl font-extrabold">
                  {count}
                </p>
                <p className="text-xs text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            {report.ready && !missingPrompt ? (
              <CheckCircle2
                size={20}
                className="text-green-600"
              />
            ) : (
              <AlertCircle
                size={20}
                className="text-amber-600"
              />
            )}

            <p className="text-sm font-bold">
              {report.ready && !missingPrompt
                ? "Structural checks passed"
                : "Corrections required before approval"}
            </p>
          </div>

          {missingPrompt && (
            <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              The saved Vocabulary Quiz needs a specific
              question prompt. A generic instruction is not
              sufficient for final approval.
            </p>
          )}

          <Link
            href={
              "/admin/curriculum/lesson-preview?lesson=" +
              encodeURIComponent(report.lessonId)
            }
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] underline"
          >
            <Eye size={17} />
            Open Complete Learner Preview
          </Link>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck
              size={24}
              className="text-[#3558AE]"
            />

            <h2 className="text-xl font-extrabold">
              Approval Status
            </h2>
          </div>

          {loading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
              Checking approval...
            </p>
          ) : (
            <div className="mt-5 rounded-xl bg-[#f5f2ff] p-4">
              <p className="font-bold capitalize">
                {approvalStatus.replace(/_/g, " ")}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {approvalStatus === "approved"
                  ? "The saved approval still matches the current lesson content."
                  : approvalStatus === "needs_reapproval"
                    ? "The lesson changed after its last approval. Review and approve it again."
                    : "This lesson has not yet received formal Admin approval."}
              </p>

              {approval?.approved_at && (
                <p className="mt-3 text-xs text-slate-500">
                  Last approved:{" "}
                  {new Date(
                    approval.approved_at
                  ).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold">
            Final Review
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            Verify translations, cultural explanations,
            pronunciation examples, answer keys, and
            learner interactions before approving.
          </p>

          <label
            htmlFor="approval-notes"
            className="mt-6 block text-sm font-bold"
          >
            Admin Review Notes
          </label>

          <textarea
            id="approval-notes"
            rows={4}
            maxLength={2000}
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Describe what you reviewed and any corrections made..."
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-[#3558AE]"
          />

          <label className="mt-5 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) =>
                setConfirmed(event.target.checked)
              }
              className="mt-1 h-4 w-4 accent-[#3558AE]"
            />

            <span>
              I have reviewed the lesson, teaching content,
              activities, translations, and assessment answers,
              and I confirm they are suitable for publication
              review.
            </span>
          </label>

          <button
            type="button"
            disabled={!canApprove}
            onClick={approve}
            className={`${button} mt-6`}
          >
            {saving ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2 size={18} />
            )}

            {saving
              ? "Saving Approval..."
              : approvalStatus === "needs_reapproval"
                ? "Reapprove Lesson"
                : "Approve Lesson Content"}
          </button>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800"
            >
              {success}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-[#e0daf5] bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <LockKeyhole
              size={20}
              className="text-[#3558AE]"
            />
            Learner Publishing
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Admin approval is recorded separately from
            publication. Publishing remains disabled until
            secure learner data access and answer checking
            are implemented.
          </p>

          <button
            type="button"
            disabled
            className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
          >
            <LockKeyhole size={17} />
            Publish to Learners — Not Yet Enabled
          </button>
        </section>
      </div>
    </main>
  );
}
