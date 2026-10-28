
BEGIN;

-- One recorded Knowledge Check attempt per learner
-- and published lesson.
CREATE TABLE IF NOT EXISTS
public.learner_knowledge_check_attempts (
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id),
  submitted_answers jsonb NOT NULL,
  question_count integer NOT NULL
    CHECK (question_count BETWEEN 1 AND 20),
  correct_count integer NOT NULL
    CHECK (correct_count >= 0
       AND correct_count <= question_count),
  score integer NOT NULL
    CHECK (score BETWEEN 0 AND 100),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.learner_knowledge_check_attempts
ENABLE ROW LEVEL SECURITY;

-- Learners cannot directly read or write attempts.
-- All access goes through the RPCs below.
REVOKE ALL ON
public.learner_knowledge_check_attempts
FROM PUBLIC, anon, authenticated;

-- =====================================================
-- GET SAFE KNOWLEDGE CHECK
-- =====================================================

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
  v_questions jsonb;
  v_safe jsonb;
  v_previous record;
BEGIN
  IF auth.uid() IS NULL OR private.is_admin() THEN
    RAISE EXCEPTION 'Learner access required'
      USING ERRCODE = '42501';
  END IF;

  -- The lesson must actually be published.
  IF NOT EXISTS (
    SELECT 1
    FROM public.published_lesson_snapshots p
    WHERE p.lesson_id = p_lesson_id
      AND p.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Lesson is not available';
  END IF;

  -- Return a previous result when already submitted.
  SELECT
    question_count,
    correct_count,
    score,
    submitted_at
  INTO v_previous
  FROM public.learner_knowledge_check_attempts
  WHERE lesson_id = p_lesson_id
    AND user_id = auth.uid();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempted', true,
      'question_count', v_previous.question_count,
      'correct_count', v_previous.correct_count,
      'score', v_previous.score,
      'submitted_at', v_previous.submitted_at
    );
  END IF;

  SELECT a.questions
  INTO v_questions
  FROM public.ai_assessment_drafts a
  WHERE a.lesson_id = p_lesson_id
    AND a.status IN ('draft','approved')
  ORDER BY a.id
  LIMIT 1;

  IF jsonb_typeof(v_questions) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Knowledge Check not configured';
  END IF;

  IF jsonb_array_length(v_questions) NOT BETWEEN 3 AND 5
  THEN
    RAISE EXCEPTION 'Invalid Knowledge Check question count';
  END IF;

  -- Return ONLY prompt and options.
  -- correct_answer and explanation stay on the server.
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

REVOKE ALL ON FUNCTION
public.get_published_knowledge_check(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.get_published_knowledge_check(uuid)
TO authenticated;

-- =====================================================
-- GRADE KNOWLEDGE CHECK
-- =====================================================

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
  IF auth.uid() IS NULL OR private.is_admin() THEN
    RAISE EXCEPTION 'Learner access required'
      USING ERRCODE = '42501';
  END IF;

  -- Do not grade withdrawn or unpublished lessons.
  IF NOT EXISTS (
    SELECT 1
    FROM public.published_lesson_snapshots p
    WHERE p.lesson_id = p_lesson_id
      AND p.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Lesson is not available';
  END IF;

  -- One submission only.
  IF EXISTS (
    SELECT 1
    FROM public.learner_knowledge_check_attempts
    WHERE lesson_id = p_lesson_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'Knowledge Check already submitted';
  END IF;

  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Answers must be an array';
  END IF;

  SELECT a.questions
  INTO v_questions
  FROM public.ai_assessment_drafts a
  WHERE a.lesson_id = p_lesson_id
    AND a.status IN ('draft','approved')
  ORDER BY a.id
  LIMIT 1;

  IF jsonb_typeof(v_questions) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Knowledge Check not configured';
  END IF;

  v_total := jsonb_array_length(v_questions);

  IF v_total NOT BETWEEN 3 AND 5
     OR jsonb_array_length(p_answers) <> v_total
  THEN
    RAISE EXCEPTION
      'Submit exactly one answer per question';
  END IF;

  FOR v_index IN 0..(v_total - 1) LOOP
    v_question := v_questions->v_index;
    v_options := v_question->'options';
    v_expected := v_question->>'correct_answer';

    IF jsonb_typeof(v_options) IS DISTINCT FROM 'array'
       OR jsonb_typeof(
         v_question->'correct_answer'
       ) IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION 'Invalid saved assessment question';
    END IF;

    IF jsonb_typeof(p_answers->v_index)
       IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION 'Invalid answer format';
    END IF;

    v_selected := p_answers->>v_index;

    -- Learners can submit only one of the visible options.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_options)
        AS option_value(answer)
      WHERE option_value.answer = v_selected
    ) THEN
      RAISE EXCEPTION
        'Submitted answer is not a valid option';
    END IF;

    -- No answer-key fields are returned to the caller.
    IF v_selected = v_expected THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  v_score := round(
    (v_correct::numeric / v_total::numeric) * 100
  )::integer;

  INSERT INTO public.learner_knowledge_check_attempts (
    user_id,
    lesson_id,
    submitted_answers,
    question_count,
    correct_count,
    score
  )
  VALUES (
    auth.uid(),
    p_lesson_id,
    p_answers,
    v_total,
    v_correct,
    v_score
  )
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Knowledge Check already submitted';
  END IF;

  RETURN jsonb_build_object(
    'attempted', true,
    'question_count', v_total,
    'correct_count', v_correct,
    'score', v_score
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.submit_published_knowledge_check(uuid,jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.submit_published_knowledge_check(uuid,jsonb)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
