export type StudioMode = "missing" | "improve" | "alternative" | "review";
export type StudioKind = "vocabulary" | "introduction" | "dialogue" | "speaking" | "word_order" | "summary";
export type StudioChange = {
  recordType: "vocabulary" | "step";
  recordId: string | null;
  stepType: string;
  payload: Record<string, unknown>;
  reason: string;
  original: Record<string, unknown> | null;
};
export type StudioProposal = {
  lessonId: string;
  version: string;
  changes: StudioChange[];
  findings: string[];
};
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function text(value: unknown): string { return typeof value === "string" ? value : ""; }
export function normalizePhrase(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
export function matchesTargetScript(value: string, locale: string): boolean {
  if (/^\d+(?:[.,]\d+)?$/.test(value.trim()))
    return true;
  const script = locale.startsWith("ja") ? /[\u3040-\u30ff\u3400-\u9fff]/u : locale.startsWith("ko") ? /[\uac00-\ud7af]/u : locale.startsWith("zh") ? /[\u3400-\u9fff]/u : locale.startsWith("th") ? /[\u0e00-\u0e7f]/u : null;
  return !script || script.test(value);
}
export function boundedText(value: unknown, name: string, min = 0, max = 1000): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export const studioKinds: StudioKind[] = ["vocabulary", "introduction", "dialogue", "speaking", "word_order", "summary"];
// Existing snapshot publishing whitelists introduction.text. Keep its complete teaching
// content there while retaining separate fields for form editing and richer previews.
export function withLearnerIntroduction(input: Record<string, unknown>): Record<string, unknown> {
  const introduction = text(input.introduction ?? input.text).trim();
  const objectives = Array.isArray(input.objectives) ? input.objectives.filter(item => typeof item === "string" && item.trim()) as string[] : [];
  const explanation = text(input.explanation).trim();
  const sections = [introduction, objectives.length ? `Learning objectives:\n${objectives.map(item => `• ${item}`).join("\n")}` : "", explanation];
  return { ...input, introduction, text: sections.filter(Boolean).join("\n\n") };
}
export function validateStudioPayload(kind: StudioKind, input: unknown, locale: string): Record<string, unknown> {
  const p = object(input);
  const required = (name: string, min = 1, max = 1000) => boundedText(p[name], name, min, max);
  const optional = (name: string, max = 1000) => boundedText(p[name] ?? "", name, 0, max);
  for (const key of kind === "dialogue" ? ["line_a", "line_b"] : ["vocabulary", "speaking"].includes(kind) ? ["phrase"] : []) {
    if (!matchesTargetScript(text(p[key]), locale))
      throw new Error(`${key} does not match the target-language script. Review it before saving.`);
  }
  if (kind === "vocabulary")
    return { phrase: required("phrase", 1, 150), romanization: optional("romanization", 200), meaning: required("meaning", 1, 200), usage_note: optional("usage_note", 500) };
  if (kind === "introduction" || kind === "summary") {
    const result: Record<string, unknown> = { text: kind === "introduction" ? boundedText(p.introduction ?? p.text, "Introduction", 10, 1000) : required("text", 10) };
    if (kind === "introduction") {
      if (!Array.isArray(p.objectives) || p.objectives.length < 2 || p.objectives.length > 4)
        throw new Error("Provide two to four learning objectives.");
      result.objectives = p.objectives.map(item => boundedText(item, "Objective", 5, 200));
      result.explanation = required("explanation", 10, 1500);
    }
    return kind === "introduction" ? withLearnerIntroduction(result) : result;
  }
  if (kind === "dialogue") {
    const translationA = required("translation_a", 1, 300);
    const translationB = required("translation_b", 1, 300);
    const a = required("speaker_a", 1, 50), b = required("speaker_b", 1, 50);
    return {
      speaker_a: a, line_a: required("line_a", 1, 300), translation_a: translationA,
      speaker_b: b, line_b: required("line_b", 1, 300), translation_b: translationB,
      translation: `${a}: ${translationA}\n${b}: ${translationB}`, context: optional("context", 500), notes: optional("notes", 500), locale
    };
  }
  if (kind === "speaking")
    return { phrase: required("phrase", 1, 150), romanization: optional("romanization", 200), meaning: optional("meaning", 200), locale };
  const sentence = required("sentence", 3, 150);
  if (sentence.split(/\s+/).length < 2 || sentence.split(/\s+/).length > 10)
    throw new Error("Word order needs two to ten space-separated words; use speaking practice for unsegmented text.");
  return { prompt: required("prompt", 5, 250), sentence };
}
export const studioResponseSchema = {
  type: "object", additionalProperties: false, required: ["suggestions", "findings"],
  properties: {
    findings: { type: "array", maxItems: 12, items: { type: "string" } },
    suggestions: {
      type: "array", maxItems: 14, items: {
        type: "object", additionalProperties: false, required: ["kind", "title", "reason", "fields"],
        properties: { kind: { type: "string", enum: studioKinds }, title: { type: "string" }, reason: { type: "string" }, fields: { type: "object" } },
      }
    },
  },
};

export function buildStudioResponseSchema(kinds: StudioKind[], mode: StudioMode, vocabularyCount: number) {
  const string = (minLength = 0, maxLength = 1000) => ({ type: "string", minLength, maxLength });
  const fields: Record<StudioKind, Record<string, object>> = {
    vocabulary: { phrase: string(1, 150), romanization: string(0, 200), meaning: string(1, 200), usage_note: string(0, 500) },
    introduction: { text: string(10, 1000), objectives: { type: "array", minItems: 2, maxItems: 4, items: string(5, 200) }, explanation: string(10, 1500) },
    dialogue: { speaker_a: string(1, 50), line_a: string(1, 300), translation_a: string(1, 300), speaker_b: string(1, 50), line_b: string(1, 300), translation_b: string(1, 300), context: string(0, 500), notes: string(0, 500) },
    speaking: { phrase: string(1, 150), romanization: string(0, 200), meaning: string(0, 200) },
    word_order: { prompt: string(5, 250), sentence: string(3, 150) },
    summary: { text: string(10, 1000) },
  };
  const onlyVocabulary = mode === "missing" && kinds.length === 1 && kinds[0] === "vocabulary";
  const targeted = mode === "improve" || mode === "alternative";
  return {
    ...studioResponseSchema,
    properties: {
      ...studioResponseSchema.properties,
      suggestions: {
        type: "array", minItems: mode === "review" ? 0 : onlyVocabulary ? Math.max(1, 3 - vocabularyCount) : 1,
        maxItems: mode === "review" ? 0 : targeted ? 1 : onlyVocabulary ? 7 - vocabularyCount : 14,
        items: { anyOf: (kinds.length ? kinds : studioKinds).map(kind => ({
          type: "object", additionalProperties: false, required: ["kind", "title", "reason", "fields"],
          properties: {
            kind: { type: "string", enum: [kind] }, title: string(1, 150), reason: string(5, 500),
            fields: { type: "object", additionalProperties: false, required: Object.keys(fields[kind]), properties: fields[kind] },
          },
        })) },
      },
    },
  };
}
