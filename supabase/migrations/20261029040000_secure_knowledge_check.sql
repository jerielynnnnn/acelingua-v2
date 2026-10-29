
-- ============================================================
-- ACELINGUA V2 — Phase 3E.5.2
-- Secure Knowledge Check RPCs
--
-- Preserves existing Knowledge Check attempts and rewards.
-- Requires private.can_access_published_lesson(uuid)
-- from Phase 3E.5.1.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Preflight checks
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure(
    'private.can_access_published_lesson(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Install Phase 3E.5.1 before running this migration';
  END IF;

  IF to_regclass(
    'public.learner_knowledge_check_attempts'
  ) IS NULL
  OR to_regclass(
    'public.ai_assessment_drafts'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Knowledge Check tables are missing';
  END IF;
END;
$$;

-- ============================================================
-- 2. Get safe Knowledge Check questions
-- ============================================================

CREATE OR REPLACE FUNCTION
  public.get_published_knowledge_check(
    p_lesson_id uuid
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_questions jsonb;
  v_safe jsonb;
  v_previous record;
  v_question jsonb;
  v_options jsonb;
  v_index integer;
  v_total integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR private.is_admin() THEN
    RAISE EXCEPTION 'Learner access required'
      USING ERRCODE = '42501';
  END IF;

  -- Confirm publication AND sequential unlock.
  IF NOT private.can_access_published_lesson(
    p_lesson_id
  ) THEN
    RAISE EXCEPTION
      'This lesson is unavailable or locked'
      USING ERRCODE = '42501';
  END IF;

  -- Existing attempts are immutable.
  SELECT
    a.question_count,
    a.correct_count,
    a.score,
    a.submitted_at
  INTO v_previous
  FROM public.learner_knowledge_check_attempts a
  WHERE a.lesson_id = p_lesson_id
    AND a.user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempted', true,
      'question_count', v_previous.question_count,
      'correct_count', v_previous.correct_count,
      'score', v_previous.score,
      'submitted_at', v_previous.submitted_at
    );
  END IF;

  -- Current approved/draft assessment source.
  -- Immutable publication-bound assessments will be
  -- handled in the next assessment-versioning step.
  SELECT a.questions
  INTO v_questions
  FROM public.ai_assessment_drafts a
  WHERE a.lesson_id = p_lesson_id
    AND a.status IN ('draft', 'approved')
  LIMIT 1;

  IF jsonb_typeof(v_questions)
    IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION
      'Knowledge Check is not configured';
  END IF;

  v_total := jsonb_array_length(v_questions);

  IF v_total NOT BETWEEN 3 AND 5 THEN
    RAISE EXCEPTION
      'Invalid Knowledge Check question count';
  END IF;

  -- Validate all questions before returning any.
  FOR v_index IN 0..(v_total - 1) LOOP
    v_question := v_questions->v_index;
    v_options := v_question->'options';

    IF jsonb_typeof(v_question)
       IS DISTINCT FROM 'object'
       OR NULLIF(
         btrim(v_question->>'prompt'),
         ''
       ) IS NULL
       OR jsonb_typeof(v_options)
         IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_options) < 2
       OR jsonb_typeof(
         v_question->'correct_answer'
       ) IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION
        'Invalid saved assessment question';
    END IF;

    -- Each option must be a string.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_options) AS option_entry(value)
      WHERE jsonb_typeof(option_entry.value) <> 'string'
    ) THEN
      RAISE EXCEPTION
        'Invalid assessment options';
    END IF;

    -- The stored answer must be among the options.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_options)
        AS option_text(answer)
      WHERE option_text.answer =
        v_question->>'correct_answer'
    ) THEN
      RAISE EXCEPTION
        'Invalid saved answer configuration';
    END IF;
  END LOOP;

  -- Explicit allowlist: NEVER return the raw question.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', (q.ordinality - 1)::integer,
      'prompt', q.value->>'prompt',
      'options', q.value->'options'
    )
    ORDER BY q.ordinality
  )
  INTO v_safe
  FROM jsonb_array_elements(v_questions)
    WITH ORDINALITY AS q(value, ordinality);

  RETURN jsonb_build_object(
    'attempted', false,
    'title', 'Knowledge Check',
    'questions', coalesce(v_safe, '[]'::jsonb)
  );
