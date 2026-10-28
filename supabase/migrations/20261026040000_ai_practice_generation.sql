
BEGIN;

CREATE OR REPLACE FUNCTION
  public.generate_lesson_practice(
    p_lesson_id uuid
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_course_status text;
  v_unit_status text;
  v_lesson_status text;

  v_vocab_count integer;
  v_next_number integer;

  v_pairs jsonb;
  v_first record;
  v_options jsonb;

  v_created integer := 0;
  v_skipped integer := 0;
BEGIN
  -- ADMIN SECURITY
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT private.is_admin())
  THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the selected lesson during generation.
  SELECT
    c.status,
    u.status,
    l.status
  INTO
    v_course_status,
    v_unit_status,
    v_lesson_status
  FROM public.lessons l
  JOIN public.units u
    ON u.id = l.unit_id
  JOIN public.courses c
    ON c.id = u.course_id
  WHERE l.id = p_lesson_id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF v_course_status <> 'draft'
     OR v_unit_status <> 'draft'
     OR v_lesson_status <> 'draft'
  THEN
    RAISE EXCEPTION
      'Practice generation requires a draft lesson';
  END IF;

  -- Require approved-in-studio draft vocabulary.
  SELECT count(*)
  INTO v_vocab_count
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id
    AND status = 'draft';

  IF v_vocab_count < 3 THEN
    RAISE EXCEPTION
      'Generate and save at least three vocabulary entries first';
  END IF;

  -- Determine next activity order.
  SELECT coalesce(max(activity_number), 0) + 1
  INTO v_next_number
  FROM public.lesson_activities
  WHERE lesson_id = p_lesson_id;

  -- Build three vocabulary pairs.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', vocabulary_number,
      'phrase', phrase,
      'meaning', meaning
    )
    ORDER BY vocabulary_number
  )
  INTO v_pairs
  FROM (
    SELECT
      vocabulary_number,
      phrase,
      meaning
    FROM public.lesson_vocabulary
    WHERE lesson_id = p_lesson_id
      AND status = 'draft'
    ORDER BY vocabulary_number
    LIMIT 3
  ) selected_vocabulary;

  -- MATCHING ACTIVITY
  IF NOT EXISTS (
    SELECT 1
    FROM public.lesson_activities
    WHERE lesson_id = p_lesson_id
      AND activity_type = 'matching'
      AND status <> 'archived'
  ) THEN

    INSERT INTO public.lesson_activities (
      lesson_id,
      activity_number,
      title,
      instructions,
      activity_type,
      content,
      answer_config,
      xp_reward,
      status
    )
    VALUES (
      p_lesson_id,
      v_next_number,
      'AI Vocabulary Matching',
      'Match each expression to its English meaning.',
      'matching',
      jsonb_build_object(
        'version', 1,
        'pairs', v_pairs
      ),
      jsonb_build_object(
        'version', 1,
        'pairs', v_pairs
      ),
      10,
      'draft'
    );

    v_next_number := v_next_number + 1;
    v_created := v_created + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- MULTIPLE-CHOICE ACTIVITY
  IF NOT EXISTS (
    SELECT 1
    FROM public.lesson_activities
    WHERE lesson_id = p_lesson_id
      AND activity_type = 'multiple_choice'
      AND status <> 'archived'
  ) THEN

    SELECT
      phrase,
      meaning
    INTO v_first
    FROM public.lesson_vocabulary
    WHERE lesson_id = p_lesson_id
      AND status = 'draft'
    ORDER BY vocabulary_number
    LIMIT 1;

    -- Correct meaning + two distractors
    -- from the same approved vocabulary set.
    SELECT jsonb_agg(meaning ORDER BY vocabulary_number)
    INTO v_options
    FROM (
      SELECT vocabulary_number, meaning
      FROM public.lesson_vocabulary
      WHERE lesson_id = p_lesson_id
        AND status = 'draft'
      ORDER BY vocabulary_number
      LIMIT 3
    ) choices;

    IF jsonb_array_length(v_options) <> 3
       OR (
         SELECT count(DISTINCT lower(btrim(value)))
         FROM jsonb_array_elements_text(v_options)
       ) <> 3
    THEN
      RAISE EXCEPTION
        'Vocabulary meanings must contain three distinct options';
    END IF;

    INSERT INTO public.lesson_activities (
      lesson_id,
      activity_number,
      title,
      instructions,
      activity_type,
      content,
      answer_config,
      xp_reward,
      status
    )
    VALUES (
      p_lesson_id,
      v_next_number,
      'AI Greeting Quiz',
      'Choose the correct meaning of the expression.',
      'multiple_choice',
      jsonb_build_object(
        'version', 1,
        'prompt',
          'What does ' || v_first.phrase || ' mean?',
        'options', v_options
      ),
      jsonb_build_object(
        'version', 1,
        'correct_answer', v_first.meaning
      ),
      10,
      'draft'
    );

    v_created := v_created + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  RETURN jsonb_build_object(
    'created_activities', v_created,
    'skipped_activities', v_skipped
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.generate_lesson_practice(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.generate_lesson_practice(uuid)
TO authenticated;

COMMIT;
