import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Returns a short-lived link to ONE student's profile photo, looked up by the
// random 10-character code on their NUESA Portal ID. Used by the public QR
// verification page: scanners aren't logged in, and the profile-photos bucket
// is private, so the page can't create the link itself.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "profile-photos";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code } = await req.json().catch(() => ({}));
    // Same rule as verify_student_by_code: exactly 10 characters
    if (typeof code !== "string" || code.length !== 10) return json({ url: null });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: student } = await admin
      .from("profiles")
      .select("profile_photo_url")
      .eq("role", "student")
      .eq("public_student_id", code)
      .maybeSingle();

    const stored = student?.profile_photo_url;
    if (!stored) return json({ url: null });

    // Photo stored outside the private bucket: return it as is
    if (!stored.includes(`/${BUCKET}/`)) return json({ url: stored });

    const path = decodeURIComponent(stored.split(`/${BUCKET}/`).pop()!.split("?")[0]);
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 30);
    if (error || !data?.signedUrl) return json({ url: null });

    return json({ url: data.signedUrl });
  } catch (error) {
    console.error("verify-student-photo error:", error);
    return json({ url: null }, 500);
  }
});
