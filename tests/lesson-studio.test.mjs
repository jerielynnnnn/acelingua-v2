import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
const nodeRequire = createRequire(import.meta.url);

function load(relative, stubs = {}, cache = new Map()) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} }; cache.set(file, loadedModule);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target + (fs.existsSync(target + ".ts") ? ".ts" : ".tsx"), stubs, cache);
    }
    return nodeRequire(name);
  };
  new Function("require", "module", "exports", js)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const pure = load("lib/curriculum/lesson-studio.ts");
const lessonId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const version = "a".repeat(32);
const greeting = { phrase: "こんにちは", romanization: "konnichiwa", meaning: "Hello", usage_note: "A daytime greeting." };
const summary = { kind: "summary", title: "Greeting review", reason: "Summarizes the saved greetings without repeating the introduction.", fields: { text: "Use the appropriate polite greeting for the time of day." } };
function fixture() {
  return { lesson: { id: lessonId, title: "Daytime greetings", description: "Greet someone politely.", status: "draft" },
    unit: { title: "Greetings" }, course: { title: "Japanese Beginner", difficulty: "beginner" }, language: { name: "Japanese", code: "ja" }, locale: "ja-JP",
    vocabulary: [{ id: recordId, ...greeting, status: "draft" }], steps: [], activities: [], assessment: null,
    previousVocabulary: [{ phrase: "おはよう", meaning: "Good morning" }], editable: true, version, approval: {}, snapshot: null };
}
function harness(options = {}) {
  const source = options.source || fixture();
  const calls = { ai: [], rpc: [], auth: 0 };
  const stubs = {
    "@/lib/auth/roles": { requireAccount: async role => { calls.auth++; assert.equal(role, "admin"); if (options.deny) throw new Error("Learner access denied"); } },
    "./lesson-studio-context": { loadStudioContext: async id => { assert.equal(id, lessonId); return source; } },
    "./lesson-ai": { requestStructuredLessonJSON: async (...args) => { calls.ai.push(args); return options.response || { suggestions: [summary], findings: ["Consider matching greetings to times of day."] }; } },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => { calls.rpc.push(args); return options.dbError ? { error: { message: "Source version conflict" }, data: null } : { error: null, data: { saved: true } }; } }) },
    "next/cache": { revalidatePath: () => {} },
  };
  if (options.realModel) delete stubs["./lesson-ai"];
  const actions = load("lib/curriculum/lesson-studio-actions.ts", stubs);
  return { source, calls, actions };
}
function proposal(changes) { return { lessonId, version, changes, findings: [] }; }
function newSummary() { return { recordType: "step", recordId: null, stepType: "summary", payload: { title: summary.title, content: structuredClone(summary.fields) }, reason: summary.reason, original: null }; }

