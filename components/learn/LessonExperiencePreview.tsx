
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  Layers3,
  Mic,
  RotateCcw,
  Trophy,
  Volume2,
  XCircle,
} from "lucide-react";

export type PreviewStep = {
  id: string;
  step_number: number;
  step_type: string;
  title: string;
  content: Record<string, unknown>;
};

type Props = {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  steps: PreviewStep[];
};

type Pair = {
  id: string;
  phrase: string;
  meaning: string;
};

type Card = {
  front: string;
  back: string;
};

type QuizResult = {
  correct: boolean;
  selected: string;
};

type RecognitionResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechBrowser = Window & {
  SpeechRecognition?: new () => RecognitionInstance;
  webkitSpeechRecognition?: new () => RecognitionInstance;
};

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-[#3558AE] px-5 py-3 text-sm font-bold text-white " +
  "transition hover:bg-[#2A255C] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-[#ddd7f6] bg-white px-5 py-3 " +
  "text-sm font-bold text-[#3558AE] transition " +
  "hover:bg-[#f6f3ff] disabled:cursor-not-allowed " +
  "disabled:opacity-40";

function obj(value: unknown): Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : [];
}

function pairsFrom(value: unknown): Pair[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw, index) => {
    const item = obj(raw);
    const phrase = text(item.phrase);
    const meaning = text(item.meaning);

    return phrase && meaning
      ? [{ id: String(index), phrase, meaning }]
      : [];
  });
}

function cardsFrom(value: unknown): Card[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((raw) => {
    const card = obj(raw);
    const front = text(card.front);
    const back = text(card.back);

    return front && back ? [{ front, back }] : [];
  });
}

function normalize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function reordered<T>(items: T[]): T[] {
  if (items.length < 2) return [...items];
  return [...items.slice(1).reverse(), items[0]];
}

function containsJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function containsLatin(value: string): boolean {
  return /[a-zA-Z]/.test(value);
}

// Audio is exclusively user-triggered.
// Never speak during a lesson step transition.
function speak(
  phrase: string,
  requestedLocale: string
): boolean {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !phrase.trim()
  ) {
    return false;
  }

  window.speechSynthesis.cancel();

  const locale = requestedLocale;
  const utterance = new SpeechSynthesisUtterance(phrase);

  utterance.lang = locale;
  utterance.rate = 0.85;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();

  const matchingVoice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase() === locale.toLowerCase()
    ) ??
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().split("-")[0] ===
        locale.toLowerCase().split("-")[0]
    );

  if (!matchingVoice) {
    // Avoid knowingly using the wrong-language voice.
    // The browser may still provide a system fallback.
    return false;
  }

  utterance.voice = matchingVoice;
  window.speechSynthesis.speak(utterance);

  return true;
}

function speakTarget(
  phrase: string,
  locale: string
): boolean {
  if (locale.startsWith("ja") && !containsJapanese(phrase)) return false;
  return speak(phrase, locale);
}

