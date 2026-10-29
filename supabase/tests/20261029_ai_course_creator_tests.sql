-- Run in Supabase SQL Editor AFTER the Phase 3F.1 migration.
-- Requires at least one existing admin profile. No account creation or DB reset.
-- Every new draft, language and receipt below is rolled back, even on success.
BEGIN;
DO $test$
DECLARE
  v_admin uuid;
  v_request uuid := gen_random_uuid();
  v_draft jsonb;
  v_receipt jsonb;
  v_again jsonb;
  v_course uuid;
  v_count bigint;
  v_before jsonb;
  v_after jsonb;
  v_active boolean;
  v_expected_lesson constant uuid := '3b92c0cb-b636-46a2-bf30-38cca3d06900';
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' ORDER BY id LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'An existing administrator profile is required.'; END IF;
  SELECT jsonb_build_object(
    'lesson', (SELECT to_jsonb(l) FROM public.lessons l WHERE id = v_expected_lesson),
    'profiles', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.profiles p),
    'completions', (SELECT jsonb_agg(to_jsonb(c) ORDER BY user_id,lesson_id) FROM public.learner_lesson_completions c),
    'attempts', (SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id,lesson_id) FROM public.learner_knowledge_check_attempts a)
  ) INTO v_before;
  SELECT is_active INTO v_active FROM public.languages WHERE code = 'ko';
  SELECT jsonb_build_object('title','AI integration test ' || v_request::text,
    'description','A rollback-only Korean beginner test course.',
    'units',jsonb_agg(jsonb_build_object('title','Unit ' || u,'description','Beginner Korean unit.',
      'lessons',(SELECT jsonb_agg(jsonb_build_object('title','Lesson ' || l,
        'description','Practice beginner Korean.','learning_objective','Use a polite greeting.',
        'difficulty','beginner','lesson_type','standard') ORDER BY l) FROM generate_series(1,3) l)) ORDER BY u))
    INTO v_draft FROM generate_series(1,3) u;

  -- Use an existing learner if available; an unknown profile also fails closed.
  PERFORM set_config('request.jwt.claim.sub', coalesce((SELECT id FROM public.profiles WHERE role = 'learner' ORDER BY id LIMIT 1),gen_random_uuid())::text, true);
  BEGIN
    PERFORM public.create_ai_course_draft(v_request,'ko',v_draft);
    RAISE EXCEPTION 'FAIL: non-admin creation was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  SELECT count(*) INTO v_count FROM public.courses;
  BEGIN
    PERFORM public.create_ai_course_draft(v_request,'ko',jsonb_set(v_draft,'{units}','[]'::jsonb));
    RAISE EXCEPTION 'FAIL: malformed outline was accepted' USING ERRCODE = 'P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  IF (SELECT count(*) FROM public.courses) <> v_count THEN RAISE EXCEPTION 'FAIL: partial course remains'; END IF;
  v_receipt := public.create_ai_course_draft(v_request,'ko',v_draft);
  v_again := public.create_ai_course_draft(v_request,'ko',v_draft);
  IF v_again <> v_receipt THEN RAISE EXCEPTION 'FAIL: retry returned a different receipt'; END IF;
  BEGIN
    PERFORM public.create_ai_course_draft(v_request,'ko',jsonb_set(v_draft,'{title}','"Changed after saving"'::jsonb));
    RAISE EXCEPTION 'FAIL: changed payload reused a committed request';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  v_course := (v_receipt->>'course_id')::uuid;
  IF (SELECT count(*) FROM public.courses) <> v_count + 1 THEN RAISE EXCEPTION 'FAIL: repeated save duplicated the course'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = v_course AND status = 'draft' AND difficulty = 'beginner') THEN RAISE EXCEPTION 'FAIL: course not draft'; END IF;
  IF (SELECT count(*) FROM public.units WHERE course_id = v_course AND status = 'draft') <> 3 THEN RAISE EXCEPTION 'FAIL: expected 3 draft units'; END IF;
  IF (SELECT count(*) FROM public.lessons l JOIN public.units u ON u.id = l.unit_id WHERE u.course_id = v_course AND l.status = 'draft' AND l.description LIKE '%Learning objective:%') <> 9 THEN RAISE EXCEPTION 'FAIL: expected 9 draft lessons and objectives'; END IF;
  IF (SELECT is_active FROM public.languages WHERE id = (v_receipt->>'language_id')::uuid) IS DISTINCT FROM coalesce(v_active,false) THEN RAISE EXCEPTION 'FAIL: language activation changed'; END IF;
  BEGIN
    PERFORM public.create_ai_course_draft(gen_random_uuid(),'ko',v_draft);
    RAISE EXCEPTION 'FAIL: duplicate title was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  SELECT jsonb_build_object(
    'lesson', (SELECT to_jsonb(l) FROM public.lessons l WHERE id = v_expected_lesson),
    'profiles', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.profiles p),
    'completions', (SELECT jsonb_agg(to_jsonb(c) ORDER BY user_id,lesson_id) FROM public.learner_lesson_completions c),
    'attempts', (SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id,lesson_id) FROM public.learner_knowledge_check_attempts a)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN RAISE EXCEPTION 'FAIL: existing learner data changed'; END IF;
  RAISE NOTICE 'PASS: admin guard, JSON rejection, idempotent save, 3x3 draft hierarchy, duplicate guard, activation and existing learner records.';
END;
$test$;
ROLLBACK;