test("normalization detects Unicode-equivalent duplicate vocabulary", () => {
  assert.equal(pure.normalizePhrase(" Ｈｅｌｌｏ！ "), pure.normalizePhrase("hello"));
});
test("dialogue retains separate English lines and uses application-controlled locale", () => {
  const value = pure.validateStudioPayload("dialogue", { speaker_a: "A", line_a: "こんにちは", translation_a: "Hello", speaker_b: "B", line_b: "こんにちは", translation_b: "Hello", locale: "en-US" }, "ja-JP");
  assert.equal(value.locale, "ja-JP"); assert.equal(value.translation_a, "Hello"); assert.match(value.translation, /A: Hello\nB: Hello/);
  assert.throws(() => pure.validateStudioPayload("dialogue", { ...value, translation_b: "" }, "ja-JP"));
});
test("objectives and explanations survive the existing snapshot text whitelist", () => {
  const result = pure.validateStudioPayload("introduction", { text: "Learn useful daytime greetings.", objectives: ["Recognize a daytime greeting.", "Use a polite greeting in context."], explanation: "Use this greeting during the day with a polite tone." }, "ja-JP");
  assert.match(result.text, /Recognize a daytime greeting/); assert.match(result.text, /polite tone/);
  assert.equal(result.introduction, "Learn useful daytime greetings.");
  assert.deepEqual(pure.validateStudioPayload("introduction", result, "ja-JP"), result);
});
test("unsegmented scripts are rejected for word-order rather than inventing English practice", () => {
  assert.throws(() => pure.validateStudioPayload("word_order", { prompt: "Build the greeting.", sentence: "こんにちは" }, "ja-JP"), /space-separated/);
});
test("oversized fields and invalid objective counts are rejected", () => {
  assert.throws(() => pure.validateStudioPayload("vocabulary", { ...greeting, phrase: "x".repeat(151) }, "ja-JP"));
  assert.throws(() => pure.validateStudioPayload("introduction", { text: "A valid introduction.", objectives: [], explanation: "An explanation." }, "ja-JP"));
});
test("Japanese candidates reject English-only target fields before saving", () => {
  assert.throws(() => pure.validateStudioPayload("vocabulary", { ...greeting, phrase: "Hello there" }, "ja-JP"), /target-language script/);
  assert.equal(pure.matchesTargetScript("こんにちは", "ja-JP"), true);
  assert.equal(pure.matchesTargetScript("12", "ja-JP"), true);
});
test("form preparation preserves legacy dialogue and unknown compatible fields", () => {
  const { finalizeStudioPayload } = load("components/admin/StudioRecordFields.tsx");
  const payload = { title: "A greeting", content: { line_a: "こんにちは", line_b: "こんにちは", translation: "Existing combined translation.", custom_note: "Keep this metadata" } };
  assert.deepEqual(finalizeStudioPayload("step", "dialogue", payload), payload);
  assert.throws(() => finalizeStudioPayload("step", "dialogue", { ...payload, content: { ...payload.content, translation_a: "Hello" } }), /both English translations/);
  const changed = finalizeStudioPayload("step", "dialogue", { ...payload, content: { ...payload.content, speaker_a: "A", speaker_b: "B", translation_a: "Hello", translation_b: "Hello" } });
  assert.equal(changed.content.custom_note, "Keep this metadata"); assert.equal(changed.content.line_a, "こんにちは"); assert.equal(changed.content.translation, "A: Hello\nB: Hello");
});
test("proposal generation is read-only and supplies topic, objectives and earlier vocabulary", async () => {
  const h = harness(); const result = await h.actions.proposeStudioContent({ lessonId, mode: "missing", instructions: "Use polite language." });
  assert.equal(result.ok, true); assert.equal(h.calls.rpc.length, 0);
  const context = h.calls.ai[0][0]; assert.equal(context.lesson.title, "Daytime greetings"); assert.equal(context.locale, "ja-JP");
  assert.equal(context.previousVocabulary[0].phrase, "おはよう"); assert.equal(context.lesson.description, "Greet someone politely.");
});
test("missing-content mode refuses AI replacement of an existing section", async () => {
  const source = fixture(); source.steps = [{ id: recordId, step_type: "summary", content: {}, status: "draft" }];
  const h = harness({ source }); const result = await h.actions.proposeStudioContent({ lessonId, mode: "missing", instructions: "" });
  assert.equal(result.ok, false); assert.equal(h.calls.rpc.length, 0);
});
test("a vocabulary proposal cannot duplicate the selected lesson", async () => {
  const h = harness({ response: { suggestions: [{ kind: "vocabulary", title: "Hello", reason: "Use a daytime greeting.", fields: greeting }], findings: [] } });
  const result = await h.actions.proposeStudioContent({ lessonId, mode: "missing", instructions: "" }); assert.equal(result.ok, false);
});
test("advisory review returns findings with no editable or saved changes", async () => {
  const h = harness({ response: { suggestions: [], findings: ["Verify the politeness of this translation manually."] } });
  const result = await h.actions.proposeStudioContent({ lessonId, mode: "review", instructions: "" });
  assert.equal(result.ok, true); assert.equal(result.data.changes.length, 0); assert.equal(h.calls.rpc.length, 0);
});
test("section improvement is tied to one real record and preserves its original", async () => {
  const h = harness({ response: { suggestions: [{ kind: "vocabulary", title: "Hello", reason: "Clarifies when to use the expression.", fields: { ...greeting, usage_note: "Use during daytime, rather than early morning." } }], findings: [] } });
  const result = await h.actions.proposeStudioContent({ lessonId, mode: "improve", instructions: "", target: { recordType: "vocabulary", recordId } });
  assert.equal(result.ok, true); assert.equal(result.data.changes[0].recordId, recordId); assert.equal(result.data.changes[0].original.usage_note, greeting.usage_note);
  const invalid = await h.actions.proposeStudioContent({ lessonId, mode: "alternative", instructions: "", target: { recordType: "vocabulary", recordId: lessonId } }); assert.equal(invalid.ok, false);
});
test("saving requires explicit review confirmation", async () => {
  const h = harness(); const result = await h.actions.applyStudioProposal({ proposal: proposal([newSummary()]), reviewed: false, confirmRevision: false });
  assert.equal(result.ok, false); assert.equal(h.calls.rpc.length, 0);
});
test("stale source versions cannot overwrite newer lesson content", async () => {
  const source = fixture(); source.version = "b".repeat(32); const h = harness({ source });
  const result = await h.actions.applyStudioProposal({ proposal: proposal([newSummary()]), reviewed: true, confirmRevision: true });
  assert.equal(result.ok, false); assert.equal(h.calls.rpc.length, 0);
});
test("tampered record IDs and unsupported section types never reach the database", async () => {
  for (const change of [{ ...newSummary(), recordId: lessonId }, { ...newSummary(), stepType: "dangerous_sql" }]) {
    const h = harness(); const result = await h.actions.applyStudioProposal({ proposal: proposal([change]), reviewed: true, confirmRevision: false });
    assert.equal(result.ok, false); assert.equal(h.calls.rpc.length, 0);
  }
});
test("edited candidate payloads are validated again before saving", async () => {
  const h = harness(); const bad = newSummary(); bad.payload.content.text = "";
  const result = await h.actions.applyStudioProposal({ proposal: proposal([bad]), reviewed: true, confirmRevision: false }); assert.equal(result.ok, false); assert.equal(h.calls.rpc.length, 0);
});
test("confirmed changes go through one transactional RPC, never publishing", async () => {
  const h = harness(); const result = await h.actions.applyStudioProposal({ proposal: proposal([newSummary()]), reviewed: true, confirmRevision: true });
  assert.equal(result.ok, true); assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.rpc[0][0], "apply_lesson_studio_changes");
  assert.equal(h.calls.rpc[0][1].p_confirm_revision, true); assert.equal(h.calls.rpc[0][1].p_expected_version, version);
});
test("database conflicts are surfaced without a fallback overwrite", async () => {
  const h = harness({ dbError: true }); const result = await h.actions.applyStudioProposal({ proposal: proposal([newSummary()]), reviewed: true, confirmRevision: true });
  assert.equal(result.ok, false); assert.match(result.error, /version conflict/); assert.equal(h.calls.rpc.length, 1);
});
test("learner denial precedes AI generation and saves", async () => {
  const h = harness({ deny: true });
  await assert.rejects(h.actions.proposeStudioContent({ lessonId, mode: "review", instructions: "" }), /Learner access denied/);
  await assert.rejects(h.actions.applyStudioProposal({ proposal: proposal([newSummary()]), reviewed: true, confirmRevision: true }), /Learner access denied/);
  assert.equal(h.calls.ai.length, 0); assert.equal(h.calls.rpc.length, 0);
});
test("SQL boundary contains independent authorization, optimistic locks and no snapshot writes", () => {
  const sql = fs.readFileSync("supabase/migrations/20261028020000_lesson_studio_safe_apply.sql", "utf8");
  assert.match(sql, /auth\.uid\(\) IS NULL OR NOT private\.is_admin\(\)/);
  assert.match(sql, /FOR UPDATE OF l,u,c/); assert.match(sql, /p_expected_version IS DISTINCT FROM private\.lesson_content_fingerprint/);
  assert.match(sql, /p_confirm_revision IS DISTINCT FROM true/);
  assert.doesNotMatch(sql, /(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\.(?:published_lesson_snapshots|lesson_approvals)\b/i);
});
test("shared Ollama transport accepts structured output without writing content", async () => {
  const previous = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url.port, "11434"); assert.equal(url.pathname, "/api/chat");
      const request = JSON.parse(options.body); assert.equal(request.stream, false); assert.equal(request.options.num_predict, 4800);
      return new Response(JSON.stringify({ done: true, message: { content: JSON.stringify({ suggestions: [], findings: [] }) } }));
    };
    const { requestStructuredLessonJSON } = load("lib/curriculum/lesson-ai.ts");
    assert.deepEqual(await requestStructuredLessonJSON({ lesson: "Greetings" }, pure.studioResponseSchema, "Use structured output", 9999), { suggestions: [], findings: [] });
  } finally { global.fetch = previous; }
});
test("shared transport rejects excessive prompt and response sizes", async () => {
  const previous = global.fetch;
  try {
    const { requestStructuredLessonJSON } = load("lib/curriculum/lesson-ai.ts");
    await assert.rejects(requestStructuredLessonJSON({ text: "x".repeat(60001) }, {}, "Draft only"), /request limit/);
    global.fetch = async () => new Response("x".repeat(128001));
    await assert.rejects(requestStructuredLessonJSON({}, {}, "Draft only"), /size limit/);
  } finally { global.fetch = previous; }
});
test("shared transport reports connection and timeout errors without retrying writes", async () => {
  const previous = global.fetch;
  try {
    const { requestStructuredLessonJSON } = load("lib/curriculum/lesson-ai.ts");
    global.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
    await assert.rejects(requestStructuredLessonJSON({}, {}, "Draft only"), /timed out/);
    global.fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(requestStructuredLessonJSON({}, {}, "Draft only"), /Could not connect to Ollama/);
  } finally { global.fetch = previous; }
});

// Explicit opt-in: real local model, artificial topic fixture, no application database calls.
test("real Ollama produces validated numbers vocabulary without saving", { skip: process.env.ACELINGUA_OLLAMA_SMOKE !== "1", timeout: 310000 }, async () => {
  const source = fixture();
  source.lesson.title = "Counting one to three";
  source.lesson.description = "Recognize and pronounce the Japanese words for 1, 2, and 3.";
  source.unit.title = "First numbers";
  source.vocabulary = []; source.previousVocabulary = [];
  const h = harness({ source, realModel: true });
  const result = await h.actions.proposeStudioContent({ lessonId, mode: "missing", focus: "vocabulary", instructions: "Propose exactly three entries: Japanese words for one, two and three. Do not propose other material." });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.changes.length, 3);
  const meanings = result.data.changes.map(change => change.payload.meaning.toLowerCase());
  for (const term of ["one", "two", "three"]) assert(meanings.some(meaning => meaning.includes(term)), "Missing number: " + term);
  assert.equal(h.calls.rpc.length, 0);
  console.log("Real-model unsaved vocabulary: " + JSON.stringify(result.data.changes.map(change => ({ phrase: change.payload.phrase, meaning: change.payload.meaning }))));
});
