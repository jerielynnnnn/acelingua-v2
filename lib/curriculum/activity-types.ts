
export const activityTypes = [
  {
    id: "multiple_choice",
    label: "Multiple Choice",
    description: "Select the correct answer.",
    icon: "list-checks",
    category: "quiz",
    requiresAudio: false,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "matching",
    label: "Matching Words",
    description: "Connect words with matching meanings.",
    icon: "git-compare-arrows",
    category: "game",
    requiresAudio: false,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "flip_cards",
    label: "Flip Cards",
    description: "Reveal vocabulary and translations.",
    icon: "layers",
    category: "practice",
    requiresAudio: false,
    supportsImages: true,
    gradable: false,
  },
  {
    id: "word_order",
    label: "Word Jumble",
    description: "Arrange words into the correct sentence.",
    icon: "list-ordered",
    category: "game",
    requiresAudio: false,
    supportsImages: false,
    gradable: true,
  },
  {
    id: "listening",
    label: "Listening Challenge",
    description: "Listen and select the correct meaning.",
    icon: "headphones",
    category: "listening",
    requiresAudio: true,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "fill_blank",
    label: "Fill in the Blank",
    description: "Complete a word or sentence.",
    icon: "text-cursor-input",
    category: "quiz",
    requiresAudio: false,
    supportsImages: false,
    gradable: true,
  },
  {
    id: "picture_match",
    label: "Picture Matching",
    description: "Match vocabulary with pictures.",
    icon: "images",
    category: "game",
    requiresAudio: false,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "speaking",
    label: "Speaking Practice",
    description: "Practice saying a phrase aloud.",
    icon: "mic",
    category: "speaking",
    requiresAudio: true,
    supportsImages: false,
    gradable: false,
  },
  {
    id: "dialogue",
    label: "Dialogue Builder",
    description: "Choose the next conversation response.",
    icon: "messages-square",
    category: "conversation",
    requiresAudio: false,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "true_false",
    label: "True or False",
    description: "Decide whether a statement is correct.",
    icon: "check-circle-2",
    category: "quiz",
    requiresAudio: false,
    supportsImages: false,
    gradable: true,
  },
  {
    id: "memory_match",
    label: "Memory Match",
    description: "Flip cards to find pairs.",
    icon: "brain",
    category: "game",
    requiresAudio: false,
    supportsImages: true,
    gradable: true,
  },
  {
    id: "translation",
    label: "Translation",
    description: "Translate a word or sentence.",
    icon: "languages",
    category: "quiz",
    requiresAudio: false,
    supportsImages: false,
    gradable: true,
  },
  {
    id: "listening_typing",
    label: "Listen and Type",
    description: "Listen and write what you hear.",
    icon: "keyboard",
    category: "listening",
    requiresAudio: true,
    supportsImages: false,
    gradable: true,
  },
] as const;

export type ActivityTypeId =
  (typeof activityTypes)[number]["id"];

export function isActivityType(
  value: string
): value is ActivityTypeId {
  return activityTypes.some((activity) => activity.id === value);
}

export function getActivityType(id: ActivityTypeId) {
  return activityTypes.find((activity) => activity.id === id)!;
}

export const activityCategories = [
  "quiz",
  "game",
  "practice",
  "listening",
  "speaking",
  "conversation",
] as const;

export type ActivityCategory =
  (typeof activityCategories)[number];
