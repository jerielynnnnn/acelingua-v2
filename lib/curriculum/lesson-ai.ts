
import "server-only";

/* =========================================================
   ACELINGUA V2 — AI LESSON GENERATOR
   PHASE 3B.5
========================================================= */

export type VocabularyItem = {
  phrase: string;
  romanization: string;
  meaning: string;
  usage_note: string;
};

export type LessonPackage = {
  introduction: string;
  language_locale: string;
  vocabulary: VocabularyItem[];
  dialogue: {
    speaker_a: string;
    line_a: string;
    speaker_b: string;
    line_b: string;
    translation: string;
  };
  practice: {
    prompt: string;
    sentence: string;
  };
  summary: string;
};

export type LessonContext = {
  courseTitle: string;
  level: string;
  language: string;
  locale: string;
  unitTitle: string;
  lessonTitle: string;
  objective: string;
  instructions: string;
};

/* =========================================================
   CONFIGURATION
========================================================= */

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL?.trim() || "llama3.2:3b";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.trim() ||
  "http://127.0.0.1:11434";

// Local models can take longer, especially on CPU.
const REQUEST_TIMEOUT_MS = 300_000;

// Retry invalid AI content once, but don't repeatedly
// retry connection failures.
const MAX_VALIDATION_ATTEMPTS = 2;

/* =========================================================
   JSON SCHEMA
========================================================= */

const vocabularySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "phrase",
    "romanization",
    "meaning",
    "usage_note",
  ],
  properties: {
    phrase: { type: "string" },
    romanization: { type: "string" },
    meaning: { type: "string" },
    usage_note: { type: "string" },
  },
};

const packageSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "introduction",
    "language_locale",
    "vocabulary",
    "dialogue",
    "practice",
    "summary",
  ],
  properties: {
    introduction: { type: "string" },
    language_locale: { type: "string" },
    vocabulary: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: vocabularySchema,
    },
    dialogue: {
      type: "object",
      additionalProperties: false,
      required: [
        "speaker_a",
        "line_a",
        "speaker_b",
        "line_b",
        "translation",
      ],
      properties: {
        speaker_a: { type: "string" },
        line_a: { type: "string" },
        speaker_b: { type: "string" },
        line_b: { type: "string" },
        translation: { type: "string" },
      },
    },
    practice: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "sentence"],
      properties: {
        prompt: { type: "string" },
        sentence: { type: "string" },
      },
    },
    summary: { type: "string" },
  },
};

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function isText(
  input: unknown,
  min: number,
  max: number
): input is string {
  return (
    typeof input === "string" &&
    input.trim().length >= min &&
    input.length <= max
  );
}

function requiredText(
  input: unknown,
  field: string,
  min: number,
  max: number
): string {
  if (!isText(input, min, max)) {
    throw new Error(
      `${field} must contain ${min}–${max} characters.`
    );
  }

  return input.trim();
}

