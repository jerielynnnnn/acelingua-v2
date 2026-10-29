-- Phase 3F.1: new drafts only. No learner, reward, assessment or snapshot changes.
-- Requires the existing curriculum foundation and import_ai_curriculum_outline RPC.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('private.is_admin()') IS NULL
     OR to_regprocedure('public.import_ai_curriculum_outline(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Existing admin authorization and curriculum outline import RPCs are required.';
  END IF;
END;
$preflight$;

-- Durable, private receipts make concurrent requests and network retries idempotent.
CREATE TABLE private.ai_course_draft_requests (
  request_id uuid PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  language_code text NOT NULL,
  draft jsonb NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.ai_course_draft_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ai_course_draft_requests FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_ai_course_draft(p_request_id uuid, p_language_code text, p_draft jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing private.ai_course_draft_requests%ROWTYPE;
  v_name text;
  v_native text;
  v_language uuid;
  v_course uuid;
  v_unit jsonb;
  v_lesson jsonb;
  v_outline jsonb := '{"units":[]}'::jsonb;
  v_lessons jsonb;
  v_stats jsonb;
  v_receipt jsonb;
BEGIN
  IF v_user IS NULL OR private.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_language_code IS NULL OR p_draft IS NULL
     OR octet_length(p_draft::text) > 60000 THEN
    RAISE EXCEPTION 'Invalid or oversized course request.' USING ERRCODE = '22023';
  END IF;
  SELECT name, native_name INTO v_name, v_native FROM (VALUES
    ('ja','Japanese','日本語'), ('ko','Korean','한국어'), ('it','Italian','Italiano'),
    ('es','Spanish','Español'), ('fr','French','Français'), ('de','German','Deutsch'),
    ('zh','Chinese','中文'), ('th','Thai','ไทย'), ('fil','Filipino','Filipino'), ('en','English','English')
  ) AS supported(code,name,native_name) WHERE code = p_language_code;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Unsupported language.' USING ERRCODE = '22023'; END IF;

  -- Serialize identical requests, then serialize course creation for this language.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai-course-request:' || p_request_id::text, 0));
  SELECT * INTO v_existing FROM private.ai_course_draft_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.created_by <> v_user OR v_existing.language_code <> p_language_code OR v_existing.draft <> p_draft THEN
      RAISE EXCEPTION 'This request was already saved with different content. Open the saved course instead.' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.receipt;
  END IF;

  IF jsonb_typeof(p_draft) <> 'object' THEN RAISE EXCEPTION 'Course must be an object.'; END IF;
  IF (p_draft - ARRAY['title','description','units']) <> '{}'::jsonb
     OR jsonb_typeof(p_draft->'title') IS DISTINCT FROM 'string'
     OR length(btrim(p_draft->>'title')) NOT BETWEEN 1 AND 150
     OR jsonb_typeof(p_draft->'description') IS DISTINCT FROM 'string'
     OR length(btrim(p_draft->>'description')) NOT BETWEEN 1 AND 3000
     OR jsonb_typeof(p_draft->'units') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid course fields.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_draft->'units') <> 3 THEN RAISE EXCEPTION 'Exactly 3 units are required.'; END IF;
  FOR v_unit IN SELECT value FROM jsonb_array_elements(p_draft->'units') LOOP
    IF jsonb_typeof(v_unit) <> 'object' THEN RAISE EXCEPTION 'Unit must be an object.'; END IF;
    IF (v_unit - ARRAY['title','description','lessons']) <> '{}'::jsonb
       OR jsonb_typeof(v_unit->'title') IS DISTINCT FROM 'string'
       OR length(btrim(v_unit->>'title')) NOT BETWEEN 1 AND 150
       OR jsonb_typeof(v_unit->'description') IS DISTINCT FROM 'string'
       OR length(btrim(v_unit->>'description')) NOT BETWEEN 1 AND 3000
       OR jsonb_typeof(v_unit->'lessons') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid unit fields.';
    END IF;
    IF jsonb_array_length(v_unit->'lessons') <> 3 THEN RAISE EXCEPTION 'Exactly 3 lessons per unit are required.'; END IF;
    v_lessons := '[]'::jsonb;
    FOR v_lesson IN SELECT value FROM jsonb_array_elements(v_unit->'lessons') LOOP
      IF jsonb_typeof(v_lesson) <> 'object' THEN RAISE EXCEPTION 'Lesson must be an object.'; END IF;
      IF (v_lesson - ARRAY['title','description','learning_objective','difficulty','lesson_type']) <> '{}'::jsonb
         OR jsonb_typeof(v_lesson->'title') IS DISTINCT FROM 'string'
         OR length(btrim(v_lesson->>'title')) NOT BETWEEN 1 AND 150
         OR jsonb_typeof(v_lesson->'description') IS DISTINCT FROM 'string'
         OR length(btrim(v_lesson->>'description')) NOT BETWEEN 1 AND 2000
         OR jsonb_typeof(v_lesson->'learning_objective') IS DISTINCT FROM 'string'
         OR length(btrim(v_lesson->>'learning_objective')) NOT BETWEEN 1 AND 700
         OR (v_lesson->>'difficulty') IS DISTINCT FROM 'beginner'
         OR coalesce(v_lesson->>'lesson_type','') NOT IN ('standard','conversation','review') THEN
        RAISE EXCEPTION 'Invalid beginner lesson fields.';
      END IF;
      v_lessons := v_lessons || jsonb_build_array(jsonb_build_object(
        'title', btrim(v_lesson->>'title'), 'lesson_type', v_lesson->>'lesson_type',
        'description', btrim(v_lesson->>'description') || E'\n\nLearning objective: ' || btrim(v_lesson->>'learning_objective') || E'\nSuggested difficulty: beginner (A1).'
      ));
    END LOOP;
    IF (SELECT count(DISTINCT lower(btrim(value->>'title'))) FROM jsonb_array_elements(v_lessons)) <> 3 THEN
      RAISE EXCEPTION 'Lesson titles must be unique within a unit.';
    END IF;
    v_outline := jsonb_set(v_outline, '{units}', (v_outline->'units') || jsonb_build_array(jsonb_build_object(
      'title', btrim(v_unit->>'title'), 'description', btrim(v_unit->>'description'), 'lessons', v_lessons
    )));
  END LOOP;
  IF (SELECT count(DISTINCT lower(btrim(value->>'title'))) FROM jsonb_array_elements(v_outline->'units')) <> 3 THEN
    RAISE EXCEPTION 'Unit titles must be unique.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai-course-language:' || p_language_code, 0));
  SELECT id INTO v_language FROM public.languages WHERE lower(code) = p_language_code ORDER BY id LIMIT 1;
  IF v_language IS NULL THEN
    INSERT INTO public.languages(code,name,native_name,is_active)
    VALUES (p_language_code,v_name,v_native,false)
    ON CONFLICT (code) DO NOTHING RETURNING id INTO v_language;
    IF v_language IS NULL THEN SELECT id INTO v_language FROM public.languages WHERE code = p_language_code; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.courses WHERE language_id = v_language AND lower(btrim(title)) = lower(btrim(p_draft->>'title'))) THEN
    RAISE EXCEPTION 'A course with this title already exists for this language. Edit it in Curriculum Studio or choose a distinct title.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.courses(language_id,title,description,difficulty,status)
  VALUES(v_language,btrim(p_draft->>'title'),btrim(p_draft->>'description'),'beginner','draft') RETURNING id INTO v_course;
  v_stats := public.import_ai_curriculum_outline(v_course,v_outline);
  IF (v_stats->>'created_units')::integer <> 3 OR (v_stats->>'created_lessons')::integer <> 9 THEN
    RAISE EXCEPTION 'Incomplete course import; all changes rolled back.';
  END IF;
  v_receipt := jsonb_build_object('course_id',v_course,'language_id',v_language,'created_units',3,'created_lessons',9);
  INSERT INTO private.ai_course_draft_requests(request_id,created_by,language_code,draft,course_id,receipt)
  VALUES(p_request_id,v_user,p_language_code,p_draft,v_course,v_receipt);
  RETURN v_receipt;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_ai_course_draft(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ai_course_draft(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
