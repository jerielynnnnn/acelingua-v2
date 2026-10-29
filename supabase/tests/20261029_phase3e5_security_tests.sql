
-- ============================================================
-- ACELINGUA V2
-- PHASE 3E.5.4 — SECURITY VALIDATION
--
-- READ-ONLY BASELINE CHECKS
-- ============================================================

-- TEST 01: Required database objects exist

SELECT
  'Completion table' AS security_check,
  to_regclass(
    'public.learner_lesson_completions'
  ) IS NOT NULL AS passed

UNION ALL

SELECT
  'Knowledge Check table',
  to_regclass(
    'public.learner_knowledge_check_attempts'
  ) IS NOT NULL

UNION ALL

SELECT
  'Assessment snapshot table',
  to_regclass(
    'public.published_assessment_snapshots'
  ) IS NOT NULL

UNION ALL

SELECT
  'Lesson access function',
  to_regprocedure(
    'private.can_access_published_lesson(uuid)'
  ) IS NOT NULL

UNION ALL

SELECT
  'Complete lesson function',
  to_regprocedure(
    'public.complete_learner_lesson(uuid)'
  ) IS NOT NULL

UNION ALL

SELECT
  'Get Knowledge Check function',
  to_regprocedure(
    'public.get_published_knowledge_check(uuid)'
  ) IS NOT NULL

UNION ALL

SELECT
  'Submit Knowledge Check function',
  to_regprocedure(
    'public.submit_published_knowledge_check(uuid,jsonb)'
  ) IS NOT NULL;


-- ============================================================
-- TEST 02: Row Level Security is enabled
-- ============================================================

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'published_lesson_snapshots',
    'published_assessment_snapshots',
    'learner_knowledge_check_attempts',
    'learner_lesson_completions'
  )
ORDER BY c.relname;


-- ============================================================
-- TEST 03: Published assessment integrity
-- ============================================================

SELECT
  s.lesson_title,
  s.status AS publication_status,
  a.approval_fingerprint =
    s.approval_fingerprint
      AS fingerprint_matches,
  jsonb_array_length(a.questions)
    AS frozen_questions
FROM public.published_lesson_snapshots s
LEFT JOIN public.published_assessment_snapshots a
  ON a.lesson_id = s.lesson_id
 AND a.approval_fingerprint =
     s.approval_fingerprint
WHERE s.status = 'published';


-- ============================================================
-- TEST 04: Saved learner results
-- ============================================================

SELECT
  l.title AS lesson,
  a.score,
  a.correct_count,
  a.question_count,
  c.xp_awarded,
  c.coins_awarded,
  c.completed_at
FROM public.learner_knowledge_check_attempts a
JOIN public.lessons l
  ON l.id = a.lesson_id
LEFT JOIN public.learner_lesson_completions c
  ON c.user_id = a.user_id
 AND c.lesson_id = a.lesson_id
ORDER BY a.submitted_at DESC;


-- ============================================================
-- TEST 05: Check direct table privileges
-- ============================================================

SELECT
  'authenticated' AS tested_role,
  'Assessment snapshots' AS resource,
  has_table_privilege(
    'authenticated',
    'public.published_assessment_snapshots',
    'SELECT'
  ) AS direct_select_allowed

UNION ALL

SELECT
  'authenticated',
  'Knowledge Check attempts',
  has_table_privilege(
    'authenticated',
    'public.learner_knowledge_check_attempts',
    'SELECT'
  )

UNION ALL

SELECT
  'authenticated',
  'Lesson completions',
  has_table_privilege(
    'authenticated',
    'public.learner_lesson_completions',
    'SELECT'
  )

UNION ALL

SELECT
  'authenticated',
  'Assessment snapshot inserts',
  has_table_privilege(
    'authenticated',
    'public.published_assessment_snapshots',
    'INSERT'
  );


-- ============================================================
-- TEST 06: Verify protected assessment RPC integration
-- ============================================================

SELECT
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  position(
    'can_access_published_lesson'
    IN pg_get_functiondef(p.oid)
  ) > 0 AS checks_unlock,
  position(
    'get_published_assessment_questions'
    IN pg_get_functiondef(p.oid)
  ) > 0 AS uses_snapshot
FROM pg_proc p
JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_published_knowledge_check',
    'submit_published_knowledge_check'
  )
ORDER BY p.proname;


-- ============================================================
-- TEST 07: Inspect account wallet totals
-- ============================================================

SELECT
  p.role,
  p.xp,
  p.coins,
  COUNT(c.lesson_id) AS completed_lessons,
  COALESCE(
    SUM(c.xp_awarded), 0
  ) AS recorded_xp_rewards,
  COALESCE(
    SUM(c.coins_awarded), 0
  ) AS recorded_coin_rewards
FROM public.profiles p
LEFT JOIN public.learner_lesson_completions c
  ON c.user_id = p.id
WHERE p.role = 'learner'
GROUP BY
  p.id,
  p.role,
  p.xp,
  p.coins
ORDER BY completed_lessons DESC;
