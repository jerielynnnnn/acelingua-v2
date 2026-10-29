export const PREVIEW_KEY = "acelingua:guest-preview:v1";
export type PreviewAnswer = { id: string; answer: string; correct: boolean; kind: "practice" | "quiz" | "game" };
export type GuestPreview = {
  version: 1; source: "guest_preview"; languageId: string; languageCode: string;
  courseId: string; lessonId: string; answers: PreviewAnswer[]; completed: boolean;
  updatedAt: string; ownerId?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validatePreview(value: unknown): GuestPreview | null {
  if (!value || typeof value !== "object") return null;
  const v = value as GuestPreview;
  if (v.version !== 1 || v.source !== "guest_preview"
    || ![v.languageId, v.courseId, v.lessonId].every(id => typeof id === "string" && uuid.test(id))
    || typeof v.languageCode !== "string" || !/^[a-z]{2,3}(-[a-z]+)?$/i.test(v.languageCode)
    || typeof v.completed !== "boolean" || typeof v.updatedAt !== "string" || !Number.isFinite(Date.parse(v.updatedAt))
    || (v.ownerId !== undefined && (typeof v.ownerId !== "string" || !uuid.test(v.ownerId)))
    || !Array.isArray(v.answers) || v.answers.length > 100
    || !v.answers.every(a => a && typeof a.id === "string" && a.id.length <= 100
      && typeof a.answer === "string" && a.answer.length <= 500 && typeof a.correct === "boolean"
      && ["practice", "quiz", "game"].includes(a.kind))
    || new Set(v.answers.map(a => a.id)).size !== v.answers.length) return null;
  if (v.completed && !v.answers.length) return null;
  return { version: 1, source: "guest_preview", languageId: v.languageId, languageCode: v.languageCode,
    courseId: v.courseId, lessonId: v.lessonId, completed: v.completed, updatedAt: v.updatedAt,
    ...(v.ownerId ? { ownerId: v.ownerId } : {}),
    answers: v.answers.map(a => ({ id: a.id, answer: a.answer, correct: a.correct, kind: a.kind })) };
}
export function readPreview(): GuestPreview | null {
  try { return validatePreview(JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "null")); } catch { return null; }
}
export function writePreview(value: GuestPreview) {
  if (!validatePreview(value)) throw new Error("Your preview could not be saved. Please choose your language again.");
  const results = previewResults(value);
  localStorage.setItem(PREVIEW_KEY, JSON.stringify({ ...value, correctAnswers: results.correct,
    quizScore: results.score, temporaryXp: results.xp, temporaryCoins: results.coins }));
}
export function previewResults(value: GuestPreview) {
  const correct = value.answers.filter(a => a.correct).length;
  const quiz = value.answers.filter(a => a.kind === "quiz");
  const score = quiz.length ? Math.round(100 * quiz.filter(a => a.correct).length / quiz.length) : 0;
  return { correct, score, stars: score >= 80 ? 3 : score >= 50 ? 2 : 1, xp: correct * 5, coins: correct * 2 };
}