END;
$function$;

-- ============================================================
-- 3. Submit Knowledge Check with secure grading
-- ============================================================

CREATE OR REPLACE FUNCTION
  public.submit_published_knowledge_check(
    p_lesson_id uuid,
    p_answers jsonb
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_questions jsonb;
  v_total integer;
  v_correct integer := 0;
  v_score integer;
  v_index integer;
  v_question jsonb;
  v_selected text;
  v_expected text;
  v_options jsonb;
  v_rows integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL OR private.is_admin() THEN
    RAISE EXCEPTION 'Learner access required'
      USING ERRCODE = '42501';
  END IF;

  -- Required even when called directly through RPC.
  IF NOT private.can_access_published_lesson(
    p_lesson_id
  ) THEN
    RAISE EXCEPTION
      'This lesson is unavailable or locked'
      USING ERRCODE = '42501';
  END IF;

  -- Deny repeated submissions.
  IF EXISTS (
    SELECT 1
    FROM public.learner_knowledge_check_attempts a
    WHERE a.user_id = v_user_id
      AND a.lesson_id = p_lesson_id
  ) THEN
    RAISE EXCEPTION
      'Knowledge Check already submitted';
  END IF;

  IF jsonb_typeof(p_answers)
     IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION
      'Answers must be an array';
  END IF;

  SELECT a.questions
  INTO v_questions
  FROM public.ai_assessment_drafts a
  WHERE a.lesson_id = p_lesson_id
    AND a.status IN ('draft', 'approved')
  LIMIT 1;

  IF jsonb_typeof(v_questions)
     IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION
      'Knowledge Check not configured';
  END IF;

  v_total := jsonb_array_length(v_questions);

  IF v_total NOT BETWEEN 3 AND 5
     OR jsonb_array_length(p_answers) <> v_total
  THEN
    RAISE EXCEPTION
      'Submit exactly one answer per question';
  END IF;

  -- Validate and grade each question on the server.
  FOR v_index IN 0..(v_total - 1) LOOP
    v_question := v_questions->v_index;
    v_options := v_question->'options';

    IF jsonb_typeof(v_question)
       IS DISTINCT FROM 'object'
       OR NULLIF(
         btrim(v_question->>'prompt'),
         ''
       ) IS NULL
       OR jsonb_typeof(v_options)
         IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_options) < 2
       OR jsonb_typeof(
         v_question->'correct_answer'
       ) IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION
        'Invalid saved assessment question';
    END IF;

    v_expected := v_question->>'correct_answer';

    -- Check the saved answer configuration.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_options)
        AS item(value)
      WHERE jsonb_typeof(item.value) <> 'string'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_options)
        AS option_text(answer)
      WHERE option_text.answer = v_expected
    ) THEN
      RAISE EXCEPTION
        'Invalid saved answer configuration';
    END IF;

    IF jsonb_typeof(p_answers->v_index)
       IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid answer format';
    END IF;

    v_selected := p_answers->>v_index;

    -- Only displayed choices are accepted.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_options)
        AS option_text(answer)
      WHERE option_text.answer = v_selected
    ) THEN
      RAISE EXCEPTION
        'Submitted answer is not a valid option';
    END IF;

    IF v_selected = v_expected THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  v_score := round(
    (v_correct::numeric / v_total::numeric) * 100
  )::integer;

  -- PK (user_id, lesson_id) is the final protection
  -- against simultaneous duplicate submissions.
  INSERT INTO public.learner_knowledge_check_attempts (
    user_id,
    lesson_id,
    submitted_answers,
    question_count,
    correct_count,
    score
  )
  VALUES (
    v_user_id,
    p_lesson_id,
    p_answers,
    v_total,
    v_correct,
    v_score
  )
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Knowledge Check already submitted';
  END IF;

  RETURN jsonb_build_object(
    'attempted', true,
    'question_count', v_total,
    'correct_count', v_correct,
    'score', v_score
  );
END;
$function$;

-- ============================================================
-- 4. Limit who can invoke these functions
-- ============================================================

REVOKE ALL ON FUNCTION
  public.get_published_knowledge_check(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.submit_published_knowledge_check(uuid, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_published_knowledge_check(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.submit_published_knowledge_check(uuid, jsonb)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
