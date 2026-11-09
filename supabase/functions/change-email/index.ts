import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify the requesting user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // This function no longer changes addresses. Email changes go through
    // Supabase's 6-digit code (supabase.auth.updateUser + verifyOtp). Once the
    // code is accepted, a database trigger logs the change; this function only
    // tells the old and new addresses about it.
    const body = await req.json().catch(() => ({}));
    if (body?.newEmail) {
      return new Response(JSON.stringify({ error: "Please refresh the page and try again." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: change } = await adminClient
      .from("email_change_log")
      .select("id, old_email, new_email")
      .eq("user_id", user.id)
      .is("notified_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!change || change.new_email?.toLowerCase() !== user.email?.toLowerCase()) {
      return new Response(JSON.stringify({ success: true, notified: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await adminClient.from("email_change_log").update({ notified_at: new Date().toISOString() }).eq("id", change.id);

    const oldEmail = change.old_email as string;
    const newEmail = change.new_email as string;

    // Send notification emails via Resend
    if (resendApiKey) {
      const oldEmailHtml = `
<div style="font-family: 'Segoe UI', sans-serif; background:#f6fff8; padding:40px;">
  <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:30px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <img src="https://www.nuesa.org/logo.png" alt="NUESA Logo" style="width:80px; margin-bottom:20px;" />
    <h2 style="color:#16a34a; margin-bottom:10px;">Email Successfully Changed 📧</h2>
    <p style="color:#444; font-size:15px;">
      Your email for <strong>NUESA Portal – Faculty of Engineering</strong> has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.
      If you did not request this change, please contact the <strong>NUESA Portal Engineering Team</strong> immediately.
    </p>
    <p style="margin-top:30px; font-size:12px; color:#888;">
      NUESA Portal • Faculty of Engineering • University of Abuja
    </p>
  </div>
</div>`;

      const newEmailHtml = `
<div style="font-family: 'Segoe UI', sans-serif; background:#f6fff8; padding:40px;">
  <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:30px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <img src="https://www.nuesa.org/logo.png" alt="NUESA Logo" style="width:80px; margin-bottom:20px;" />
    <h2 style="color:#16a34a; margin-bottom:10px;">Welcome to NUESA Portal 🎉</h2>
    <p style="color:#444; font-size:15px;">
      Your email has been successfully updated to <strong>${newEmail}</strong>. You can now sign in using this email to access your NUESA Portal account.
    </p>
    <a href="https://www.nuesa.org/auth/login"
       style="display:inline-block; margin-top:25px; padding:12px 25px; background:#16a34a; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
       Access Portal
    </a>
    <p style="margin-top:30px; font-size:12px; color:#888;">
      NUESA Portal • Faculty of Engineering • University of Abuja
    </p>
  </div>
</div>`;

      // Send to old email
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "NUESA Portal <noreply@nuesa.org>",
            to: [oldEmail],
            subject: "Your NUESA Portal email has been changed",
            html: oldEmailHtml,
          }),
        });
        if (!r.ok) console.error("Resend refused the old-address email:", await r.text());
      } catch (e) {
        console.error("Failed to send old email notification:", e);
      }

      // Send to new email
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "NUESA Portal <noreply@nuesa.org>",
            to: [newEmail],
            subject: "Welcome to NUESA Portal with your new email!",
            html: newEmailHtml,
          }),
        });
        if (!r.ok) console.error("Resend refused the new-address email:", await r.text());
      } catch (e) {
        console.error("Failed to send new email notification:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Change email error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
