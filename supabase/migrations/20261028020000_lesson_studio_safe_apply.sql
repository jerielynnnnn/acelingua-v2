BEGIN;

-- Additive RPCs only. No table, RLS, approval, or snapshot changes.
CREATE OR REPLACE FUNCTION public.get_lesson_studio_version(p_lesson_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = p_lesson_id) THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  RETURN private.lesson_content_fingerprint(p_lesson_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_lesson_studio_changes(
  p_lesson_id uuid,
  p_expected_version text,
  p_changes jsonb,
  p_confirm_revision boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lesson_status text; v_unit_status text; v_course_status text;
  v_change jsonb; v_payload jsonb; v_content jsonb; v_kind text; v_type text;
  v_id uuid; v_number integer; v_step integer; v_old_phrase text; v_locale text;
  v_record record; v_initial_vocabulary_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Changes must be an array'; END IF;
  IF jsonb_array_length(p_changes) NOT BETWEEN 1 AND 20 OR octet_length(p_changes::text) > 100000 THEN
    RAISE EXCEPTION 'Invalid proposal size';
  END IF;
  SELECT l.status,u.status,c.status INTO v_lesson_status,v_unit_status,v_course_status
  FROM public.lessons l JOIN public.units u ON u.id=l.unit_id JOIN public.courses c ON c.id=u.course_id
  WHERE l.id=p_lesson_id FOR UPDATE OF l,u,c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lesson not found'; END IF;
  IF v_lesson_status <> 'draft' OR v_unit_status <> 'draft' OR v_course_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft source content can be edited';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM private.lesson_content_fingerprint(p_lesson_id) THEN
    RAISE EXCEPTION 'Lesson changed. Reload and review a fresh proposal';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.lesson_approvals WHERE lesson_id=p_lesson_id)
      OR EXISTS (SELECT 1 FROM public.published_lesson_snapshots WHERE lesson_id=p_lesson_id))
      AND p_confirm_revision IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirm that this is a draft revision requiring fresh approval; the published snapshot is unchanged';
  END IF;
  SELECT count(*) INTO v_initial_vocabulary_count FROM public.lesson_vocabulary WHERE lesson_id=p_lesson_id AND status <> 'archived';
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    v_type := v_change->>'record_type'; v_kind := v_change->>'step_type'; v_payload := v_change->'payload';
    IF v_type IS NULL OR v_type NOT IN ('vocabulary','step','activity','assessment') OR jsonb_typeof(v_payload) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid record payload';
    END IF;
    v_id := nullif(v_change->>'record_id','')::uuid;
    IF v_id IS NOT NULL THEN
      v_old_phrase := NULL;
      IF v_type='vocabulary' THEN
        SELECT phrase,language_locale INTO v_old_phrase,v_locale FROM public.lesson_vocabulary WHERE id=v_id AND lesson_id=p_lesson_id AND status='draft';
      END IF;
      PERFORM public.edit_lesson_content(p_lesson_id,v_type,v_id,v_payload);
      -- Keep exact matching draft teaching cards consistent with a reviewed vocabulary edit.
      IF v_type='vocabulary' AND v_old_phrase IS NOT NULL THEN
        FOR v_record IN SELECT id,title,content FROM public.lesson_steps
          WHERE lesson_id=p_lesson_id AND status='draft' AND step_type IN ('vocabulary','listening','speaking')
          AND content->>'phrase'=v_old_phrase
        LOOP
          PERFORM public.edit_lesson_content(p_lesson_id,'step',v_record.id,
            jsonb_build_object('title',v_record.title,'content',v_record.content || jsonb_build_object(
              'phrase',v_payload->>'phrase','romanization',coalesce(v_payload->>'romanization',''),
              'meaning',v_payload->>'meaning','usage_note',coalesce(v_payload->>'usage_note',''),'locale',v_locale)));
        END LOOP;
      END IF;
    ELSIF v_type='vocabulary' THEN
      IF v_initial_vocabulary_count >= 3 THEN RAISE EXCEPTION 'Vocabulary already exists. Improve an existing entry instead'; END IF;
      IF EXISTS (SELECT 1 FROM public.lesson_vocabulary WHERE lesson_id=p_lesson_id AND status <> 'archived'
        AND lower(btrim(phrase))=lower(btrim(v_payload->>'phrase'))) THEN RAISE EXCEPTION 'Vocabulary already exists'; END IF;
      -- New material is only added to a genuinely incomplete vocabulary section.
      IF (SELECT count(*) FROM public.lesson_vocabulary WHERE lesson_id=p_lesson_id AND status <> 'archived') >= 7 THEN
        RAISE EXCEPTION 'Vocabulary scope exceeded';
      END IF;
      v_locale := v_change->>'locale';
      IF v_locale IS NULL OR length(v_locale) NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Language locale required'; END IF;
      SELECT coalesce(max(vocabulary_number),0)+1 INTO v_number FROM public.lesson_vocabulary WHERE lesson_id=p_lesson_id;
      INSERT INTO public.lesson_vocabulary(lesson_id,vocabulary_number,phrase,romanization,meaning,usage_note,language_locale)
      VALUES(p_lesson_id,v_number,v_payload->>'phrase',coalesce(v_payload->>'romanization',''),v_payload->>'meaning',coalesce(v_payload->>'usage_note',''),v_locale)
      RETURNING id INTO v_id;
      PERFORM public.edit_lesson_content(p_lesson_id,'vocabulary',v_id,v_payload);
      -- One teaching card with manual audio; never generate an identical audio-only slide.
      IF NOT EXISTS (SELECT 1 FROM public.lesson_steps WHERE lesson_id=p_lesson_id AND status <> 'archived' AND step_type='vocabulary' AND content->>'phrase'=v_payload->>'phrase') THEN
        SELECT coalesce(max(step_number),0)+1 INTO v_step FROM public.lesson_steps WHERE lesson_id=p_lesson_id;
        INSERT INTO public.lesson_steps(lesson_id,step_number,step_type,title,content)
        VALUES(p_lesson_id,v_step,'vocabulary','Learn an expression',v_payload || jsonb_build_object('locale',v_locale));
      END IF;
    ELSIF v_type='step' THEN
      IF v_kind IS NULL OR v_kind NOT IN ('introduction','dialogue','speaking','word_order','summary') THEN RAISE EXCEPTION 'Unsupported new teaching section'; END IF;
      IF EXISTS (SELECT 1 FROM public.lesson_steps WHERE lesson_id=p_lesson_id AND status <> 'archived' AND step_type=v_kind) THEN
        RAISE EXCEPTION 'This section already exists; no content was overwritten';
      END IF;
      v_content := v_payload->'content';
      SELECT coalesce(max(step_number),0)+1 INTO v_step FROM public.lesson_steps WHERE lesson_id=p_lesson_id;
      INSERT INTO public.lesson_steps(lesson_id,step_number,step_type,title,content)
      VALUES(p_lesson_id,v_step,v_kind,v_payload->>'title',v_content) RETURNING id INTO v_id;
      PERFORM public.edit_lesson_content(p_lesson_id,'step',v_id,v_payload);
    ELSE RAISE EXCEPTION 'New activities and assessments must use their existing authoring tools';
    END IF;
  END LOOP;
  -- All work is atomic. Existing approvals become stale via their existing fingerprint comparison.
  -- Never UPDATE, INSERT, DELETE, or withdraw any published snapshot here.
  RETURN jsonb_build_object('saved',true);
END;
$$;
REVOKE ALL ON FUNCTION public.get_lesson_studio_version(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apply_lesson_studio_changes(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_lesson_studio_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_lesson_studio_changes(uuid,text,jsonb,boolean) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
