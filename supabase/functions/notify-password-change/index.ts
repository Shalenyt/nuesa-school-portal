import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email!;

    const html = `
<div style="font-family: 'Segoe UI', sans-serif; background:#f6fff8; padding:40px;">
  <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:30px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <img src="https://www.nuesa.org/logo.png" alt="NUESA Logo" style="width:80px; margin-bottom:20px;" />
    <h2 style="color:#16a34a;">Password Updated Successfully 🔐</h2>
    <p style="color:#444; font-size:15px;">
      Hello 👋,<br><br>
      This is a confirmation that the password for your <strong>NUESA Portal</strong> account
      (<strong>${email}</strong>) has been successfully changed.
    </p>
    <p style="color:#444; font-size:15px;">
      If you made this change, no further action is required.<br>
      If you did <strong>NOT</strong> make this change, please secure your account immediately by contacting the NUESA administration.
    </p>
    <p style="margin-top:30px; font-size:12px; color:#888;">
      NUESA Portal • Faculty of Engineering • University of Abuja
    </p>
  </div>
</div>`;

    await resend.emails.send({
      from: "NUESA Portal <noreply@notify.nuesa.com.ng>",
      to: [email],
      subject: "Your NUESA Portal password has been changed 🔐",
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Password change notification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
