"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { selectedLanguage, validateCourseDraft, type CourseDraft } from "./course-creator";
import { generateCourseWithOllama } from "./course-generation";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; retryOnly?: boolean };
export type SavedCourse = { course_id: string; language_id: string; created_units: number; created_lessons: number };
export async function generateCourseAction(input: { languageCode: string; goals: string }): Promise<Result<CourseDraft>> {
  await requireAccount("admin");
  try {
    const language = selectedLanguage(input?.languageCode);
    if (typeof input.goals !== "string" || input.goals.length > 1000) throw new Error("Goals must be text of at most 1,000 characters.");
    return { ok: true, data: await generateCourseWithOllama(language.code, input.goals.trim()) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Course generation failed." }; }
}
export async function saveCourseDraftAction(input: { languageCode: string; requestId: string; reviewed: boolean; draft: unknown }): Promise<Result<SavedCourse>> {
  await requireAccount("admin");
  let dispatched = false;
  try {
    const language = selectedLanguage(input?.languageCode);
    if (input.reviewed !== true) throw new Error("Review and approve this outline before saving.");
    if (typeof input.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error("Invalid save request. Generate a new outline.");
    const draft = validateCourseDraft(input.draft);
    const supabase = await createClient();
    dispatched = true;
    const { data, error } = await supabase.rpc("create_ai_course_draft", { p_request_id: input.requestId, p_language_code: language.code, p_draft: draft });
    if (error) return { ok: false, error: error.code === "PGRST202" ? "The AI Course Creator database migration has not been applied yet." : error.message, retryOnly: !["PGRST202", "22023", "23505", "42501", "P0001"].includes(error.code) };
    if (!data || typeof data.course_id !== "string" || typeof data.language_id !== "string" || data.created_units !== 3 || data.created_lessons !== 9) throw new Error("The database returned an unexpected save receipt. Retry using this same outline.");
    // Cache invalidation must not turn a committed save into an apparent failure.
    try {
      for (const route of ["/admin", "/admin/curriculum", "/admin/curriculum/builder", "/admin/curriculum/roadmap", "/admin/curriculum/ai-course"]) revalidatePath(route);
    } catch { console.error("AI course draft saved; curriculum cache invalidation failed."); }
    return { ok: true, data: data as SavedCourse };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save this draft.", retryOnly: dispatched }; }
}
