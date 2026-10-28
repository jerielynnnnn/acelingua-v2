
export type GeneratedLesson = {
  title: string;
  description: string;
  lesson_type: "standard" | "conversation" | "review";
};

export type GeneratedUnit = {
  title: string;
  description: string;
  lessons: GeneratedLesson[];
};

export type GeneratedOutline = {
  units: GeneratedUnit[];
};

export const outlineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["units"],
  properties: {
    units: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "lessons",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          lessons: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "description",
                "lesson_type",
              ],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                lesson_type: {
                  type: "string",
                  enum: [
                    "standard",
                    "conversation",
                    "review",
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

function validText(
  value: unknown,
  maxLength: number
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function validateOutline(
  input: unknown
): GeneratedOutline {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid AI response.");
  }

  const root = input as Record<string, unknown>;

  if (
    !Array.isArray(root.units) ||
    root.units.length < 1 ||
    root.units.length > 3
  ) {
    throw new Error("The outline must contain 1 to 3 units.");
  }

  const unitNames = new Set<string>();

  const units: GeneratedUnit[] = root.units.map(
    (item: unknown) => {
      if (!item || typeof item !== "object") {
        throw new Error("Invalid generated unit.");
      }

      const unit = item as Record<string, unknown>;

      if (
        !validText(unit.title, 150) ||
        !validText(unit.description, 3000) ||
        !Array.isArray(unit.lessons) ||
        unit.lessons.length < 1 ||
        unit.lessons.length > 6
      ) {
        throw new Error("Invalid unit fields.");
      }

      const unitName = unit.title.trim().toLowerCase();

      if (unitNames.has(unitName)) {
        throw new Error("Duplicate unit titles generated.");
      }

      unitNames.add(unitName);

      const lessonNames = new Set<string>();

      const lessons: GeneratedLesson[] = unit.lessons.map(
        (raw: unknown) => {
          if (!raw || typeof raw !== "object") {
            throw new Error("Invalid generated lesson.");
          }

          const lesson = raw as Record<string, unknown>;

          if (
            !validText(lesson.title, 150) ||
            !validText(lesson.description, 3000) ||
            ![
              "standard",
              "conversation",
              "review",
            ].includes(String(lesson.lesson_type))
          ) {
            throw new Error("Invalid lesson fields.");
          }

          const name = lesson.title.trim().toLowerCase();

          if (lessonNames.has(name)) {
            throw new Error("Duplicate lesson titles generated.");
          }

          lessonNames.add(name);

          return {
            title: lesson.title.trim(),
            description: lesson.description.trim(),
            lesson_type:
              lesson.lesson_type as GeneratedLesson["lesson_type"],
          };
        }
      );

      return {
        title: unit.title.trim(),
        description: unit.description.trim(),
        lessons,
      };
    }
  );

  return { units };
}
