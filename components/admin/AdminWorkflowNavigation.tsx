"use client";
import Link from "next/link";
import { lessonHref, workflowStages } from "@/lib/admin/navigation";
const labels: Record<(typeof workflowStages)[number], string> = {
  "lesson-editor": "Content",
  activities: "Activities",
  "assessment-ai": "Assessment",
  consistency: "Consistency",
  review: "Readiness",
  "lesson-preview": "Preview",
  approve: "Approval",
  publish: "Publish",
};
export default function AdminWorkflowNavigation({ slug, lesson }: {
  slug: string;
  lesson: string;
}) {
  const current = slug === "practice-ai" ? "activities" : slug === "lesson-ai" ? "lesson-editor" : slug;
  const index = workflowStages.findIndex(stage => stage === current);
  return <nav aria-label="Lesson workflow" className="mb-6 rounded-2xl border border-[#C7A9D4]/40 bg-white/80 p-4">
    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#3558AE]">Selected lesson workflow</p>
    <ol className="flex flex-wrap gap-2">
      {workflowStages.map((stage, i) => <li key={stage}>
        <Link aria-current={stage === current ? "step" : undefined} href={lessonHref(stage, lesson)} className={`block rounded-lg px-3 py-2 text-xs font-semibold ${stage === current ? "bg-[#3558AE] text-white" : "bg-[#f4f1ff] text-[#2A255C] hover:bg-[#C7A9D4]/40"}`}>
          {i + 1}. {labels[stage]}
        </Link>
      </li>)}
    </ol>
    <div className="mt-3 flex justify-between text-sm font-semibold text-[#3558AE]">
      {index > 0 ? <Link href={lessonHref(workflowStages[index - 1], lesson)}>Previous: {labels[workflowStages[index - 1]]}
      </Link> : <span />}
      {index >= 0 && index < workflowStages.length - 1 && <Link href={lessonHref(workflowStages[index + 1], lesson)}>Next: {labels[workflowStages[index + 1]]}
      </Link>}
    </div>
    <p className="mt-3 text-xs text-slate-500">Opening a step does not complete it. Resolve review issues before approving and publishing.</p>
  </nav>;
}
