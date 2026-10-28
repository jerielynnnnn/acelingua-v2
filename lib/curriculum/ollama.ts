
import "server-only";

import {
  outlineSchema,
  validateOutline,
  type GeneratedOutline,
} from "@/lib/curriculum/ai-outline";

type CurriculumContext = {
  language: string;
  languageCode: string;
  courseTitle: string;
  difficulty: string;
  description: string | null;
  goals: string;
  unitCount: number;
  existingCurriculum: Array<{
    unit: string;
    lessons: string[];
  }>;
};

type OllamaResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export async function generateOutlineWithOllama(
  context: CurriculumContext
): Promise<GeneratedOutline> {
  const configuredUrl =
    process.env.OLLAMA_BASE_URL ?? OLLAMA_BASE_URL;

  // Intentionally restrict connections to local Ollama.
  // Do not allow arbitrary network URLs from the browser.
  const url = new URL(configuredUrl);

  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "11434" ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "OLLAMA_BASE_URL must be http://127.0.0.1:11434 for local development."
    );
  }

  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

  try {
    const response = await fetch(
      new URL("/api/chat", url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: false,
          format: outlineSchema,
          keep_alive: "5m",
          options: {
            temperature: 0.2,
            num_predict: 2400,
          },
          messages: [
            {
              role: "system",
              content:
                "You are an experienced language curriculum designer " +
                "working on ACELINGUA, an AI-powered educational app. " +
                "Create a precise JSON curriculum outline matching " +
                "the provided schema. " +
                "Return exactly the requested number of units. " +
                "Each unit has between 3 and 6 ordered lessons. " +
                "Use measurable learning objectives in descriptions. " +
                "Only use lesson_type standard, conversation, or review. " +
                "Use the correct target language and difficulty. " +
                "Avoid recreating existing units and lessons. " +
                "Generate missing content that logically follows the " +
                "existing curriculum. " +
                "All output is an unapproved draft. " +
                "Do not include markdown code fences.",
            },
            {
              role: "user",
              content: JSON.stringify({
                request: "Generate an educational curriculum outline.",
                ...context,
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(180000),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Ollama model "${model}" was not found. Run: ollama pull ${model}`
        );
      }

      throw new Error(
        `Ollama returned HTTP ${response.status}.`
      );
    }

    const result =
      (await response.json()) as OllamaResponse;

    if (
      !result.done ||
      !result.message ||
      typeof result.message.content !== "string" ||
      !result.message.content.trim()
    ) {
      throw new Error(
        "Ollama did not return a complete curriculum response."
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(result.message.content);
    } catch {
      throw new Error(
        "The local model generated invalid JSON. Try again or request fewer units."
      );
    }

    const outline = validateOutline(parsed);

    if (outline.units.length !== context.unitCount) {
      throw new Error(
        "The local model generated an incorrect number of units. Regenerate the draft."
      );
    }

    return outline;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new Error(
        "Local AI generation timed out. Try generating one unit at a time or using a smaller model."
      );
    }

    if (
      error instanceof TypeError &&
      /fetch failed/i.test(error.message)
    ) {
      throw new Error(
        "Cannot connect to Ollama. Start the Ollama application and check http://127.0.0.1:11434."
      );
    }

    throw error;
  }
}