function AudioButton({
  phrase,
  locale,
  onUnavailable,
  label = "Listen",
  compact = false,
}: {
  phrase: string;
  locale: string;
  onUnavailable: () => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${phrase}`}
      disabled={!phrase}
      onClick={(event) => {
        event.stopPropagation();

        if (!speakTarget(phrase, locale)) {
          onUnavailable();
        }
      }}
      className={
        compact
          ? "inline-flex shrink-0 items-center justify-center rounded-lg border border-[#dcd7fa] bg-white p-2 text-[#3558AE] transition hover:bg-[#efebff] disabled:opacity-40"
          : secondary
      }
    >
      <Volume2 size={compact ? 17 : 18} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

function getDialogueLines(
  content: Record<string, unknown>
) {
  const speakerA = text(content.speaker_a);
  const speakerB = text(content.speaker_b);
  const lineA = text(content.line_a);
  const lineB = text(content.line_b);

  // Older AI lesson packages sometimes placed the
  // Japanese utterance in "speaker_a"/"speaker_b"
  // and the English translation in "line_a"/"line_b".
  // We detect that layout without changing saved data.
  const oldFormatA =
    containsJapanese(speakerA) &&
    containsLatin(lineA) &&
    !containsJapanese(lineA);

  const oldFormatB =
    containsJapanese(speakerB) &&
    containsLatin(lineB) &&
    !containsJapanese(lineB);

  const first = oldFormatA
    ? {
        speaker: "Speaker A",
        target: speakerA,
        english: lineA,
      }
    : {
        speaker: speakerA || "Speaker A",
        target: lineA,
        english: text(content.translation_a),
      };

  const second = oldFormatB
    ? {
        speaker: "Speaker B",
        target: speakerB,
        english: lineB,
      }
    : {
        speaker: speakerB || "Speaker B",
        target: lineB,
        english: text(content.translation_b),
      };

  const translation = text(content.translation);

  return {
    lines: [first, second],
    translation,
    legacy: oldFormatA || oldFormatB,
  };
}

export default function LessonExperiencePreview({
  lessonId,
  lessonTitle,
  courseTitle,
  steps,
}: Props) {
  // Hide duplicate listening steps when the vocabulary
  // already offers a manual Listen button.
  const playableSteps = useMemo(() => {
    return steps.filter(
      (item) => item.step_type !== "listening"
    );
  }, [steps]);

  const [index, setIndex] = useState(0);

  const [flippedCards, setFlippedCards] =
    useState<number[]>([]);
  const [cardIndex, setCardIndex] = useState(0);

  const [selectedLeft, setSelectedLeft] = useState("");
  const [matched, setMatched] = useState<string[]>([]);

  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerChecked, setAnswerChecked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState(false);

  const [chosenWords, setChosenWords] =
    useState<number[]>([]);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);

  const [quizResults, setQuizResults] = useState<
    Record<string, QuizResult>
  >({});

  const recognitionRef =
    useRef<RecognitionInstance | null>(null);

  const step = playableSteps[index];
  const content = step?.content ?? {};
  const type = step?.step_type ?? "";

  const locale = text(content.locale) || "ja-JP";

  const flashcards = cardsFrom(content.cards);
  const pairs = pairsFrom(content.pairs);
  const options = list(content.options);
  const correctAnswer = text(content.correct_answer);

  const dialogue = getDialogueLines(content);

  const wordTiles = useMemo(() => {
    const current = playableSteps[index];

    if (
      !current ||
      current.step_type !== "word_order"
    ) {
      return [];
    }

    const sentence = text(current.content.sentence);

    return reordered(
      sentence
        .split(/\s+/)
        .filter(Boolean)
        .map((word, original) => ({ word, original }))
    );
  }, [index, playableSteps]);

  const quizSteps = playableSteps.filter(
    (item) => item.step_type === "assessment_question"
  );

  const quizCorrect = quizSteps.filter(
    (item) => quizResults[item.id]?.correct
  ).length;

  const quizAnswered = quizSteps.filter(
    (item) => quizResults[item.id] !== undefined
  ).length;

  const quizPercentage = quizSteps.length
    ? Math.round((quizCorrect / quizSteps.length) * 100)
    : 0;

  const isFinished = type === "completion";
  const isLast = index === playableSteps.length - 1;

  const progress = playableSteps.length
    ? Math.round(
        ((index + 1) / playableSteps.length) * 100
      )
    : 0;

  function resetStepState() {
    setSelectedLeft("");
    setMatched([]);
    setSelectedAnswer("");
    setAnswerChecked(false);
    setCorrect(false);
    setFeedback("");
    setChosenWords([]);
    setCardIndex(0);
    setFlippedCards([]);
    setTranscript("");
    setListening(false);

  }

  useEffect(() => {
    // NO AUTOPLAY.
    // Only stop any old speech when a slide changes.
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Speech recognition may already be stopped.
      }

      recognitionRef.current = null;

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [index]);

  function audioUnavailable() {
    setFeedback(
      "No matching voice is available for this language " +
      "on your browser or device. Install the corresponding " +
      "speech voice or use an uploaded audio recording."
    );
  }

  function startSpeechRecognition() {
    const browser = window as SpeechBrowser;

    const Recognition =
      browser.SpeechRecognition ??
      browser.webkitSpeechRecognition;

    if (!Recognition) {
      setFeedback(
        "Speech recognition is unavailable in this browser."
      );
      return;
    }

    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;

      recognition.lang = locale;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const words =
          event.results[0]?.[0]?.transcript ?? "";

        setTranscript(words);

        setFeedback(
          "Speech captured. Recognition is not " +
          "a pronunciation accuracy score."
        );
      };

      recognition.onerror = () => {
        setListening(false);
        setFeedback(
          "Speech recognition failed. Check your microphone."
        );
      };

      recognition.onend = () => setListening(false);

      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setFeedback("Unable to start speech recognition.");
    }
  }

  function checkChoice(value: string) {
    if (answerChecked) return;

    const isCorrect =
      normalize(value) === normalize(correctAnswer);

    setSelectedAnswer(value);
    setCorrect(isCorrect);
    setAnswerChecked(true);

    setFeedback(
      isCorrect
        ? "Correct! Great work."
        : "Incorrect. Review the highlighted correct answer."
    );

    if (type === "assessment_question") {
      setQuizResults((old) => ({
        ...old,
        [step.id]: old[step.id] ?? {
          correct: isCorrect,
          selected: value,
        },
      }));
    }
  }

  function checkMatch(rightId: string) {
    if (!selectedLeft || matched.includes(rightId)) return;

    const left = pairs.find(
      (item) => item.id === selectedLeft
    );

    const right = pairs.find(
      (item) => item.id === rightId
    );

    if (!left || !right) return;

    if (left.id !== right.id) {
      setFeedback("Incorrect match. Try again.");
      setSelectedLeft("");
      return;
    }

    const next = [...matched, left.id];
    setMatched(next);
    setSelectedLeft("");

    setFeedback(
      next.length === pairs.length
        ? "Excellent! All expressions matched."
        : "Correct pair!"
    );
  }

  function checkWordOrder() {
    const attempted = chosenWords
      .map((position) => wordTiles[position]?.word)
      .filter(Boolean)
      .join(" ");

    const expected = text(content.sentence);
    const valid =
      normalize(attempted) === normalize(expected);

    setCorrect(valid);

    setFeedback(
      valid
        ? "Correct sentence!"
        : "Incorrect order. Rearrange the words."
    );
  }

  function goNext() {
    resetStepState();
    setIndex((old) =>
      Math.min(old + 1, playableSteps.length - 1)
    );
  }

  function goBack() {
    resetStepState();
    setIndex((old) => Math.max(0, old - 1));
  }

  function replay() {
    resetStepState();
    setQuizResults({});
    setIndex(0);
  }

  const matchingComplete =
    pairs.length > 0 && matched.length === pairs.length;

  const needsAnswer =
    type === "multiple_choice" ||
    type === "assessment_question";

  const nextDisabled =
    (needsAnswer && !answerChecked) ||
    (type === "matching" && !matchingComplete) ||
    (type === "word_order" && !correct);

  if (!step) {
    return (
      <main className="min-h-0 bg-[#f9f2ff] p-10 text-center">
        No playable lesson content was found.
      </main>
    );
  }

  return (
    <main className="min-h-0 bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] p-0 text-[#2A255C]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">


          <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#3558AE]">
            Admin-only Preview
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white bg-white/95 shadow-xl">
          <header className="border-b border-slate-100 px-6 py-6">
            <p className="text-xs font-bold uppercase text-[#3558AE]">
              {courseTitle}
            </p>

            <h1 className="mt-2 text-xl font-extrabold">
              {lessonTitle}
            </h1>

            <div className="mt-5 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#3558AE] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="text-xs font-bold text-slate-500">
                {index + 1}/{playableSteps.length}
              </span>
            </div>
          </header>

          <section className="min-h-[440px] px-5 py-8 sm:px-9">
            <div className="mx-auto max-w-xl">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#3558AE]">
                  {isFinished ? (
                    <Trophy size={30} />
                  ) : type === "flip_cards" ? (
                    <Layers3 size={30} />
                  ) : type === "assessment_question" ? (
                    <ClipboardCheck size={30} />
                  ) : type === "speaking" ? (
                    <Mic size={30} />
                  ) : type === "matching" ? (
                    <Headphones size={30} />
                  ) : (
                    <BookOpen size={30} />
                  )}
                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#3558AE]">
                  {type.replace(/_/g, " ")}
                </p>

                <h2 className="mt-2 text-2xl font-extrabold">
                  {step.title}
                </h2>
              </div>

              {/* INTRODUCTION AND SUMMARY */}

              {["introduction", "summary"].includes(type) && (
                <div className="mt-8 space-y-5 text-base leading-8 text-slate-600">
                  <p className="whitespace-pre-wrap text-center">{text(content.introduction) || text(content.text)}</p>
                  {type === "introduction" && Array.isArray(content.objectives) && content.objectives.length > 0 && <div className="rounded-2xl bg-[#f5f2ff] p-5"><h3 className="font-bold text-[#2A255C]">What you will learn</h3><ul className="mt-3 list-inside list-disc">{content.objectives.filter((value): value is string => typeof value === "string").map((objective, index) => <li key={index}>{objective}</li>)}</ul></div>}
                  {type === "introduction" && text(content.explanation) && <div className="whitespace-pre-wrap rounded-2xl border border-[#dedcf0] p-5">{text(content.explanation)}</div>}
                </div>
              )}

              {/* VOCABULARY / SPEAKING */}

              {["vocabulary", "speaking"].includes(type) && (
                <div className="mt-8 space-y-4 text-center">
                  <p className="break-words text-3xl font-extrabold">
                    {text(content.phrase)}
                  </p>

                  {text(content.romanization) && (
                    <p className="text-base font-semibold text-[#3558AE]">
                      {text(content.romanization)}
                    </p>
                  )}

                  {/* Show meaning by default */}
                  {text(content.meaning) && (
                    <div className="rounded-2xl bg-[#f5f2ff] p-5">
                      <p className="text-xs font-bold uppercase text-[#3558AE]">
                        English Meaning
                      </p>
                      <p className="mt-2 text-lg font-bold">
                        {text(content.meaning)}
                      </p>

                      {text(content.usage_note) && (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {text(content.usage_note)}
                        </p>
                      )}
                    </div>
                  )}

                  <AudioButton
                    phrase={text(content.phrase)}
                    locale={locale}
                    onUnavailable={audioUnavailable}
                    label="Listen to expression"
                  />

                  {type === "speaking" && (
                    <div className="space-y-3 border-t border-slate-100 pt-5">
                      <p className="text-sm text-slate-500">
                        Say the expression yourself after listening.
                      </p>

                      <button
                        type="button"
                        className={primary}
                        disabled={listening}
                        onClick={startSpeechRecognition}
                      >
                        <Mic size={17} />
                        {listening ? "Listening..." : "Try Speaking"}
                      </button>

                      {transcript && (
                        <div className="rounded-xl bg-[#f5f2ff] p-4 text-sm">
                          Recognized: {transcript}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CONVERSATION */}

              {type === "dialogue" && (
                <div className="mt-8 space-y-4">
                  <p className="text-center text-sm text-slate-500">
                    Read the exchange and tap the speaker
                    to hear each target-language expression.
                  </p>
                  {text(content.context) && <p className="rounded-xl bg-white p-4 text-sm text-slate-600">{text(content.context)}</p>}

                  {dialogue.lines.map((line, i) => {
                    const isJapanese = containsJapanese(line.target);

                    return (
                      <div
                        key={i}
                        className="rounded-2xl bg-[#f5f2ff] p-5"
                      >
                        <p className="text-xs font-bold uppercase text-[#3558AE]">
                          {line.speaker}
                        </p>

                        <div className="mt-3 flex items-start justify-between gap-3">
                          <p
                            lang={isJapanese ? "ja" : undefined}
                            className="break-words text-lg font-extrabold"
                          >
                            {line.target}
                          </p>

                          <AudioButton
                            phrase={line.target}
                            locale={locale}
                            onUnavailable={audioUnavailable}
                            compact
                            label={
                              isJapanese
                                ? "Listen to Japanese"
                                : "Listen to dialogue"
                            }
                          />
                        </div>

                        {line.english && (
                          <div className="mt-3 border-t border-[#e6e1f9] pt-3">
                            <p className="text-xs font-bold text-[#3558AE]">
                              English translation
                            </p>

                            <p
                              lang="en"
                              className="mt-1 text-sm leading-6 text-slate-600"
                            >
                              {line.english}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!dialogue.legacy && dialogue.translation && !dialogue.lines.every(line => line.english) && (
                    <div className="rounded-xl bg-[#f7f6fc] p-4">
                      <p className="text-xs font-bold text-[#3558AE]">
                        Dialogue Translation
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {dialogue.translation}
                      </p>
                    </div>
                  )}

                  {dialogue.legacy && (
                    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <AlertCircle size={19} className="shrink-0" />
                      <p>
                        This saved AI dialogue appears to use
                        expression and translation fields
                        differently. Verify the translations
                        and rewrite unnatural conversation
                        lines in Lesson Content Manager
                        before publishing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* WORD ORDER */}

              {type === "word_order" && (
                <div className="mt-8 space-y-5">
                  <p className="text-center text-sm text-slate-600">
                    {text(content.prompt)}
                  </p>

                  <div className="flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#ddd7f6] p-4">
                    {!chosenWords.length && (
                      <p className="text-sm text-slate-400">
                        Choose words in the correct order
                      </p>
                    )}

                    {chosenWords.map((position) => (
                      <span
                        key={position}
                        className="rounded-lg bg-[#efecff] px-3 py-2 text-sm font-bold"
                      >
                        {wordTiles[position]?.word}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {wordTiles.map((tile, position) => (
                      <button
                        key={tile.original}
                        type="button"
                        className={secondary}
                        disabled={
                          correct || chosenWords.includes(position)
                        }
                        onClick={() => {
                          setChosenWords((old) => [...old, position]);
                          setFeedback("");
                        }}
                      >
                        {tile.word}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      className={secondary}
                      disabled={correct}
                      onClick={() => {
                        setChosenWords([]);
                        setFeedback("");
                      }}
                    >
                      <RotateCcw size={16} />
                      Reset
                    </button>

                    <button
                      type="button"
                      className={primary}
                      disabled={
                        correct ||
                        chosenWords.length !== wordTiles.length
                      }
                      onClick={checkWordOrder}
                    >
                      Check Answer
                    </button>
                  </div>
                </div>
              )}

              {/* FLASHCARDS */}

              {type === "flip_cards" && (
                <div className="mt-8 space-y-5">
                  <p className="text-center text-sm text-slate-500">
                    Tap the card to reveal its meaning.
                    Tap the speaker to hear the expression.
                  </p>

                  {flashcards.length > 0 && (
                    <>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setFlippedCards((old) =>
                              old.includes(cardIndex)
                                ? old.filter(
                                    (n) => n !== cardIndex
                                  )
                                : [...old, cardIndex]
                            )
                          }
                          className="flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border-2 border-[#ddd7fa] bg-gradient-to-br from-[#f6f2ff] to-[#eaf6ff] px-12 py-6 text-center transition hover:shadow-md"
                        >
                          <p className="text-xs font-bold uppercase text-[#3558AE]">
                            {flippedCards.includes(cardIndex)
                              ? "English Meaning"
                              : "Japanese Expression"}
                          </p>

                          <p className="mt-5 break-words text-2xl font-extrabold">
                            {flippedCards.includes(cardIndex)
                              ? flashcards[cardIndex].back
                              : flashcards[cardIndex].front}
                          </p>

                          <p className="mt-5 text-xs text-slate-500">
                            Tap to flip
                          </p>
                        </button>

                        <div className="absolute right-3 top-3">
                          <AudioButton
                            phrase={flashcards[cardIndex].front}
                            locale={locale}
                            onUnavailable={audioUnavailable}
                            compact
                            label="Listen to expression"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className={secondary}
                          disabled={cardIndex === 0}
                          onClick={() =>
                            setCardIndex((old) => old - 1)
                          }
                        >
                          Previous
                        </button>

                        <span className="text-sm font-bold">
                          {cardIndex + 1}/{flashcards.length}
                        </span>

                        <button
                          type="button"
                          className={secondary}
                          disabled={
                            cardIndex === flashcards.length - 1
                          }
                          onClick={() =>
                            setCardIndex((old) => old + 1)
                          }
                        >
                          Next Card
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* MATCHING */}

              {type === "matching" && (
                <div className="mt-8 space-y-5">
                  <p className="text-center text-sm text-slate-600">
                    Listen to a phrase if needed, then
                    match it to the correct meaning.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-3">
                      <p className="text-center text-xs font-bold uppercase text-[#3558AE]">
                        Japanese
                      </p>

                      {pairs.map((pair) => (
                        <div
                          key={pair.id}
                          className={
                            "flex min-h-20 items-center gap-1 rounded-xl border p-2 transition " +
                            (matched.includes(pair.id)
                              ? "border-green-300 bg-green-50"
                              : selectedLeft === pair.id
                                ? "border-[#3558AE] bg-[#eeebff]"
                                : "border-[#ddd7f6] bg-white")
                          }
                        >
                          <button
                            type="button"
                            disabled={matched.includes(pair.id)}
                            onClick={() => {
                              setSelectedLeft(pair.id);
                              setFeedback("");
                            }}
                            className="min-w-0 flex-1 break-words px-1 py-3 text-left text-sm font-bold disabled:text-green-700"
                          >
                            {pair.phrase}
                          </button>

                          <AudioButton
                            phrase={pair.phrase}
                            locale={locale}
                            onUnavailable={audioUnavailable}
                            compact
                            label="Listen to matching word"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <p className="text-center text-xs font-bold uppercase text-[#3558AE]">
                        English Meaning
                      </p>

                      {reordered(pairs).map((pair) => (
                        <button
                          type="button"
                          key={pair.id}
                          disabled={
                            matched.includes(pair.id) ||
                            !selectedLeft
                          }
                          onClick={() => checkMatch(pair.id)}
                          className={
                            "min-h-20 w-full rounded-xl border p-3 text-sm font-semibold transition " +
                            (matched.includes(pair.id)
                              ? "border-green-300 bg-green-50 text-green-700"
                              : "border-[#ddd7f6] bg-white hover:bg-[#f6f3ff]")
                          }
                        >
                          {pair.meaning}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-center text-sm font-bold text-[#3558AE]">
                    {matched.length}/{pairs.length} matched
                  </p>
                </div>
              )}

              {/* MULTIPLE CHOICE & ASSESSMENTS */}

              {["multiple_choice", "assessment_question"].includes(
                type
              ) && (
                <div className="mt-8 space-y-4">
                  {type === "assessment_question" && (
                    <p className="text-center text-xs font-bold text-[#3558AE]">
                      Knowledge Check · Question{" "}
                      {quizSteps.findIndex(
                        (item) => item.id === step.id
                      ) + 1}{" "}
                      of {quizSteps.length}
                    </p>
                  )}

                  <p className="text-center text-lg font-bold">
                    {text(content.prompt) ||
                      "Choose the correct answer."}
                  </p>

                  {options.map((option, i) => {
                    const selected = selectedAnswer === option;
                    const isCorrectOption =
                      normalize(option) ===
                      normalize(correctAnswer);

                    return (
                      <button
                        type="button"
                        key={`${i}-${option}`}
                        disabled={answerChecked}
                        onClick={() => checkChoice(option)}
                        className={
                          "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-semibold transition " +
                          (answerChecked && isCorrectOption
                            ? "border-green-300 bg-green-50 text-green-800"
                            : answerChecked && selected
                              ? "border-red-300 bg-red-50 text-red-800"
                              : "border-[#ddd7f6] bg-white hover:bg-[#f7f5ff]")
                        }
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeebff] text-[#3558AE]">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {option}
                      </button>
                    );
                  })}

                  {answerChecked && text(content.explanation) && (
                    <div className="rounded-xl bg-[#f5f2ff] p-4 text-sm leading-6">
                      <p className="font-bold">Explanation</p>
                      <p className="mt-2">
                        {text(content.explanation)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* COMPLETION */}

              {isFinished && (
                <div className="mt-8 space-y-5 text-center">
                  <Trophy
                    size={58}
                    className="mx-auto text-[#3558AE]"
                  />

                  <h3 className="text-2xl font-extrabold">
                    Lesson Preview Completed!
                  </h3>

                  {quizSteps.length > 0 ? (
                    <>
                      <p className="text-5xl font-extrabold text-[#3558AE]">
                        {quizPercentage}%
                      </p>

                      <p className="text-sm text-slate-600">
                        {quizCorrect} correct out of{" "}
                        {quizSteps.length} Knowledge Check questions
                      </p>

                      <p className="text-xs text-slate-500">
                        {quizAnswered} questions attempted
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No Knowledge Check is attached.
                    </p>
                  )}

                  <div className="rounded-2xl bg-[#f4f1ff] p-5 text-sm leading-7">
                    This is an Admin preview only.
                    No XP, coins, streaks, or learner progress
                    have been saved.
                  </div>

                  <button
                    type="button"
                    className={primary}
                    onClick={replay}
                  >
                    <RotateCcw size={18} />
                    Replay Lesson
                  </button>
                </div>
              )}

              {/* FEEDBACK */}

              {feedback && (
                <div
                  role="status"
                  className={
                    "mt-7 flex items-start gap-2 rounded-xl p-4 text-sm font-semibold " +
                    (correct || matchingComplete
                      ? "bg-green-50 text-green-800"
                      : "bg-[#f2efff] text-[#3558AE]")
                  }
                >
                  {correct || matchingComplete ? (
                    <CheckCircle2
                      size={19}
                      className="shrink-0"
                    />
                  ) : (
                    <XCircle
                      size={19}
                      className="shrink-0"
                    />
                  )}
                  {feedback}
                </div>
              )}
            </div>
          </section>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-6">
            <button
              type="button"
              disabled={index === 0}
              onClick={goBack}
              className={secondary}
            >
              <ArrowLeft size={17} />
              Previous step
            </button>

            {!isLast ? (
              <button
                type="button"
                disabled={nextDisabled}
                onClick={goNext}
                className={primary}
              >
                Continue
                <ArrowRight size={17} />
              </button>
            ) : (
              <Link
                href={
                  "/admin/curriculum/review?lesson=" +
                  encodeURIComponent(lessonId)
                }
                className={secondary}
              >
                Return to Review
              </Link>
            )}
          </footer>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          ACELINGUA · Admin Preview · Draft Content ·
          No Real Rewards
        </p>
      </div>
    </main>
  );
}