function optionalText(
  input: unknown,
  field: string,
  max: number
): string {
  if (input === null || input === undefined) {
    return "";
  }

  if (typeof input !== "string" || input.length > max) {
    throw new Error(
      `${field} must be text no longer than ${max} characters.`
    );
  }

  return input.trim();
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/* =========================================================
   VALIDATE COMPLETE LESSON PACKAGE
========================================================= */

export function validateLessonPackage(
  input: unknown
): LessonPackage {
  if (!isRecord(input)) {
    throw new Error("Invalid AI lesson package.");
  }

  const introduction = requiredText(
    input.introduction,
    "Introduction",
    10,
    1000
  );

  const language_locale = requiredText(
    input.language_locale,
    "Language locale",
    2,
    20
  );

  const summary = requiredText(
    input.summary,
    "Summary",
    10,
    1000
  );

  if (
    !Array.isArray(input.vocabulary) ||
    input.vocabulary.length < 3 ||
    input.vocabulary.length > 5
  ) {
    throw new Error(
      "Vocabulary must contain between 3 and 5 entries."
    );
  }

  const vocabulary: VocabularyItem[] =
    input.vocabulary.map((raw, index) => {
      if (!isRecord(raw)) {
        throw new Error(
          `Vocabulary item ${index + 1} must be an object.`
        );
      }

      return {
        phrase: requiredText(
          raw.phrase,
          `Vocabulary ${index + 1}: phrase`,
          1,
          150
        ),
        romanization: optionalText(
          raw.romanization,
          `Vocabulary ${index + 1}: romanization`,
          200
        ),
        meaning: requiredText(
          raw.meaning,
          `Vocabulary ${index + 1}: meaning`,
          1,
          200
        ),
        usage_note: optionalText(
          raw.usage_note,
          `Vocabulary ${index + 1}: usage note`,
          500
        ),
      };
    });

  const normalizedPhrases = vocabulary.map(
    (item) => item.phrase.toLocaleLowerCase()
  );

  if (
    new Set(normalizedPhrases).size !==
    normalizedPhrases.length
  ) {
    throw new Error(
      "The generated vocabulary contains duplicate phrases."
    );
  }

  if (!isRecord(input.dialogue)) {
    throw new Error("Dialogue is missing or invalid.");
  }

  const dialogue = {
    speaker_a: requiredText(
      input.dialogue.speaker_a,
      "First speaker",
      1,
      50
    ),
    line_a: requiredText(
      input.dialogue.line_a,
      "First dialogue line",
      1,
      300
    ),
    speaker_b: requiredText(
      input.dialogue.speaker_b,
      "Second speaker",
      1,
      50
    ),
    line_b: requiredText(
      input.dialogue.line_b,
      "Second dialogue line",
      1,
      300
    ),
    translation: requiredText(
      input.dialogue.translation,
      "Dialogue translation",
      1,
      600
    ),
  };

  if (!isRecord(input.practice)) {
    throw new Error(
      "Sentence-building practice is missing."
    );
  }

  const practice = {
    prompt: requiredText(
      input.practice.prompt,
      "Practice prompt",
      5,
      250
    ),
    sentence: requiredText(
      input.practice.sentence,
      "Practice sentence",
      3,
      150
    ),
  };

  const wordCount = practice.sentence
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 2 || wordCount > 10) {
    throw new Error(
      "The practice sentence must contain 2–10 words."
    );
  }

  return {
    introduction,
    language_locale,
    vocabulary,
    dialogue,
    practice,
    summary,
  };
}

/* =========================================================
   LOCAL OLLAMA URL VALIDATION
========================================================= */

function getOllamaUrl(): URL {
  let url: URL;

  try {
    url = new URL(OLLAMA_BASE_URL);
  } catch {
    throw new Error("OLLAMA_BASE_URL is invalid.");
  }

  const allowedHost =
    url.hostname === "127.0.0.1" ||
    url.hostname === "localhost";

  if (
    url.protocol !== "http:" ||
    !allowedHost ||
    url.port !== "11434" ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "Ollama must use http://127.0.0.1:11434 " +
      "or http://localhost:11434."
    );
  }

  return url;
}

/* =========================================================
   OLLAMA REQUEST
========================================================= */

async function requestLesson(
  context: LessonContext,
  correction?: string
): Promise<unknown> {
  const systemInstructions = [
    "You are a language teacher creating a lesson for ACELINGUA.",
    "Return one valid JSON object matching the provided schema.",
    "The lesson content must be educational and age-appropriate.",
    "Teach the target language specified by the course context.",
    "Use natural, grammatically correct target-language expressions.",
    "Provide between 3 and 5 unique vocabulary entries.",
    "Every vocabulary item must contain:",
    "phrase: a non-empty expression in the target language;",
    "romanization: Latin transliteration if useful, otherwise an empty string;",
    "meaning: a non-empty English translation;",
    "usage_note: a short explanation, or an empty string.",
    "For Japanese, use Japanese writing in phrase and romaji in romanization.",
    "For Thai, use Thai writing in phrase and Latin transliteration.",
    "For French, use French writing and natural English meanings.",
    "Explain the lesson in simple English.",
    "Include a short two-person dialogue using appropriate target-language expressions.",
    "Include one short English sentence-building exercise.",
    "The practice sentence must contain 2 to 10 space-separated words.",
    "Do not leave phrase or meaning fields blank.",
    "Keep every field within the schema's expected length limits.",
    "Do not include Markdown or code fences.",
    correction || "",
  ].join("\n");

  return requestStructuredLessonJSON(context, packageSchema, systemInstructions);
}

