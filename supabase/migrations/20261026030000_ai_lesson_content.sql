
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id) ON DELETE CASCADE,
  vocabulary_number integer NOT NULL
    CHECK (vocabulary_number > 0),
  phrase text NOT NULL CHECK (length(btrim(phrase)) > 0),
  romanization text NOT NULL DEFAULT '',
  meaning text NOT NULL CHECK (length(btrim(meaning)) > 0),
  usage_note text NOT NULL DEFAULT '',
  language_locale text NOT NULL DEFAULT 'ja-JP',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, vocabulary_number)
);

CREATE TABLE IF NOT EXISTS public.lesson_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number > 0),
  step_type text NOT NULL CHECK (
    step_type IN (
      'introduction',
      'vocabulary',
      'listening',
      'speaking',
      'dialogue',
      'word_order',
      'summary'
    )
  ),
  title text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(content) = 'object'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, step_number)
);

CREATE INDEX IF NOT EXISTS
  idx_lesson_vocabulary_lesson
  ON public.lesson_vocabulary(lesson_id);

CREATE INDEX IF NOT EXISTS
  idx_lesson_steps_lesson
  ON public.lesson_steps(lesson_id);

ALTER TABLE public.lesson_vocabulary
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lesson_steps
  ENABLE ROW LEVEL SECURITY;

-- Draft content remains Admin-only.
-- Learner-safe publishing will be implemented later.

DROP POLICY IF EXISTS
  "Admin manages lesson vocabulary"
  ON public.lesson_vocabulary;

CREATE POLICY "Admin manages lesson vocabulary"
ON public.lesson_vocabulary
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS
  "Admin manages lesson steps"
  ON public.lesson_steps;

