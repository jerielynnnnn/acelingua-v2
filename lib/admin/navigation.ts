export const studioGroups = [
  {
    title: "Curriculum Management", description: "Organize languages, courses, units, and lesson outlines.", tools: [
      ["builder", "Courses & Languages", "Manage languages and course structures."],
      ["roadmap", "Unit & Lesson Roadmap", "Arrange units and lesson sequences."],
      ["ai", "AI Curriculum Generator", "Draft outlines with local Ollama."],
    ]
  },
  {
    title: "Lesson Content", description: "Generate, edit, and preview teaching content.", tools: [
      ["lesson-editor", "Lesson Content Studio", "Create and refine lesson content with AI assistance."],
      ["lesson-ai", "AI Lesson Generator", "Generate teaching content for a selected lesson."],
      ["lesson-preview", "Learner Preview", "Test the selected lesson experience."],
    ]
  },
  {
    title: "Activities & Assessments", description: "Build practice and Knowledge Checks.", tools: [
      ["activities", "Interactive Activity Builder", "Create and edit saved interactive activities."],
      ["practice-ai", "AI Practice Generator", "Generate practice from lesson vocabulary."],
      ["assessment-ai", "AI Assessment Generator", "Draft and review Knowledge Checks."],
    ]
  },
  {
    title: "Quality Assurance & Publishing", description: "Check, approve, and securely publish lessons.", tools: [
      ["consistency", "Lesson Consistency Checker", "Find content inconsistencies."],
      ["review", "Curriculum Review", "Check readiness and resolve blocking issues."],
      ["approve", "Admin Content Approval", "Approve the selected lesson after review."],
      ["publish", "Secure Lesson Publishing", "Publish an approved teaching snapshot."],
    ]
  },
] as const;
export const lessonStages = ["lesson-editor", "lesson-ai", "activities", "practice-ai", "assessment-ai", "consistency", "review", "lesson-preview", "approve", "publish"] as const;
export const workflowStages = ["lesson-editor", "activities", "assessment-ai", "consistency", "review", "lesson-preview", "approve", "publish"] as const;
export function routeTitle(slug: string) {
  return studioGroups.flatMap(group => [...group.tools]).find(tool => tool[0] === slug)?.[1] ?? "Curriculum Studio";
}
export function validLessonId(value?: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function lessonHref(slug: string, lesson?: string | null, context?: {
  course?: string | null;
  unit?: string | null;
}) {
  const query = new URLSearchParams();
  if (validLessonId(lesson))
    query.set("lesson", lesson);
  for (const key of ["course", "unit"] as const)
    if (validLessonId(context?.[key]))
      query.set(key, context[key]!);
  return `/admin/curriculum${slug ? `/${slug}` : ""}${query.size ? `?${query}` : ""}`;
}
