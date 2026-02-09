
-- ============================================
-- ATTENDANCE SYSTEM
-- ============================================

-- Attendance sessions created by teachers
CREATE TABLE public.attendance_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their attendance sessions"
  ON public.attendance_sessions FOR ALL
  USING (auth.uid() = teacher_id OR is_admin());

CREATE POLICY "Students can view attendance sessions for enrolled courses"
  ON public.attendance_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_enrollments se
    WHERE se.student_id = auth.uid() AND se.course_id = attendance_sessions.course_id
  ));

-- Student attendance records
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can mark their own attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own attendance"
  ON public.attendance_records FOR SELECT
  USING (auth.uid() = student_id OR is_admin() OR EXISTS (
    SELECT 1 FROM attendance_sessions a_s
    WHERE a_s.id = attendance_records.session_id AND a_s.teacher_id = auth.uid()
  ));

-- ============================================
-- QUIZ SYSTEM
-- ============================================

CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  max_points INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage quizzes for their courses"
  ON public.quizzes FOR ALL
  USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "Students can view published quizzes for enrolled courses"
  ON public.quizzes FOR SELECT
  USING (status IN ('published', 'closed') AND EXISTS (
    SELECT 1 FROM student_enrollments se
    WHERE se.student_id = auth.uid() AND se.course_id = quizzes.course_id
  ));

-- Quiz questions
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage quiz questions"
  ON public.quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND (q.created_by = auth.uid() OR is_admin())
  ));

CREATE POLICY "Students can view questions for published quizzes"
  ON public.quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM quizzes q
    JOIN student_enrollments se ON se.course_id = q.course_id
    WHERE q.id = quiz_questions.quiz_id AND q.status IN ('published', 'closed') AND se.student_id = auth.uid()
  ));

-- Quiz submissions
CREATE TABLE public.quiz_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  answers JSONB NOT NULL DEFAULT '{}',
  score INTEGER,
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, student_id)
);

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can submit quizzes"
  ON public.quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own quiz submissions"
  ON public.quiz_submissions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view and grade quiz submissions"
  ON public.quiz_submissions FOR ALL
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_submissions.quiz_id AND q.created_by = auth.uid()
  ));
