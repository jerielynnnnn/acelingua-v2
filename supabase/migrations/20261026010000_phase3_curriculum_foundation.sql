
-- =========================================================
-- ACELINGUA V2 - PHASE 3A
-- Curriculum Studio foundation
-- Preserves existing Phase 1 and Phase 2 tables.
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. INTERACTIVE LESSON ACTIVITIES
-- ---------------------------------------------------------

CREATE TABLE public.lesson_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id) ON DELETE CASCADE,

  activity_number integer NOT NULL
    CHECK (activity_number > 0),

  title text NOT NULL
    CHECK (length(trim(title)) > 0),

  instructions text,

  activity_type text NOT NULL CHECK (
    activity_type IN (
      'multiple_choice',
      'matching',
      'flip_cards',
      'word_order',
      'listening',
      'fill_blank',
      'picture_match',
      'speaking',
      'dialogue',
      'true_false',
      'memory_match',
      'translation',
      'listening_typing'
    )
  ),

  -- Presentation data: words, pairs, pictures, phrases, etc.
  content jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(content) = 'object'),

  -- Private answer/validation information.
  answer_config jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(answer_config) = 'object'),

  -- Optional connection to an existing question.
  question_id uuid
    REFERENCES public.questions(id) ON DELETE SET NULL,

  xp_reward integer NOT NULL DEFAULT 0
    CHECK (xp_reward >= 0),

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (lesson_id, activity_number)
);

CREATE INDEX lesson_activities_lesson_idx
  ON public.lesson_activities(lesson_id, activity_number);

-- ---------------------------------------------------------
-- 2. ASSESSMENT DEFINITIONS
-- ---------------------------------------------------------

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title text NOT NULL
    CHECK (length(trim(title)) > 0),

  description text,

  assessment_type text NOT NULL CHECK (
    assessment_type IN (
      'placement',
      'lesson_review',
      'unit_review',
      'course_final'
    )
  ),

  course_id uuid
    REFERENCES public.courses(id) ON DELETE CASCADE,

  unit_id uuid
    REFERENCES public.units(id) ON DELETE CASCADE,

  lesson_id uuid
    REFERENCES public.lessons(id) ON DELETE CASCADE,

  passing_score integer NOT NULL DEFAULT 70
    CHECK (passing_score BETWEEN 0 AND 100),

  max_attempts integer
    CHECK (max_attempts IS NULL OR max_attempts > 0),

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT assessment_scope_check CHECK (
    num_nonnulls(course_id, unit_id, lesson_id) = 1
  )
);

CREATE INDEX assessments_course_idx
  ON public.assessments(course_id);

CREATE INDEX assessments_unit_idx
  ON public.assessments(unit_id);

CREATE INDEX assessments_lesson_idx
  ON public.assessments(lesson_id);

-- ---------------------------------------------------------
-- 3. ASSESSMENT QUESTION ASSIGNMENTS
-- ---------------------------------------------------------

CREATE TABLE public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  assessment_id uuid NOT NULL
    REFERENCES public.assessments(id) ON DELETE CASCADE,

  question_id uuid NOT NULL
    REFERENCES public.questions(id) ON DELETE RESTRICT,

  question_number integer NOT NULL
    CHECK (question_number > 0),

  points integer NOT NULL DEFAULT 1
    CHECK (points > 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (assessment_id, question_number),
  UNIQUE (assessment_id, question_id)
);

CREATE INDEX assessment_questions_assessment_idx
  ON public.assessment_questions(
    assessment_id,
    question_number
  );

-- ---------------------------------------------------------
-- 4. CURRICULUM IMPORT TRACKING
-- ---------------------------------------------------------

CREATE TABLE public.curriculum_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  created_by uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,

  filename text NOT NULL
    CHECK (length(trim(filename)) > 0),

  format text NOT NULL
    CHECK (format IN ('xlsx', 'csv', 'json')),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'validating',
        'validated',
        'importing',
        'completed',
        'failed'
      )
    ),

  -- Validation messages and import statistics.
  report jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(report) = 'object'),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX curriculum_imports_creator_idx
  ON public.curriculum_imports(created_by, created_at DESC);

-- ---------------------------------------------------------
-- 5. DATABASE PUBLISHING INTEGRITY
-- ---------------------------------------------------------

CREATE FUNCTION public.phase3_validate_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_published boolean;
  question_belongs boolean;
BEGIN
  -- A linked question must belong to this lesson.
  IF NEW.question_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.questions q
      WHERE q.id = NEW.question_id
        AND q.lesson_id = NEW.lesson_id
    ) INTO question_belongs;

    IF question_belongs IS NOT TRUE THEN
      RAISE EXCEPTION
        'Linked question must belong to the same lesson.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'published' THEN
    SELECT
      les.status = 'published'
      AND u.status = 'published'
      AND c.status = 'published'
      AND lang.is_active
    INTO parent_published
    FROM public.lessons les
    JOIN public.units u
      ON u.id = les.unit_id
    JOIN public.courses c
      ON c.id = u.course_id
    JOIN public.languages lang
      ON lang.id = c.language_id
    WHERE les.id = NEW.lesson_id;

    IF parent_published IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'Publish the parent lesson, unit, course, and language first.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER phase3_activity_publish_guard
BEFORE INSERT OR UPDATE
ON public.lesson_activities
FOR EACH ROW
EXECUTE FUNCTION public.phase3_validate_activity();

-- Prevent assessment links from referencing a question
-- outside the assessment's course/unit/lesson scope.

CREATE FUNCTION public.phase3_validate_assessment_question()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  matching_question boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.questions q
      ON q.id = NEW.question_id
    JOIN public.lessons les
      ON les.id = q.lesson_id
    JOIN public.units u
      ON u.id = les.unit_id
    WHERE a.id = NEW.assessment_id
      AND (
        (a.lesson_id IS NOT NULL
          AND a.lesson_id = les.id)
        OR
        (a.unit_id IS NOT NULL
          AND a.unit_id = u.id)
        OR
        (a.course_id IS NOT NULL
          AND a.course_id = u.course_id)
      )
  ) INTO matching_question;

  IF matching_question IS NOT TRUE THEN
    RAISE EXCEPTION
      'Question does not belong to the assessment scope.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER phase3_assessment_question_guard
BEFORE INSERT OR UPDATE
ON public.assessment_questions
FOR EACH ROW
EXECUTE FUNCTION public.phase3_validate_assessment_question();

-- ---------------------------------------------------------
-- 6. SECURITY: RLS + EXPLICIT TABLE GRANTS
-- ---------------------------------------------------------

ALTER TABLE public.lesson_activities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assessments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assessment_questions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.curriculum_imports
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.lesson_activities,
  public.assessments,
  public.assessment_questions,
  public.curriculum_imports
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.lesson_activities,
  public.assessments,
  public.assessment_questions,
  public.curriculum_imports
TO authenticated;

-- Lesson activities contain private answer_config.
-- Consequently learners have NO direct table access.

CREATE POLICY "Admins manage lesson activities"
ON public.lesson_activities
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins manage assessments"
ON public.assessments
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins manage assessment questions"
ON public.assessment_questions
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins manage curriculum imports"
ON public.curriculum_imports
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

-- No policies are created for anon.
-- Learners cannot directly read correct answers.

-- ---------------------------------------------------------
-- 7. REMOVE PUBLIC EXECUTION OF TRIGGER FUNCTIONS
-- ---------------------------------------------------------

REVOKE ALL ON FUNCTION
  public.phase3_validate_activity()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.phase3_validate_assessment_question()
FROM PUBLIC, anon, authenticated;

COMMIT;
