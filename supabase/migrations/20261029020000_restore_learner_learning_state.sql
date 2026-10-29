BEGIN;

-- The preceding progress migration created the completion ledger but omitted
-- the zero-argument RPC consumed by lib/learn/progress-actions.ts.
-- This repair is read-only: no completion, reward, or snapshot data is changed.
CREATE OR REPLACE FUNCTION public.get_learner_learning_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_user_id AND p.role = 'learner'
  ) THEN
    RAISE EXCEPTION 'Learner access required' USING ERRCODE = '42501';
  END IF;

  WITH published AS (
    SELECT
      s.lesson_id, s.course_id, s.unit_id,
      s.course_title, s.unit_title, s.lesson_title, s.published_at,
      u.unit_number, l.lesson_number,
      row_number() OVER (
        PARTITION BY s.course_id
        ORDER BY u.unit_number, l.lesson_number, s.unit_id, s.lesson_id
      ) AS sequence_number
    FROM public.published_lesson_snapshots s
    JOIN public.lessons l ON l.id = s.lesson_id
    JOIN public.units u ON u.id = s.unit_id
    WHERE s.status = 'published'
  ), roadmap AS (
    SELECT p.*, c.score, c.completed_at, c.xp_awarded, c.coins_awarded,
      c.lesson_id IS NOT NULL AS completed,
      c.lesson_id IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM published earlier
        WHERE earlier.course_id = p.course_id
          AND earlier.sequence_number < p.sequence_number
          AND NOT EXISTS (
            SELECT 1 FROM public.learner_lesson_completions done
            WHERE done.user_id = v_user_id AND done.lesson_id = earlier.lesson_id
          )
      ) AS unlocked
    FROM published p
    LEFT JOIN public.learner_lesson_completions c
      ON c.lesson_id = p.lesson_id AND c.user_id = v_user_id
  )
  SELECT jsonb_build_object(
    'lessons', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'lessonId', r.lesson_id,
        'courseId', r.course_id,
        'unitId', r.unit_id,
        'courseTitle', r.course_title,
        'unitTitle', r.unit_title,
        'lessonTitle', r.lesson_title,
        'unitNumber', r.unit_number,
        'lessonNumber', r.lesson_number,
        'publishedAt', r.published_at,
        'completed', r.completed,
        'unlocked', r.unlocked,
        'score', r.score,
        'completedAt', r.completed_at,
        'xpAwarded', r.xp_awarded,
        'coinsAwarded', r.coins_awarded
      ) ORDER BY r.course_title, r.course_id, r.sequence_number)
      FROM roadmap r
    ), '[]'::jsonb),
    -- Previously earned rewards remain earned even if a lesson is withdrawn.
    'xp', (SELECT coalesce(sum(c.xp_awarded), 0)
           FROM public.learner_lesson_completions c WHERE c.user_id = v_user_id),
    'coins', (SELECT coalesce(sum(c.coins_awarded), 0)
              FROM public.learner_lesson_completions c WHERE c.user_id = v_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_learner_learning_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_learner_learning_state() TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
