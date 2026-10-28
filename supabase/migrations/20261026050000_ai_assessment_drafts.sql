
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_assessment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE
    REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
  questions jsonb NOT NULL
    CHECK (jsonb_typeof(questions) = 'array'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_assessment_drafts
  ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ai_assessment_drafts
  TO authenticated;

REVOKE ALL ON public.ai_assessment_drafts
  FROM anon;

DROP POLICY IF EXISTS
  "Admin reads assessment drafts"
ON public.ai_assessment_drafts;

CREATE POLICY "Admin reads assessment drafts"
ON public.ai_assessment_drafts
FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));

CREATE OR REPLACE FUNCTION public.save_ai_assessment_draft(
  p_lesson_id uuid,
  p_title text,
  p_questions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_question jsonb;
  v_options jsonb;
  v_answer text;
  v_course_status text;
  v_unit_status text;
  v_lesson_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.status, u.status, l.status
  INTO v_course_status, v_unit_status, v_lesson_status
  FROM public.lessons l
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.courses c ON c.id = u.course_id
  WHERE l.id = p_lesson_id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  IF v_course_status <> 'draft'
    OR v_unit_status <> 'draft'
    OR v_lesson_status <> 'draft'
  THEN
    RAISE EXCEPTION 'Assessment requires a draft lesson';
  END IF;

  IF length(btrim(coalesce(p_title, ''))) NOT BETWEEN 3 AND 150 THEN
    RAISE EXCEPTION 'Invalid assessment title';
  END IF;

  IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Questions must be an array';
  END IF;

  IF jsonb_array_length(p_questions) NOT BETWEEN 3 AND 5 THEN
    RAISE EXCEPTION 'An assessment needs 3 to 5 questions';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    IF jsonb_typeof(v_question) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid question object';
    END IF;

    v_options := v_question -> 'options';
    v_answer := v_question ->> 'correct_answer';

    IF length(btrim(coalesce(v_question ->> 'prompt','')))
       NOT BETWEEN 5 AND 300
      OR length(btrim(coalesce(v_question ->> 'explanation','')))
       NOT BETWEEN 5 AND 500
      OR jsonb_typeof(v_options) IS DISTINCT FROM 'array'
    THEN
      RAISE EXCEPTION 'Invalid assessment question';
    END IF;

    IF jsonb_array_length(v_options) <> 3
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_options) AS opt(value)
        WHERE jsonb_typeof(opt.value) <> 'string'
          OR length(btrim(opt.value #>> '{}')) NOT BETWEEN 1 AND 200
      )
      OR (
        SELECT count(DISTINCT lower(btrim(value)))
        FROM jsonb_array_elements_text(v_options) AS opt(value)
      ) <> 3
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_options) AS opt(value)
        WHERE opt.value = v_answer
      )
    THEN
      RAISE EXCEPTION 'Invalid answer options';
    END IF;
  END LOOP;

  -- Never overwrite an existing assessment draft.
  INSERT INTO public.ai_assessment_drafts (
    lesson_id, title, questions
  )
  VALUES (
    p_lesson_id, btrim(p_title), p_questions
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.save_ai_assessment_draft(uuid,text,jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.save_ai_assessment_draft(uuid,text,jsonb)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
