
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_approvals (
  lesson_id uuid PRIMARY KEY
    REFERENCES public.lessons(id) ON DELETE CASCADE,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  content_fingerprint text NOT NULL,
  review_notes text NOT NULL DEFAULT ''
);

ALTER TABLE public.lesson_approvals
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lesson_approvals FROM anon;
GRANT SELECT ON public.lesson_approvals TO authenticated;

DROP POLICY IF EXISTS "Admins view lesson approvals"
ON public.lesson_approvals;

CREATE POLICY "Admins view lesson approvals"
ON public.lesson_approvals
FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));

-- Compute a signature of the complete reviewed content.
-- This detects edits to vocabulary, steps, activities,
-- assessment questions and course/unit/lesson metadata.

CREATE OR REPLACE FUNCTION private.lesson_content_fingerprint(
  p_lesson_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT md5(
    coalesce((
      SELECT to_jsonb(l)::text
      FROM public.lessons l
      WHERE l.id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT to_jsonb(u)::text
      FROM public.lessons l
      JOIN public.units u ON u.id = l.unit_id
      WHERE l.id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT to_jsonb(c)::text
      FROM public.lessons l
      JOIN public.units u ON u.id = l.unit_id
      JOIN public.courses c ON c.id = u.course_id
      WHERE l.id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.vocabulary_number, v.id)::text
      FROM public.lesson_vocabulary v
      WHERE v.lesson_id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.step_number, s.id)::text
      FROM public.lesson_steps s
      WHERE s.lesson_id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.activity_number, a.id)::text
      FROM public.lesson_activities a
      WHERE a.lesson_id = p_lesson_id
    ), '') ||
    coalesce((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id)::text
      FROM public.ai_assessment_drafts d
      WHERE d.lesson_id = p_lesson_id
    ), '')
  );
$$;

REVOKE ALL ON FUNCTION
  private.lesson_content_fingerprint(uuid)
FROM PUBLIC, anon, authenticated;

-- Only one approved snapshot per lesson.
-- Edits can later invalidate its fingerprint.

CREATE OR REPLACE FUNCTION public.approve_lesson_content(
  p_lesson_id uuid,
  p_review_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lesson record;
  v_count integer;
  v_bad_count integer;
  v_types text[];
  v_fingerprint text;
  v_approved_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    l.id,
    l.status AS lesson_status,
    u.status AS unit_status,
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
    RAISE EXCEPTION 'Only draft lessons can be approved';
  END IF;

  IF length(coalesce(p_review_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Review notes are too long';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id AND status = 'draft';

  IF v_count < 3 THEN
    RAISE EXCEPTION 'At least three draft vocabulary entries are required';
  END IF;

  SELECT count(*)
  INTO v_bad_count
  FROM public.lesson_vocabulary
  WHERE lesson_id = p_lesson_id AND status = 'draft'
    AND (
      length(btrim(coalesce(phrase,''))) = 0
      OR length(btrim(coalesce(meaning,''))) = 0
      OR length(btrim(coalesce(language_locale,''))) = 0
    );

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'Vocabulary has missing required fields';
  END IF;

  SELECT array_agg(DISTINCT step_type), count(*)
  INTO v_types, v_count
  FROM public.lesson_steps
  WHERE lesson_id = p_lesson_id AND status = 'draft';

  IF v_count < 7 OR NOT (
    ARRAY[
      'introduction',
      'vocabulary',
      'listening',
      'speaking',
      'dialogue',
      'word_order',
      'summary'
    ]::text[] <@ coalesce(v_types, ARRAY[]::text[])
  ) THEN
    RAISE EXCEPTION 'Required teaching steps are incomplete';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.lesson_activities
  WHERE lesson_id = p_lesson_id
    AND status = 'draft'
    AND activity_type = 'matching';

  IF v_count < 1 THEN
    RAISE EXCEPTION 'A matching activity is required';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.lesson_activities
  WHERE lesson_id = p_lesson_id
    AND status = 'draft'
    AND activity_type = 'multiple_choice'
    AND length(btrim(coalesce(
      content->>'prompt',
      content->>'question',
      content->>'question_text',
      ''
    ))) >= 5
    AND jsonb_typeof(content->'options') = 'array'
    AND coalesce(
      answer_config->>'correct_answer',
      answer_config->>'answer',
      ''
    ) <> '';

  IF v_count < 1 THEN
    RAISE EXCEPTION
      'Multiple-choice activity needs a question prompt and answer key';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.ai_assessment_drafts
  WHERE lesson_id = p_lesson_id
    AND status IN ('draft', 'approved')
    AND jsonb_typeof(questions) = 'array'
    AND jsonb_array_length(questions) BETWEEN 3 AND 5;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'A valid Knowledge Check draft is required';
  END IF;

  v_fingerprint :=
    private.lesson_content_fingerprint(p_lesson_id);

  INSERT INTO public.lesson_approvals (
    lesson_id,
    approved_by,
    approved_at,
    content_fingerprint,
    review_notes
  )
  VALUES (
    p_lesson_id,
    auth.uid(),
    now(),
    v_fingerprint,
    coalesce(p_review_notes, '')
  )
  ON CONFLICT (lesson_id) DO UPDATE
  SET
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    content_fingerprint = excluded.content_fingerprint,
    review_notes = excluded.review_notes
  RETURNING approved_at INTO v_approved_at;

  RETURN jsonb_build_object(
    'lesson_id', p_lesson_id,
    'approved_at', v_approved_at,
    'approved', true
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.approve_lesson_content(uuid,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.approve_lesson_content(uuid,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lesson_approval_status(
  p_lesson_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_approval record;
  v_current text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT approved_at, approved_by,
         content_fingerprint, review_notes
  INTO v_approval
  FROM public.lesson_approvals
  WHERE lesson_id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_approved'
    );
  END IF;

  v_current :=
    private.lesson_content_fingerprint(p_lesson_id);

  RETURN jsonb_build_object(
    'status',
      CASE
        WHEN v_current = v_approval.content_fingerprint
          THEN 'approved'
        ELSE 'needs_reapproval'
      END,
    'approved_at', v_approval.approved_at,
    'review_notes', v_approval.review_notes
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.get_lesson_approval_status(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_lesson_approval_status(uuid)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
