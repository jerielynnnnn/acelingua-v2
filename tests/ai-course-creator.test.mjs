import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
const nativeRequire = createRequire(import.meta.url);
function load(relative, stubs = {}, cache = new Map()) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} }; cache.set(file, loadedModule);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/") || name.startsWith(".")) return load((name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name)) + ".ts", stubs, cache);
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", code)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const pure = load("lib/curriculum/course-creator.ts");
function fixture() {
  return { title: "Korean Beginner (A1)", description: "Learn practical everyday Korean.", units: Array.from({ length: 3 }, (_, ui) => ({ title: `Unit ${ui + 1}`, description: "Build beginner communication skills.", lessons: Array.from({ length: 3 }, (_, li) => ({ title: `Lesson ${li + 1}`, description: "Practice useful Korean expressions.", learning_objective: "Use a polite Korean greeting.", difficulty: "beginner", lesson_type: "standard" })) })) };
}
function harness({ deny = false, fail = false, uncertain = false } = {}) {
  const calls = { ai: 0, rpc: [] };
  const actions = load("lib/curriculum/course-creator-actions.ts", {
    "@/lib/auth/roles": { requireAccount: async role => { assert.equal(role, "admin"); if (deny) throw new Error("Denied"); } },
    "./course-generation": { generateCourseWithOllama: async () => { calls.ai++; return fixture(); } },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => { calls.rpc.push(args); return uncertain ? { error: { code: "", message: "Connection interrupted" } } : fail ? { error: { code: "PGRST202" } } : { data: { course_id: "actual-db-id", language_id: "actual-language-id", created_units: 3, created_lessons: 9 } }; } }) },
  });
  return { calls, actions };
}
const request = () => ({ languageCode: "ko", requestId: "11111111-1111-4111-8111-111111111111", reviewed: true, draft: fixture() });
test("strict course validation rejects malformed counts, unknown fields and duplicate titles", () => {
  assert.equal(pure.validateCourseDraft(fixture()).units.flatMap(unit => unit.lessons).length, 9);
  for (const mutate of [draft => draft.units.pop(), draft => draft.units[0].lessons.pop(), draft => { draft.units[0].lessons[0].answer_key = "secret"; }, draft => { draft.units[1].title = draft.units[0].title; }, draft => { draft.units[0].lessons[0].learning_objective = ""; }, draft => { draft.units[0].lessons[0].difficulty = "advanced"; }]) {
    const draft = fixture(); mutate(draft); assert.throws(() => pure.validateCourseDraft(draft));
  }
});
test("objectives and difficulty fit supported persisted description fields", () => {
  const outline = pure.courseOutline(pure.validateCourseDraft(fixture()));
  const lesson = outline.units[0].lessons[0];
  assert.match(lesson.description, /Learning objective: Use a polite Korean greeting/);
  assert.deepEqual(Object.keys(lesson).sort(), ["description", "lesson_type", "title"]);
});
test("all ten real PNG assets exist and Korean maps to kr, not ko", () => {
  assert.equal(pure.selectedLanguage("ko").country, "kr");
  assert.equal(pure.courseLanguages.length, 10);
  for (const language of pure.courseLanguages) assert.equal(fs.readFileSync(`public/icons/flags/${language.country}.png`).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});
test("unauthorized generation and saving stop before AI or database calls", async () => {
  const h = harness({ deny: true });
  await assert.rejects(h.actions.generateCourseAction({ languageCode: "ko", goals: "" }), /Denied/);
  await assert.rejects(h.actions.saveCourseDraftAction(request()), /Denied/);
  assert.equal(h.calls.ai, 0); assert.equal(h.calls.rpc.length, 0);
});
test("invalid selection, oversized goals, unreviewed or invalid drafts never reach services", async () => {
  const h = harness();
  assert.equal((await h.actions.generateCourseAction({ languageCode: "kr", goals: "" })).ok, false);
  assert.equal((await h.actions.generateCourseAction({ languageCode: "ko", goals: "x".repeat(1001) })).ok, false);
  assert.equal((await h.actions.saveCourseDraftAction({ ...request(), reviewed: false })).ok, false);
  assert.equal((await h.actions.saveCourseDraftAction({ ...request(), draft: {} })).ok, false);
  assert.equal(h.calls.ai, 0); assert.equal(h.calls.rpc.length, 0);
});
test("reviewed edited draft uses one atomic RPC and returns its actual ID", async () => {
  const h = harness(); const input = request(); input.draft.units[0].lessons[0].title = "Edited greeting";
  const result = await h.actions.saveCourseDraftAction(input);
  assert.equal(result.data.course_id, "actual-db-id");
  assert.equal(h.calls.rpc[0][0], "create_ai_course_draft");
  assert.equal(h.calls.rpc[0][1].p_draft.units[0].lessons[0].title, "Edited greeting");
});
test("missing RPC produces an actionable migration error", async () => {
  assert.match((await harness({ fail: true }).actions.saveCourseDraftAction(request())).error, /migration/);
});
test("uncertain database responses require identical retry instead of a new save", async () => {
  const h = harness({ uncertain: true });
  const result = await h.actions.saveCourseDraftAction(request());
  assert.equal(result.ok, false); assert.equal(result.retryOnly, true);
  assert.equal(h.calls.rpc[0][1].p_request_id, request().requestId);
});
test("shared Ollama transport rejects offline, timeout and malformed JSON responses", async () => {
  const originalFetch = globalThis.fetch;
  const { generateCourseWithOllama } = load("lib/curriculum/course-generation.ts");
  try {
    for (const [fake, expected] of [
      [async () => { throw new TypeError("fetch failed"); }, /Could not connect to Ollama/],
      [async () => { throw new DOMException("timeout", "TimeoutError"); }, /timed out/],
      [async () => new Response(JSON.stringify({ done: true, message: { content: "not JSON" } })), /invalid JSON/],
      [async () => new Response(JSON.stringify({ done: true, message: { content: JSON.stringify({ units: [] }) } })), /exactly 3 units/],
    ]) {
      globalThis.fetch = fake;
      await assert.rejects(generateCourseWithOllama("ko", ""), expected);
    }
  } finally { globalThis.fetch = originalFetch; }
});
test("real Korean Ollama generation (explicit opt-in; no database writes)", { skip: process.env.ACELINGUA_TEST_OLLAMA !== "1" }, async () => {
  const { generateCourseWithOllama } = load("lib/curriculum/course-generation.ts");
  const draft = await generateCourseWithOllama("ko", "Practical everyday Korean for complete beginners.");
  assert.equal(draft.units.length, 3);
  assert.equal(draft.units.flatMap(unit => unit.lessons).length, 9);
  console.log("Real Ollama result:", draft.title, "—", draft.units.map(unit => unit.title).join(" / "));
});
