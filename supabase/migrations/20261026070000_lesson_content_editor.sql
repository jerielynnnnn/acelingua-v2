
BEGIN;

CREATE OR REPLACE FUNCTION public.edit_lesson_content(
  p_lesson_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_payload jsonb
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
  v_rows integer;
  v_item jsonb;
  v_options jsonb;
  v_answer text;
  v_phrase text;
  v_meaning text;
  v_content jsonb;
  v_config jsonb;
  v_step_type text;
  v_activity_type text;
BEGIN
  -- Must be a signed-in Administrator.
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL
    OR jsonb_typeof(p_payload) <> 'object'
  THEN
    RAISE EXCEPTION 'Invalid editor payload';
  END IF;

  -- Lock the lesson while editing.
  SELECT
    l.status,
    u.status,
    c.status
  INTO
    v_lesson_status,
    v_unit_status,
    v_course_status
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
      'Only draft curriculum content can be edited';
  END IF;

  -- =====================================================
  -- VOCABULARY
  -- =====================================================

  IF p_record_type = 'vocabulary' THEN
    v_phrase := btrim(coalesce(p_payload->>'phrase', ''));
    v_meaning := btrim(coalesce(p_payload->>'meaning', ''));

    IF length(v_phrase) NOT BETWEEN 1 AND 150
      OR length(v_meaning) NOT BETWEEN 1 AND 200
      OR length(coalesce(p_payload->>'romanization','')) > 200
      OR length(coalesce(p_payload->>'usage_note','')) > 500
    THEN
      RAISE EXCEPTION 'Invalid vocabulary fields';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.lesson_vocabulary v
      WHERE v.lesson_id = p_lesson_id
        AND v.id <> p_record_id
        AND v.status <> 'archived'
        AND lower(btrim(v.phrase)) = lower(v_phrase)
    ) THEN
      RAISE EXCEPTION
        'This vocabulary phrase already exists in the lesson';
    END IF;

    UPDATE public.lesson_vocabulary
    SET
      phrase = v_phrase,
      romanization = btrim(
        coalesce(p_payload->>'romanization', '')
      ),
      meaning = v_meaning,
      usage_note = btrim(
        coalesce(p_payload->>'usage_note', '')
      )
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status = 'draft';

  -- =====================================================
  -- TEACHING STEPS
  -- =====================================================

  ELSIF p_record_type = 'step' THEN
    v_content := p_payload->'content';

    IF jsonb_typeof(v_content) <> 'object' THEN
      RAISE EXCEPTION 'Step content must be a JSON object';
    END IF;

    IF length(btrim(coalesce(p_payload->>'title','')))
       NOT BETWEEN 1 AND 150
    THEN
      RAISE EXCEPTION 'Invalid step title';
    END IF;

    SELECT step_type INTO v_step_type
    FROM public.lesson_steps
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status = 'draft';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teaching step not found';
    END IF;

    IF v_step_type IN ('introduction','summary') THEN
      IF length(btrim(coalesce(v_content->>'text',''))) < 10 THEN
        RAISE EXCEPTION 'Introduction/summary text is too short';
      END IF;
    ELSIF v_step_type IN ('vocabulary','listening','speaking') THEN
      IF length(btrim(coalesce(v_content->>'phrase',''))) = 0
        OR length(btrim(coalesce(v_content->>'locale',''))) = 0
      THEN
        RAISE EXCEPTION 'Missing phrase or language locale';
      END IF;
    ELSIF v_step_type = 'dialogue' THEN
      IF length(btrim(coalesce(v_content->>'line_a',''))) = 0
        OR length(btrim(coalesce(v_content->>'line_b',''))) = 0
        OR length(btrim(coalesce(v_content->>'translation',''))) = 0
      THEN
        RAISE EXCEPTION 'Incomplete dialogue';
      END IF;
    ELSIF v_step_type = 'word_order' THEN
      IF length(btrim(coalesce(v_content->>'prompt',''))) = 0
        OR length(btrim(coalesce(v_content->>'sentence',''))) = 0
      THEN
        RAISE EXCEPTION 'Incomplete word-order exercise';
      END IF;
    END IF;

    UPDATE public.lesson_steps
    SET
      title = btrim(p_payload->>'title'),
      content = v_content
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status = 'draft';

  -- =====================================================
  -- INTERACTIVE ACTIVITIES
  -- =====================================================

  ELSIF p_record_type = 'activity' THEN
    v_content := p_payload->'content';
    v_config := p_payload->'answer_config';

    IF jsonb_typeof(v_content) <> 'object'
      OR jsonb_typeof(v_config) <> 'object'
    THEN
      RAISE EXCEPTION 'Activity JSON objects are required';
    END IF;

    IF length(btrim(coalesce(p_payload->>'title','')))
       NOT BETWEEN 1 AND 150
      OR length(coalesce(p_payload->>'instructions','')) > 1000
    THEN
      RAISE EXCEPTION 'Invalid activity title or instructions';
    END IF;

    SELECT activity_type INTO v_activity_type
    FROM public.lesson_activities
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status = 'draft';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Activity not found';
    END IF;

    IF v_activity_type = 'multiple_choice' THEN
      v_options := v_content->'options';
      v_answer := coalesce(
        v_config->>'correct_answer',
        v_config->>'answer',
        ''
      );

      IF length(btrim(coalesce(
        v_content->>'prompt',
        v_content->>'question',
        v_content->>'question_text',
        ''
      ))) < 5 THEN
        RAISE EXCEPTION
          'Multiple-choice question needs a real prompt';
      END IF;

      IF jsonb_typeof(v_options) IS DISTINCT FROM 'array'
      THEN
        RAISE EXCEPTION 'Invalid multiple-choice options';
      END IF;

      IF jsonb_array_length(v_options) < 2 THEN
        RAISE EXCEPTION 'At least two options are required';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_options) AS e(value)
        WHERE jsonb_typeof(e.value) <> 'string'
          OR length(btrim(e.value #>> '{}')) = 0
      ) THEN
        RAISE EXCEPTION 'Every option must be text';
      END IF;

      IF (
        SELECT count(DISTINCT lower(btrim(value)))
        FROM jsonb_array_elements_text(v_options)
          AS e(value)
      ) <> jsonb_array_length(v_options) THEN
        RAISE EXCEPTION 'Duplicate answer options';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_options)
          AS e(value)
        WHERE value = v_answer
      ) THEN
        RAISE EXCEPTION
          'Correct answer must match an option exactly';
      END IF;

    ELSIF v_activity_type = 'matching' THEN
      v_options := coalesce(
        v_config->'pairs',
        v_content->'pairs'
      );

      IF jsonb_typeof(v_options) IS DISTINCT FROM 'array'
      THEN
        RAISE EXCEPTION 'Matching pairs are required';
      END IF;

      IF jsonb_array_length(v_options) < 2 THEN
        RAISE EXCEPTION 'At least two matching pairs required';
      END IF;

      FOR v_item IN
        SELECT value FROM jsonb_array_elements(v_options)
      LOOP
        IF length(btrim(coalesce(
          v_item->>'left', v_item->>'phrase', ''
        ))) = 0
          OR length(btrim(coalesce(
            v_item->>'right', v_item->>'meaning', ''
          ))) = 0
        THEN
          RAISE EXCEPTION 'Matching pair is incomplete';
        END IF;
      END LOOP;

    ELSIF v_activity_type = 'flip_cards' THEN
      IF jsonb_typeof(v_content->'cards')
         IS DISTINCT FROM 'array'
      THEN
        RAISE EXCEPTION 'Flashcards array required';
      END IF;

      IF jsonb_array_length(v_content->'cards') < 2 THEN
        RAISE EXCEPTION 'At least two flashcards required';
      END IF;

      FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(v_content->'cards')
      LOOP
        IF length(btrim(coalesce(v_item->>'front',''))) = 0
          OR length(btrim(coalesce(v_item->>'back',''))) = 0
        THEN
          RAISE EXCEPTION 'Flashcard front/back is missing';
        END IF;
      END LOOP;
    END IF;

    UPDATE public.lesson_activities
    SET
      title = btrim(p_payload->>'title'),
      instructions = coalesce(
        p_payload->>'instructions', ''
      ),
      content = v_content,
      answer_config = v_config
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status = 'draft';

  -- =====================================================
  -- KNOWLEDGE CHECK
  -- =====================================================

  ELSIF p_record_type = 'assessment' THEN
    v_options := p_payload->'questions';

    IF length(btrim(coalesce(p_payload->>'title','')))
       NOT BETWEEN 3 AND 150
      OR jsonb_typeof(v_options) IS DISTINCT FROM 'array'
    THEN
      RAISE EXCEPTION 'Invalid assessment content';
    END IF;

    IF jsonb_array_length(v_options) NOT BETWEEN 3 AND 5
    THEN
      RAISE EXCEPTION 'Assessment requires 3 to 5 questions';
    END IF;

    FOR v_item IN
      SELECT value FROM jsonb_array_elements(v_options)
    LOOP
      IF jsonb_typeof(v_item) <> 'object'
        OR length(btrim(coalesce(v_item->>'prompt',''))) < 5
        OR length(btrim(coalesce(
          v_item->>'explanation',''
        ))) < 5
        OR jsonb_typeof(v_item->'options') IS DISTINCT
          FROM 'array'
      THEN
        RAISE EXCEPTION 'Invalid assessment question';
      END IF;

      IF jsonb_array_length(v_item->'options') <> 3 THEN
        RAISE EXCEPTION 'Each question needs three options';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_item->'options')
          AS e(value)
        WHERE jsonb_typeof(e.value) <> 'string'
          OR length(btrim(e.value #>> '{}')) = 0
      ) THEN
        RAISE EXCEPTION 'Question options must be text';
      END IF;

      IF (
        SELECT count(DISTINCT lower(btrim(value)))
        FROM jsonb_array_elements_text(v_item->'options')
          AS e(value)
      ) <> 3 THEN
        RAISE EXCEPTION 'Assessment options must be unique';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_item->'options')
          AS e(value)
        WHERE value = v_item->>'correct_answer'
      ) THEN
        RAISE EXCEPTION 'Assessment answer does not match options';
      END IF;
    END LOOP;

    UPDATE public.ai_assessment_drafts
    SET
      title = btrim(p_payload->>'title'),
      questions = v_options,
      status = 'draft',
      updated_at = now()
    WHERE id = p_record_id
      AND lesson_id = p_lesson_id
      AND status IN ('draft','approved');

  ELSE
    RAISE EXCEPTION 'Unsupported record type';
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 1 THEN
    RAISE EXCEPTION
      'Record not found, not editable, or modified elsewhere';
  END IF;

  -- Existing lesson_approvals are NOT modified.
  -- Their content fingerprint will change when edited.

  RETURN jsonb_build_object(
    'saved', true,
    'record_type', p_record_type,
    'record_id', p_record_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.edit_lesson_content(uuid,text,uuid,jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.edit_lesson_content(uuid,text,uuid,jsonb)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
