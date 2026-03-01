import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check - only admin can trigger
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { type, course_code, exam_date, time_slot, venue, start_time, end_time } = body;

    if (type === "exam_created" && course_code) {
      // Find courses matching this code by course name
      const { data: courses } = await supabase
        .from("courses")
        .select("id, name, teacher_id")
        .order("created_at", { ascending: false });

      const matchingCourses = (courses || []).filter(
        (c: any) => c.name?.toUpperCase() === course_code.toUpperCase()
      );

      const courseIds = matchingCourses.map((c: any) => c.id);
      const teacherIds = matchingCourses
        .map((c: any) => c.teacher_id)
        .filter(Boolean);

      // Get enrolled students
      if (courseIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("student_enrollments")
          .select("student_id")
          .in("course_id", courseIds);

        const studentIds = [...new Set((enrollments || []).map((e: any) => e.student_id))];
        const allUserIds = [...new Set([...studentIds, ...teacherIds])];

        if (allUserIds.length > 0) {
          const dateFormatted = new Date(exam_date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          const notifications = allUserIds.map((uid) => {
            const isTeacher = teacherIds.includes(uid);
            return {
              user_id: uid,
              title: `📝 Exam Scheduled: ${course_code}`,
              message: isTeacher
                ? `You are scheduled to supervise ${course_code} exam on ${dateFormatted} (${start_time} – ${end_time}).${venue ? ` Venue: ${venue}` : ""}`
                : `You have an upcoming exam for ${course_code} on ${dateFormatted} (${start_time} – ${end_time}).${venue ? ` Venue: ${venue}` : ""}`,
              type: "exam",
              priority: "normal",
              is_read: false,
            };
          });

          for (let i = 0; i < notifications.length; i += 500) {
            await supabase.from("notifications").insert(notifications.slice(i, i + 500));
          }

          return new Response(
            JSON.stringify({ sent: notifications.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Reminder mode - called by cron
    if (type === "reminders") {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const dayAfterStr = dayAfterTomorrow.toISOString().split("T")[0];

      // Get exams in next 2 days
      const { data: upcomingExams } = await (supabase as any)
        .from("exam_timetables")
        .select("*")
        .in("exam_date", [tomorrowStr, dayAfterStr]);

      let totalSent = 0;

      for (const exam of upcomingExams || []) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, name, teacher_id")
          .order("created_at", { ascending: false });

        const matching = (courses || []).filter(
          (c: any) => c.name?.toUpperCase() === exam.course_code.toUpperCase()
        );
        const cIds = matching.map((c: any) => c.id);
        const tIds = matching.map((c: any) => c.teacher_id).filter(Boolean);

        if (cIds.length > 0) {
          const { data: enrollments } = await supabase
            .from("student_enrollments")
            .select("student_id")
            .in("course_id", cIds);

          const sIds = [...new Set((enrollments || []).map((e: any) => e.student_id))];
          const allIds = [...new Set([...sIds, ...tIds])];

          const daysUntil = exam.exam_date === tomorrowStr ? "tomorrow" : "in 2 days";
          const dateFormatted = new Date(exam.exam_date).toLocaleDateString("en-GB", {
            weekday: "long", day: "2-digit", month: "short", year: "numeric",
          });

          const notifs = allIds.map((uid) => ({
            user_id: uid,
            title: `⏰ Exam Reminder: ${exam.course_code}`,
            message: `Reminder: ${exam.course_code} exam is ${daysUntil} on ${dateFormatted} (${exam.start_time} – ${exam.end_time}).${exam.venue ? ` Venue: ${exam.venue}` : ""}`,
            type: "exam_reminder",
            priority: daysUntil === "tomorrow" ? "urgent" : "normal",
            is_read: false,
          }));

          for (let i = 0; i < notifs.length; i += 500) {
            await supabase.from("notifications").insert(notifs.slice(i, i + 500));
          }
          totalSent += notifs.length;
        }
      }

      return new Response(
        JSON.stringify({ reminders_sent: totalSent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ message: "No action taken" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in exam-notifications:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