CREATE POLICY "Admin manages lesson steps"
ON public.lesson_steps
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE OR REPLACE FUNCTION
  public.save_ai_lesson_package(
    p_lesson_id uuid,
    p_package jsonb
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lesson_status text;
  v_unit_status text;
  v_course_status text;
  v_vocab jsonb;
  v_dialogue jsonb;
  v_practice jsonb;
  v_locale text;
  v_step integer := 0;
  v_index integer := 0;
  v_phrase text;
  v_meaning text;
  v_romanization text;
  v_usage text;
  v_intro text;
  v_summary text;
  v_sentence text;
  v_prompt text;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT private.is_admin())
  THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  -- Lock lesson during import.
  SELECT l.status, u.status, c.status
  INTO v_lesson_status, v_unit_status, v_course_status
  FROM public.lessons l
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.courses c ON c.id = u.course_id
  WHERE l.id = p_lesson_id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF v_lesson_status <> 'draft'
     OR v_unit_status <> 'draft'
     OR v_course_status <> 'draft'
  THEN
    RAISE EXCEPTION
      'Lesson generation requires draft course, unit, and lesson';
  END IF;

  -- No silent overwrites or regeneration.
  IF EXISTS (
    SELECT 1 FROM public.lesson_steps
    WHERE lesson_id = p_lesson_id
  ) OR EXISTS (
    SELECT 1 FROM public.lesson_vocabulary
    WHERE lesson_id = p_lesson_id
  ) THEN
    RAISE EXCEPTION
      'This lesson already has generated content';
  END IF;

  IF jsonb_typeof(p_package) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_package -> 'vocabulary')
        IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_package -> 'vocabulary')
        NOT BETWEEN 3 AND 5
  THEN
    RAISE EXCEPTION 'Invalid generated lesson package';
  END IF;

  v_intro := btrim(p_package ->> 'introduction');
  v_summary := btrim(p_package ->> 'summary');
  v_locale := btrim(p_package ->> 'language_locale');
  v_dialogue := p_package -> 'dialogue';
  v_practice := p_package -> 'practice';

  IF coalesce(length(v_intro),0) NOT BETWEEN 10 AND 1000
     OR coalesce(length(v_summary),0) NOT BETWEEN 10 AND 1000
     OR coalesce(length(v_locale),0) NOT BETWEEN 2 AND 20
     OR jsonb_typeof(v_dialogue) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_practice) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Invalid teaching content';
  END IF;

  IF coalesce(length(btrim(v_dialogue ->> 'speaker_a')),0)
       NOT BETWEEN 1 AND 50
     OR coalesce(length(btrim(v_dialogue ->> 'line_a')),0)
       NOT BETWEEN 1 AND 300
     OR coalesce(length(btrim(v_dialogue ->> 'speaker_b')),0)
       NOT BETWEEN 1 AND 50
     OR coalesce(length(btrim(v_dialogue ->> 'line_b')),0)
       NOT BETWEEN 1 AND 300
     OR coalesce(length(btrim(v_dialogue ->> 'translation')),0)
       NOT BETWEEN 1 AND 600
  THEN
    RAISE EXCEPTION 'Invalid generated dialogue';
  END IF;

  v_prompt := btrim(v_practice ->> 'prompt');
  v_sentence := btrim(v_practice ->> 'sentence');

  IF coalesce(length(v_prompt),0) NOT BETWEEN 5 AND 250
     OR coalesce(length(v_sentence),0) NOT BETWEEN 3 AND 150
     OR array_length(
       regexp_split_to_array(v_sentence, '\s+'),1
     ) NOT BETWEEN 2 AND 10
  THEN
    RAISE EXCEPTION 'Invalid sentence-building practice';
  END IF;

  v_step := v_step + 1;

  INSERT INTO public.lesson_steps (
    lesson_id, step_number, step_type, title, content
  )
  VALUES (
    p_lesson_id, v_step, 'introduction',
    'Welcome to the lesson',
    jsonb_build_object('text',v_intro)
  );

  FOR v_vocab IN
    SELECT value
    FROM jsonb_array_elements(p_package -> 'vocabulary')
  LOOP
    IF jsonb_typeof(v_vocab) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid vocabulary item';
    END IF;

    v_phrase := btrim(v_vocab ->> 'phrase');
    v_meaning := btrim(v_vocab ->> 'meaning');
    v_romanization :=
      btrim(coalesce(v_vocab ->> 'romanization',''));
    v_usage := btrim(coalesce(v_vocab ->> 'usage_note',''));

    IF coalesce(length(v_phrase),0) NOT BETWEEN 1 AND 150
       OR coalesce(length(v_meaning),0) NOT BETWEEN 1 AND 200
       OR length(v_romanization) > 200
       OR length(v_usage) > 500
    THEN
      RAISE EXCEPTION 'Invalid vocabulary fields';
    END IF;

    v_index := v_index + 1;

    INSERT INTO public.lesson_vocabulary (
      lesson_id, vocabulary_number,
      phrase, romanization,
      meaning, usage_note, language_locale
    )
    VALUES (
      p_lesson_id, v_index,
      v_phrase, v_romanization,
      v_meaning, v_usage, v_locale
    );

    v_step := v_step + 1;
    INSERT INTO public.lesson_steps (
      lesson_id, step_number, step_type, title, content
    )
    VALUES (
      p_lesson_id, v_step, 'vocabulary',
      'Learn a new expression',
      jsonb_build_object(
        'phrase',v_phrase,
        'romanization',v_romanization,
        'meaning',v_meaning,
        'usage_note',v_usage,
        'locale',v_locale
      )
    );

    v_step := v_step + 1;
    INSERT INTO public.lesson_steps (
      lesson_id, step_number, step_type, title, content
    )
    VALUES (
      p_lesson_id, v_step, 'listening',
      'Listen carefully',
      jsonb_build_object(
        'phrase',v_phrase,
        'romanization',v_romanization,
        'meaning',v_meaning,
        'locale',v_locale
      )
    );

    v_step := v_step + 1;
    INSERT INTO public.lesson_steps (
      lesson_id, step_number, step_type, title, content
    )
    VALUES (
      p_lesson_id, v_step, 'speaking',
      'Try saying it',
      jsonb_build_object(
        'phrase',v_phrase,
        'romanization',v_romanization,
        'locale',v_locale
      )
    );
  END LOOP;

  v_step := v_step + 1;
  INSERT INTO public.lesson_steps (
    lesson_id, step_number, step_type, title, content
  )
  VALUES (
    p_lesson_id, v_step, 'dialogue',
    'Practice a conversation',
    v_dialogue || jsonb_build_object('locale',v_locale)
  );

  v_step := v_step + 1;
  INSERT INTO public.lesson_steps (
    lesson_id, step_number, step_type, title, content
  )
  VALUES (
    p_lesson_id, v_step, 'word_order',
    'Build a sentence',
    jsonb_build_object(
      'prompt',v_prompt,
      'sentence',v_sentence
    )
  );

  v_step := v_step + 1;
  INSERT INTO public.lesson_steps (
    lesson_id, step_number, step_type, title, content
  )
  VALUES (
    p_lesson_id, v_step, 'summary',
    'Lesson summary',
    jsonb_build_object('text',v_summary)
  );

  RETURN jsonb_build_object(
    'created_vocabulary',v_index,
    'created_steps',v_step
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.save_ai_lesson_package(uuid,jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.save_ai_lesson_package(uuid,jsonb)
TO authenticated;

COMMIT;
