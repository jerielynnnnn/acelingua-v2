
BEGIN;

CREATE TABLE IF NOT EXISTS
public.learner_lesson_completions (
  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id),

  score integer NOT NULL
    CHECK (score BETWEEN 0 AND 100),

  xp_awarded integer NOT NULL DEFAULT 0
    CHECK (xp_awarded >= 0),

  coins_awarded integer NOT NULL DEFAULT 0
    CHECK (coins_awarded >= 0),

  completed_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS
learner_completions_lesson_idx
ON public.learner_lesson_completions (lesson_id);

ALTER TABLE public.learner_lesson_completions
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.learner_lesson_completions
FROM PUBLIC, anon, authenticated;

COMMIT;
