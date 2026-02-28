export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          course_id: string | null
          created_at: string
          department_id: string | null
          id: string
          is_pinned: boolean | null
          level_id: string | null
          title: string
          type: Database["public"]["Enums"]["announcement_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_pinned?: boolean | null
          level_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_pinned?: boolean | null
          level_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          file_name: string | null
          file_url: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          student_id: string
          submission_text: string | null
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          file_name?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          student_id: string
          submission_text?: string | null
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          file_name?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          student_id?: string
          submission_text?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          grades_locked: boolean | null
          id: string
          max_points: number | null
          results_released: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          grades_locked?: boolean | null
          id?: string
          max_points?: number | null
          results_released?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          grades_locked?: boolean | null
          id?: string
          max_points?: number | null
          results_released?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          checked_in_at: string
          distance_meters: number | null
          id: string
          latitude: number | null
          longitude: number | null
          session_id: string
          student_id: string
        }
        Insert: {
          checked_in_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_id: string
          student_id: string
        }
        Update: {
          checked_in_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          allowed_radius_meters: number | null
          attendance_type: string
          course_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          session_date: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          allowed_radius_meters?: number | null
          attendance_type?: string
          course_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_date?: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          allowed_radius_meters?: number | null
          attendance_type?: string
          course_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_date?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          manifesto: string | null
          position_id: string
          profile_pic: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          manifesto?: string | null
          position_id: string
          profile_pic?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          manifesto?: string | null
          position_id?: string
          profile_pic?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "electoral_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          grade_level: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grade_level?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grade_level?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_lists: {
        Row: {
          class_id: string
          course_ids: string[] | null
          created_at: string
          id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          course_ids?: string[] | null
          created_at?: string
          id?: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          course_ids?: string[] | null
          created_at?: string
          id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lists_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lists_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          academic_year: string | null
          class_id: string
          created_at: string
          credit_unit: number | null
          description: string | null
          id: string
          name: string | null
          semester: string | null
          subject_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          class_id: string
          created_at?: string
          credit_unit?: number | null
          description?: string | null
          id?: string
          name?: string | null
          semester?: string | null
          subject_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          class_id?: string
          created_at?: string
          credit_unit?: number | null
          description?: string | null
          id?: string
          name?: string | null
          semester?: string | null
          subject_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      election_results: {
        Row: {
          calculated_at: string
          candidate_id: string
          id: string
          is_winner: boolean
          position_id: string
          vote_count: number
        }
        Insert: {
          calculated_at?: string
          candidate_id: string
          id?: string
          is_winner?: boolean
          position_id: string
          vote_count?: number
        }
        Update: {
          calculated_at?: string
          candidate_id?: string
          id?: string
          is_winner?: boolean
          position_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_results_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "electoral_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      electoral_positions: {
        Row: {
          created_at: string
          description: string | null
          election_status: string
          id: string
          name: string
          published: boolean
          updated_at: string
          voting_end_time: string | null
          voting_open: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          election_status?: string
          id?: string
          name: string
          published?: boolean
          updated_at?: string
          voting_end_time?: string | null
          voting_open?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          election_status?: string
          id?: string
          name?: string
          published?: boolean
          updated_at?: string
          voting_end_time?: string | null
          voting_open?: boolean
        }
        Relationships: []
      }
      exam_timetables: {
        Row: {
          course_code: string
          created_at: string
          created_by: string
          day_label: string
          department_id: string | null
          end_time: string
          exam_date: string
          id: string
          level_id: string | null
          start_time: string
          time_slot: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          course_code: string
          created_at?: string
          created_by: string
          day_label: string
          department_id?: string | null
          end_time: string
          exam_date: string
          id?: string
          level_id?: string | null
          start_time: string
          time_slot: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          course_code?: string
          created_at?: string
          created_by?: string
          day_label?: string
          department_id?: string | null
          end_time?: string
          exam_date?: string
          id?: string
          level_id?: string | null
          start_time?: string
          time_slot?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_timetables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_timetables_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_timetables_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          is_anonymous: boolean
          is_read: boolean
          message: string
          subject: string
          type: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_read?: boolean
          message: string
          subject: string
          type?: string
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_read?: boolean
          message?: string
          subject?: string
          type?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      grade_audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          performed_by?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged: boolean | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          priority: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          priority?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          priority?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_paid: number
          id: string
          paid_at: string
          payment_id: string
          payment_method: string | null
          receipt_number: string
          reference: string
          status: string
          student_id: string
          verified_by: string | null
        }
        Insert: {
          amount_paid: number
          id?: string
          paid_at?: string
          payment_id: string
          payment_method?: string | null
          receipt_number: string
          reference: string
          status?: string
          student_id: string
          verified_by?: string | null
        }
        Update: {
          amount_paid?: number
          id?: string
          paid_at?: string
          payment_id?: string
          payment_method?: string | null
          receipt_number?: string
          reference?: string
          status?: string
          student_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allow_partial: boolean | null
          amount: number
          course_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          late_penalty: number | null
          level_id: string | null
          payment_type: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          allow_partial?: boolean | null
          amount: number
          course_id?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          late_penalty?: number | null
          level_id?: string | null
          payment_type?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          allow_partial?: boolean | null
          amount?: number
          course_id?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          late_penalty?: number | null
          level_id?: string | null
          payment_type?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          level_id: string | null
          phone: string | null
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          staff_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          level_id?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          level_id?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: number
          id: string
          options: Json
          points: number
          question_text: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_answer: number
          id?: string
          options?: Json
          points?: number
          question_text: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_answer?: number
          id?: string
          options?: Json
          points?: number
          question_text?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          answers: Json
          device_info: Json | null
          graded_at: string | null
          graded_by: string | null
          id: string
          ip_address: string | null
          latitude: number | null
          location_consent: boolean | null
          longitude: number | null
          quiz_id: string
          score: number | null
          student_id: string
          submitted_at: string
          tab_switch_count: number | null
        }
        Insert: {
          answers?: Json
          device_info?: Json | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_consent?: boolean | null
          longitude?: number | null
          quiz_id: string
          score?: number | null
          student_id: string
          submitted_at?: string
          tab_switch_count?: number | null
        }
        Update: {
          answers?: Json
          device_info?: Json | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_consent?: boolean | null
          longitude?: number | null
          quiz_id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string
          tab_switch_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_violation_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          quiz_id: string
          student_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          quiz_id: string
          student_id: string
          violation_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          quiz_id?: string
          student_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_violation_logs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_violation_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allowed_radius_meters: number | null
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          gps_enabled: boolean | null
          grades_locked: boolean | null
          id: string
          latitude: number | null
          longitude: number | null
          max_points: number
          results_released: boolean | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          allowed_radius_meters?: number | null
          course_id: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          gps_enabled?: boolean | null
          grades_locked?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_points?: number
          results_released?: boolean | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          allowed_radius_meters?: number | null
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          gps_enabled?: boolean | null
          grades_locked?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_points?: number
          results_released?: boolean | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_templates: {
        Row: {
          created_at: string
          id: string
          payment_type: string
          template_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_type: string
          template_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_type?: string
          template_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          created_at: string
          financial_secretary_signature_url: string | null
          id: string
          logo_url: string | null
          portal_name: string | null
          president_signature_url: string | null
          school_name: string
          singleton: boolean
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          financial_secretary_signature_url?: string | null
          id?: string
          logo_url?: string | null
          portal_name?: string | null
          president_signature_url?: string | null
          school_name?: string
          singleton?: boolean
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          financial_secretary_signature_url?: string | null
          id?: string
          logo_url?: string | null
          portal_name?: string | null
          president_signature_url?: string | null
          school_name?: string
          singleton?: boolean
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      semester_config: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      timetable: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          position_id: string
          voter_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          position_id: string
          voter_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          position_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "electoral_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
      verify_student_public: {
        Args: { student_matric: string }
        Returns: {
          department_name: string
          full_name: string
          level_name: string
          profile_photo_url: string
          status: string
          student_id: string
        }[]
      }
    }
    Enums: {
      announcement_type:
        | "global"
        | "class"
        | "subject"
        | "general"
        | "urgent"
        | "academic"
      application_status: "pending" | "approved" | "rejected"
      user_role: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      announcement_type: [
        "global",
        "class",
        "subject",
        "general",
        "urgent",
        "academic",
      ],
      application_status: ["pending", "approved", "rejected"],
      user_role: ["admin", "teacher", "student"],
    },
  },
} as const
