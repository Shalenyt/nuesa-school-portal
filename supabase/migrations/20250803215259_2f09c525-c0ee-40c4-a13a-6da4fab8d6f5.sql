-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'teacher', 'student');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for announcement types
CREATE TYPE public.announcement_type AS ENUM ('global', 'class', 'subject');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  student_id TEXT,
  staff_id TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(student_id),
  UNIQUE(staff_id)
);

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  grade_level INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table (linking classes and subjects with teachers)
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  semester TEXT,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id, semester, academic_year)
);

-- Create student enrollments table
CREATE TABLE public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type announcement_type NOT NULL DEFAULT 'global',
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  due_date TIMESTAMP WITH TIME ZONE,
  max_points INTEGER DEFAULT 100,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assignment submissions table
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  submission_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  grade INTEGER,
  feedback TEXT,
  graded_by UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(assignment_id, student_id)
);

-- Create timetable table
CREATE TABLE public.timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to check if user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'teacher' AND status = 'approved'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all approved profiles" ON public.profiles
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can insert profile during signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can do everything with profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Create RLS policies for classes
CREATE POLICY "Anyone can view classes" ON public.classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage classes" ON public.classes
  FOR ALL USING (public.is_admin());

-- Create RLS policies for subjects
CREATE POLICY "Anyone can view subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage subjects" ON public.subjects
  FOR ALL USING (public.is_admin());

-- Create RLS policies for courses
CREATE POLICY "Anyone can view courses" ON public.courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and teachers can manage courses" ON public.courses
  FOR ALL USING (public.is_admin() OR public.is_teacher());

-- Create RLS policies for student enrollments
CREATE POLICY "Students can view their enrollments" ON public.student_enrollments
  FOR SELECT USING (
    auth.uid() = student_id OR 
    public.is_admin() OR 
    public.is_teacher()
  );

CREATE POLICY "Admins can manage enrollments" ON public.student_enrollments
  FOR ALL USING (public.is_admin());

-- Create RLS policies for announcements
CREATE POLICY "Users can view relevant announcements" ON public.announcements
  FOR SELECT USING (
    type = 'global' OR 
    public.is_admin() OR
    (type = 'class' AND EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      JOIN public.courses c ON se.course_id = c.id 
      WHERE se.student_id = auth.uid() AND c.id = course_id
    )) OR
    (type = 'subject' AND EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      WHERE se.student_id = auth.uid() AND se.course_id = course_id
    ))
  );

CREATE POLICY "Teachers and admins can create announcements" ON public.announcements
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_teacher());

CREATE POLICY "Authors and admins can update announcements" ON public.announcements
  FOR UPDATE USING (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "Authors and admins can delete announcements" ON public.announcements
  FOR DELETE USING (auth.uid() = author_id OR public.is_admin());

-- Create RLS policies for materials
CREATE POLICY "Enrolled students and teachers can view materials" ON public.materials
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      WHERE se.student_id = auth.uid() AND se.course_id = course_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.teacher_id = auth.uid() AND c.id = course_id
    )
  );

CREATE POLICY "Teachers and admins can manage materials" ON public.materials
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.teacher_id = auth.uid() AND c.id = course_id
    )
  );

-- Create RLS policies for assignments
CREATE POLICY "Enrolled students and teachers can view assignments" ON public.assignments
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      WHERE se.student_id = auth.uid() AND se.course_id = course_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.teacher_id = auth.uid() AND c.id = course_id
    )
  );

CREATE POLICY "Teachers and admins can manage assignments" ON public.assignments
  FOR ALL USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.teacher_id = auth.uid() AND c.id = course_id
    )
  );

-- Create RLS policies for assignment submissions
CREATE POLICY "Students can view their own submissions" ON public.assignment_submissions
  FOR SELECT USING (
    auth.uid() = student_id OR
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.courses c ON a.course_id = c.id
      WHERE a.id = assignment_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert their own submissions" ON public.assignment_submissions
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own submissions" ON public.assignment_submissions
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Teachers can grade submissions for their courses" ON public.assignment_submissions
  FOR UPDATE USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.courses c ON a.course_id = c.id
      WHERE a.id = assignment_id AND c.teacher_id = auth.uid()
    )
  );

-- Create RLS policies for timetable
CREATE POLICY "Enrolled students can view timetable" ON public.timetable
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      WHERE se.student_id = auth.uid() AND se.course_id = course_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.courses c 
      WHERE c.teacher_id = auth.uid() AND c.id = course_id
    )
  );

CREATE POLICY "Admins can manage timetable" ON public.timetable
  FOR ALL USING (public.is_admin());

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_timetable_updated_at BEFORE UPDATE ON public.timetable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', false);

-- Create storage policies for profile photos
CREATE POLICY "Profile photos are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile photo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage policies for materials
CREATE POLICY "Enrolled users can view materials" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'materials' AND (
      public.is_admin() OR
      EXISTS (
        SELECT 1 FROM public.materials m
        JOIN public.student_enrollments se ON m.course_id = se.course_id
        WHERE se.student_id = auth.uid() AND m.file_url LIKE '%' || name || '%'
      ) OR
      EXISTS (
        SELECT 1 FROM public.materials m
        JOIN public.courses c ON m.course_id = c.id
        WHERE c.teacher_id = auth.uid() AND m.file_url LIKE '%' || name || '%'
      )
    )
  );

CREATE POLICY "Teachers can upload materials" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'materials' AND (
      public.is_admin() OR public.is_teacher()
    )
  );

-- Create storage policies for assignments
CREATE POLICY "Enrolled users can view assignment files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'assignments' AND (
      public.is_admin() OR
      EXISTS (
        SELECT 1 FROM public.assignment_submissions asub
        WHERE asub.student_id = auth.uid() AND asub.file_url LIKE '%' || name || '%'
      ) OR
      EXISTS (
        SELECT 1 FROM public.assignment_submissions asub
        JOIN public.assignments a ON asub.assignment_id = a.id
        JOIN public.courses c ON a.course_id = c.id
        WHERE c.teacher_id = auth.uid() AND asub.file_url LIKE '%' || name || '%'
      )
    )
  );

CREATE POLICY "Students can upload assignment submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assignments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );