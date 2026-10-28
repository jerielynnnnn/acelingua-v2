
BEGIN;

-- =========================================================
-- 1. LEARNER-SAFE PUBLISHED LESSON SNAPSHOTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.published_lesson_snapshots (
  lesson_id uuid PRIMARY KEY
    REFERENCES public.lessons(id) ON DELETE RESTRICT,

  course_id uuid NOT NULL
    REFERENCES public.courses(id),

  unit_id uuid NOT NULL
    REFERENCES public.units(id),

  course_title text NOT NULL,
  unit_title text NOT NULL,
  lesson_title text NOT NULL,

  -- Contains carefully selected teaching fields only.
  -- NEVER store answer_config or correct_answer here.
  learning_content jsonb NOT NULL,

  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'withdrawn')),

  approval_fingerprint text NOT NULL,

  published_by uuid NOT NULL
    REFERENCES auth.users(id),

  published_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX IF NOT EXISTS
  idx_published_lessons_course
ON public.published_lesson_snapshots
(course_id, unit_id, status);

ALTER TABLE public.published_lesson_snapshots
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.published_lesson_snapshots
FROM PUBLIC, anon;

GRANT SELECT ON public.published_lesson_snapshots
TO authenticated;

DROP POLICY IF EXISTS
  "Authenticated users read published lessons"
ON public.published_lesson_snapshots;

CREATE POLICY
  "Authenticated users read published lessons"
ON public.published_lesson_snapshots
FOR SELECT TO authenticated
USING (status = 'published');

-- No client INSERT, UPDATE, or DELETE policies.
-- Changes go through security-definer Admin RPCs.

-- =========================================================
-- 2. PUBLISH AN ADMIN-APPROVED LESSON
-- =========================================================

