
-- ACELINGUA V2 - PHASE 3B.4
-- Local Ollama AI curriculum import.
-- PRESERVES all existing records and tables.
-- Run this migration ONCE.

BEGIN;

CREATE OR REPLACE FUNCTION public.import_ai_curriculum_outline(
  p_course_id uuid,
  p_outline jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_unit jsonb;
  v_lesson jsonb;
  v_lessons jsonb;

  v_course_status text;
  v_unit_id uuid;

  v_unit_title text;
  v_unit_description text;
  v_lesson_title text;
  v_lesson_description text;
  v_lesson_type text;

  v_unit_number integer;
  v_lesson_number integer;

  v_created_units integer := 0;
  v_created_lessons integer := 0;
  v_skipped_units integer := 0;
  v_skipped_lessons integer := 0;
BEGIN
  -- Do not trust application-side authorization alone.
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT private.is_admin())
  THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  -- Lock course to serialize concurrent imports.
  SELECT status INTO v_course_status
  FROM public.courses
  WHERE id = p_course_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course does not exist';
  END IF;

  IF v_course_status <> 'draft' THEN
    RAISE EXCEPTION
      'AI imports are allowed only for draft courses';
  END IF;

  IF p_outline IS NULL
     OR jsonb_typeof(p_outline) <> 'object'
     OR jsonb_typeof(p_outline -> 'units') <> 'array'
     OR jsonb_array_length(p_outline -> 'units')
        NOT BETWEEN 1 AND 3
  THEN
    RAISE EXCEPTION 'Invalid AI curriculum outline';
  END IF;

  FOR v_unit IN
    SELECT value
    FROM jsonb_array_elements(p_outline -> 'units')
  LOOP
    IF jsonb_typeof(v_unit) <> 'object' THEN
      RAISE EXCEPTION 'Invalid generated unit entry';
    END IF;

    v_unit_title := btrim(v_unit ->> 'title');
    v_unit_description :=
      btrim(coalesce(v_unit ->> 'description', ''));

    IF coalesce(length(v_unit_title), 0) NOT BETWEEN 1 AND 150
       OR length(v_unit_description) > 3000
    THEN
      RAISE EXCEPTION 'Invalid unit title or description';
    END IF;

    v_lessons := v_unit -> 'lessons';

    IF jsonb_typeof(v_lessons) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_lessons) NOT BETWEEN 1 AND 6
    THEN
      RAISE EXCEPTION
        'Each generated unit needs 1 to 6 lessons';
    END IF;

    -- Reuse a matching unit, preserving its existing data.
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE course_id = p_course_id
      AND lower(btrim(title)) = lower(v_unit_title)
    ORDER BY unit_number
    LIMIT 1;

    IF v_unit_id IS NULL THEN
      SELECT coalesce(max(unit_number), 0) + 1
      INTO v_unit_number
      FROM public.units
      WHERE course_id = p_course_id;

      INSERT INTO public.units (
        course_id,
        unit_number,
        title,
        description,
        status
      )
      VALUES (
        p_course_id,
        v_unit_number,
        v_unit_title,
        nullif(v_unit_description, ''),
        'draft'
      )
      RETURNING id INTO v_unit_id;

      v_created_units := v_created_units + 1;
    ELSE
      v_skipped_units := v_skipped_units + 1;
    END IF;

    FOR v_lesson IN
      SELECT value
      FROM jsonb_array_elements(v_lessons)
    LOOP
      IF jsonb_typeof(v_lesson) <> 'object' THEN
        RAISE EXCEPTION 'Invalid lesson entry';
      END IF;

      v_lesson_title := btrim(v_lesson ->> 'title');

      v_lesson_description :=
        btrim(coalesce(v_lesson ->> 'description', ''));

      v_lesson_type := v_lesson ->> 'lesson_type';

      IF coalesce(length(v_lesson_title), 0)
           NOT BETWEEN 1 AND 150
         OR length(v_lesson_description) > 3000
         OR v_lesson_type IS NULL
         OR v_lesson_type NOT IN (
           'standard',
           'conversation',
           'review'
         )
      THEN
        RAISE EXCEPTION 'Invalid generated lesson';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.lessons
        WHERE unit_id = v_unit_id
          AND lower(btrim(title)) = lower(v_lesson_title)
      ) THEN
        v_skipped_lessons := v_skipped_lessons + 1;
      ELSE
        SELECT coalesce(max(lesson_number), 0) + 1
        INTO v_lesson_number
        FROM public.lessons
        WHERE unit_id = v_unit_id;

        INSERT INTO public.lessons (
          unit_id,
          lesson_number,
          title,
          description,
          lesson_type,
          status
        )
        VALUES (
          v_unit_id,
          v_lesson_number,
          v_lesson_title,
          nullif(v_lesson_description, ''),
          v_lesson_type,
          'draft'
        );

        v_created_lessons := v_created_lessons + 1;
      END IF;
    END LOOP;

    v_unit_id := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'created_units', v_created_units,
    'created_lessons', v_created_lessons,
    'skipped_units', v_skipped_units,
    'skipped_lessons', v_skipped_lessons
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.import_ai_curriculum_outline(uuid, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.import_ai_curriculum_outline(uuid, jsonb)
TO authenticated;

COMMIT;