// Shared local transport for full packages and section-level Studio proposals.
export async function requestStructuredLessonJSON(context: unknown, schema: object, systemInstructions: string, maxTokens = 2400): Promise<unknown> {
  const baseUrl = getOllamaUrl();
  if (JSON.stringify(context).length > 60000) throw new Error("Lesson context exceeds the AI request limit.");
  const payload = {
    model: OLLAMA_MODEL,
    stream: false,
    format: schema,
    keep_alive: "10m",
    options: {
      temperature: 0.15,
      num_predict: Math.min(maxTokens, 4800),
    },
    messages: [
      {
        role: "system",
        content: systemInstructions,
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
  };

  let response: Response;

  try {
    response = await fetch(
      new URL("/api/chat", baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new Error(
        "Ollama generation timed out. The local model may " +
        "be running slowly or the computer may not have " +
        "enough available resources."
      );
    }

    throw new Error(
      "Could not connect to Ollama at " +
      OLLAMA_BASE_URL +
      ". Check whether the Ollama application is running."
    );
  }

  if (!response.ok) {
    let details = "";

    try {
      const errorResponse = (await response.json()) as {
        error?: string;
      };

      details = errorResponse.error ?? "";
    } catch {
      // Preserve the HTTP status if the response isn't JSON.
    }

    throw new Error(
      `Ollama HTTP ${response.status}. ` +
      (details || "Check the installed model and server.")
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Ollama returned an empty response.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 128000) { await reader.cancel(); throw new Error("Ollama response exceeds the size limit."); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const result = JSON.parse(new TextDecoder().decode(bytes)) as {
    done?: boolean;
    message?: {
      content?: string;
    };
  };

  if (
    result.done !== true ||
    typeof result.message?.content !== "string"
  ) {
    throw new Error(
      "Ollama did not return a completed lesson response."
    );
  }

  try {
    return JSON.parse(result.message.content);
  } catch {
    throw new Error(
      "Ollama returned invalid JSON instead of a lesson package."
    );
  }
}

/* =========================================================
   MAIN GENERATOR
========================================================= */

export async function generateLessonWithOllama(
  context: LessonContext
): Promise<LessonPackage> {
  let lastValidationError = "";

  for (
    let attempt = 1;
    attempt <= MAX_VALIDATION_ATTEMPTS;
    attempt++
  ) {
    let raw: unknown;

    try {
      raw = await requestLesson(
        context,
        lastValidationError
          ? "Previous response was invalid: " +
              lastValidationError +
              ". Correct these issues in the new response."
          : undefined
      );
    } catch (error) {
      // Connection and timeout errors are reported
      // immediately instead of causing repeat requests.
      throw error;
    }

    try {
      const validated = validateLessonPackage(raw);

      // Application controls locale, not the AI.
      return {
        ...validated,
        language_locale: context.locale,
      };
    } catch (error) {
      lastValidationError =
        error instanceof Error
          ? error.message
          : "Invalid generated lesson content.";

      console.warn(
        `[ACELINGUA AI] Validation attempt ${attempt} failed:`,
        lastValidationError
      );
    }
  }

  throw new Error(
    "Ollama couldn't generate a valid lesson after " +
    `${MAX_VALIDATION_ATTEMPTS} attempts. ` +
    `Last issue: ${lastValidationError}`
  );
}