CREATE OR REPLACE FUNCTION public.publish_approved_lesson(
  p_lesson_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lesson record;
  v_approval record;
  v_current_fingerprint text;

  v_vocabulary jsonb;
  v_steps jsonb;
  v_flashcards jsonb;

  v_vocabulary_count integer;
  v_invalid_count integer;
  v_types text[];

  v_snapshot jsonb;
  v_published_at timestamptz;
BEGIN
  -- Only Administrators may publish.
  IF auth.uid() IS NULL
     OR NOT private.is_admin()
  THEN
    RAISE EXCEPTION
      'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the source lesson for this transaction.
  SELECT
    l.id,
    l.title AS lesson_title,
    l.status AS lesson_status,
    u.id AS unit_id,
    u.title AS unit_title,
    u.status AS unit_status,
    c.id AS course_id,
    c.title AS course_title,
    c.status AS course_status
  INTO v_lesson
  FROM public.lessons l
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.courses c ON c.id = u.course_id
  WHERE l.id = p_lesson_id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF v_lesson.lesson_status <> 'draft'
    OR v_lesson.unit_status <> 'draft'
    OR v_lesson.course_status <> 'draft'
  THEN
    RAISE EXCEPTION
      'Only approved draft curriculum may be published';
  END IF;

  -- Require a recorded Admin approval.
  SELECT
    approved_at,
    content_fingerprint
  INTO v_approval
  FROM public.lesson_approvals
  WHERE lesson_id = p_lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Lesson requires Admin approval before publishing';
  END IF;

  v_current_fingerprint :=
    private.lesson_content_fingerprint(p_lesson_id);

  IF v_current_fingerprint IS DISTINCT FROM
     v_approval.content_fingerprint
  THEN
    RAISE EXCEPTION
      'Lesson content changed after approval. Reapproval required';
  END IF;

  -- Only one snapshot per lesson in this initial version.
  IF EXISTS (
    SELECT 1
    FROM public.published_lesson_snapshots
    WHERE lesson_id = p_lesson_id
  ) THEN
    RAISE EXCEPTION
      'This lesson already has a publishing record. Revision publishing is not yet enabled';
  END IF;

  -- =====================================================
  -- 3. SERVER-SIDE READINESS VALIDATION
  -- =====================================================

  SELECT count(*)
  INTO v_vocabulary_count
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id
    AND status = 'draft';

  IF v_vocabulary_count < 3 THEN
    RAISE EXCEPTION
      'At least three draft vocabulary entries are required';
  END IF;

  SELECT count(*)
  INTO v_invalid_count
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id
    AND status = 'draft'
    AND (
      length(btrim(coalesce(phrase, ''))) = 0
      OR length(btrim(coalesce(meaning, ''))) = 0
      OR length(btrim(coalesce(language_locale, ''))) = 0
    );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Vocabulary contains invalid fields';
  END IF;

  SELECT array_agg(DISTINCT step_type)
  INTO v_types
  FROM public.lesson_steps
  WHERE lesson_id = p_lesson_id
    AND status = 'draft';

  -- Vocabulary audio counts as listening in the preview,
  -- but we retain the original content requirements for
  -- the approved curriculum at this stage.
  IF NOT (
    ARRAY[
      'introduction',
      'vocabulary',
      'speaking',
      'dialogue',
      'summary'
    ]::text[] <@
    coalesce(v_types, ARRAY[]::text[])
  ) THEN
    RAISE EXCEPTION 'Essential lesson steps are missing';
  END IF;

  -- Reject known unsupported dialogue layout.
  SELECT count(*)
  INTO v_invalid_count
  FROM public.lesson_steps
  WHERE lesson_id = p_lesson_id
    AND step_type = 'dialogue'
    AND status = 'draft'
    AND (
      length(btrim(coalesce(content->>'line_a', ''))) = 0
      OR length(btrim(coalesce(content->>'line_b', ''))) = 0
      OR length(btrim(coalesce(content->>'translation', ''))) = 0
    );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Dialogue content is incomplete';
  END IF;

  -- A saved Knowledge Check is required even though
  -- its answer keys will NOT be published in this phase.
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_assessment_drafts
    WHERE lesson_id = p_lesson_id
      AND status IN ('draft', 'approved')
      AND jsonb_typeof(questions) = 'array'
      AND jsonb_array_length(questions) BETWEEN 3 AND 5
  ) THEN
    RAISE EXCEPTION
      'A complete Knowledge Check is required';
  END IF;

  -- =====================================================
  -- 4. PREPARE SAFE VOCABULARY DATA
  -- =====================================================

  SELECT jsonb_agg(
    jsonb_build_object(
      'phrase', phrase,
      'romanization', romanization,
      'meaning', meaning,
      'usage_note', usage_note,
      'locale', language_locale
    )
    ORDER BY vocabulary_number
  )
  INTO v_vocabulary
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id
    AND status = 'draft';

  -- =====================================================
  -- 5. PREPARE SAFE TEACHING STEPS
  -- =====================================================

  -- This first release deliberately excludes standalone
  -- listening repetitions, word-order answer sentences,
  -- and all quiz answer-key data.

  SELECT jsonb_agg(
    jsonb_build_object(
      'type', step_type,
      'title', title,
      'content',
        CASE step_type
          WHEN 'introduction' THEN
            jsonb_build_object(
              'text', content->>'text'
            )

          WHEN 'summary' THEN
            jsonb_build_object(
              'text', content->>'text'
            )

          WHEN 'vocabulary' THEN
            jsonb_build_object(
              'phrase', content->>'phrase',
              'romanization', content->>'romanization',
              'meaning', content->>'meaning',
              'usage_note', content->>'usage_note',
              'locale', content->>'locale'
            )

          WHEN 'speaking' THEN
            jsonb_build_object(
              'phrase', content->>'phrase',
              'romanization', content->>'romanization',
              'meaning', content->>'meaning',
              'locale', content->>'locale'
            )

          WHEN 'dialogue' THEN
            jsonb_build_object(
              'speaker_a', content->>'speaker_a',
              'speaker_b', content->>'speaker_b',
              'line_a', content->>'line_a',
              'line_b', content->>'line_b',
              'translation', content->>'translation',
              'locale', content->>'locale'
            )

          ELSE '{}'::jsonb
        END
    )
    ORDER BY step_number
  )
  INTO v_steps
  FROM public.lesson_steps
  WHERE lesson_id = p_lesson_id
    AND status = 'draft'
    AND step_type IN (
      'introduction',
      'vocabulary',
      'speaking',
      'dialogue',
      'summary'
    );

  -- =====================================================
  -- 6. PUBLISH FLASHCARDS ONLY
  -- =====================================================

  -- Flashcards intentionally show both front and back.
  -- Graded matching, multiple-choice, word-order and
  -- assessment answers are excluded until the secure
  -- server-side grading phase.

  SELECT jsonb_agg(
    jsonb_build_object(
      'type', 'flip_cards',
      'title', title,
      'cards', content->'cards'
    )
    ORDER BY activity_number
  )
  INTO v_flashcards
  FROM public.lesson_activities
  WHERE lesson_id = p_lesson_id
    AND status = 'draft'
    AND activity_type = 'flip_cards'
    AND jsonb_typeof(content->'cards') = 'array';

  v_snapshot := jsonb_build_object(
    'version', 1,
    'vocabulary', coalesce(v_vocabulary, '[]'::jsonb),
    'steps', coalesce(v_steps, '[]'::jsonb),
    'flashcards', coalesce(v_flashcards, '[]'::jsonb),
    'practice_enabled', false,
    'grading_enabled', false
  );

  INSERT INTO public.published_lesson_snapshots (
    lesson_id,
    course_id,
    unit_id,
    course_title,
    unit_title,
    lesson_title,
    learning_content,
    status,
    approval_fingerprint,
    published_by
  )
  VALUES (
    p_lesson_id,
    v_lesson.course_id,
    v_lesson.unit_id,
    v_lesson.course_title,
    v_lesson.unit_title,
    v_lesson.lesson_title,
    v_snapshot,
    'published',
    v_current_fingerprint,
    auth.uid()
  )
  RETURNING published_at INTO v_published_at;

  RETURN jsonb_build_object(
    'published', true,
    'lesson_id', p_lesson_id,
    'published_at', v_published_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.publish_approved_lesson(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.publish_approved_lesson(uuid)
TO authenticated;

-- =========================================================
-- 7. WITHDRAW A PUBLISHED LESSON
-- =========================================================

CREATE OR REPLACE FUNCTION public.withdraw_published_lesson(
  p_lesson_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.is_admin()
  THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.published_lesson_snapshots
  SET
    status = 'withdrawn',
    withdrawn_at = now()
  WHERE lesson_id = p_lesson_id
    AND status = 'published';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Published lesson not found or already withdrawn';
  END IF;

  RETURN jsonb_build_object(
    'withdrawn', true,
    'lesson_id', p_lesson_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.withdraw_published_lesson(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.withdraw_published_lesson(uuid)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
