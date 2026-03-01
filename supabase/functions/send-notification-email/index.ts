import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

interface NotificationEmailRequest {
  to: string;
  name: string;
  type: 'approved' | 'rejected' | 'suspended' | 'promoted' | 'deleted';
  role?: string;
}

const VALID_TYPES = ['approved', 'rejected', 'suspended', 'promoted', 'deleted'];

const LOGO_URL = "https://nuesauofa.vercel.app/logo.png";
const LOGIN_URL = "https://nuesauofa.vercel.app/auth/login";
const PORTAL_NAME = "NUESA Portal";
const FOOTER_TEXT = "NUESA Portal • Faculty of Engineering • University of Abuja";

function wrapInBrandedTemplate(title: string, titleColor: string, bodyHtml: string): string {
  return `
<div style="font-family: 'Segoe UI', sans-serif; background:#f6fff8; padding:40px;">
  <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:30px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <img src="${LOGO_URL}" alt="NUESA Logo" style="width:80px; margin-bottom:20px;" />
    <h2 style="color:${titleColor}; margin-bottom:10px;">${title}</h2>
    <div style="color:#444; font-size:15px; text-align:left;">
      ${bodyHtml}
    </div>
    <p style="margin-top:30px; font-size:12px; color:#888;">
      ${FOOTER_TEXT}
    </p>
  </div>
</div>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub;

    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to, name, type, role }: NotificationEmailRequest = await req.json();

    if (!to || !name || !type) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, name, type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid notification type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("email, id")
      .eq("email", to)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Target email not found in system" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // When approving a user, auto-confirm their email in Supabase Auth
    // This fixes the "email not confirmed" error for approved users
    if (type === 'approved' && targetProfile.id) {
      try {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await adminClient.auth.admin.updateUserById(targetProfile.id, {
          email_confirm: true,
        });
        console.log(`Auto-confirmed email for user ${targetProfile.id}`);
      } catch (confirmError) {
        console.error("Failed to auto-confirm email:", confirmError);
        // Continue with the notification even if confirmation fails
      }
    }

    console.log(`Admin ${userId} sending ${type} email to ${to} for ${name}`);

    let subject = "";
    let html = "";

    switch (type) {
      case 'approved':
        subject = `Welcome to ${PORTAL_NAME} – Account Approved 🎉`;
        html = wrapInBrandedTemplate(
          "Account Approved! 🎉",
          "#16a34a",
          `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Congratulations! Your application to the <strong>${PORTAL_NAME}</strong> has been <strong>approved</strong>.</p>
          <div style="background:#f0fdf4; border:1px solid #16a34a; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; color:#166534;">✅ Your account is now active. You can log in and start using all portal features.</p>
          </div>
          <p><strong>Next Steps:</strong></p>
          <ul style="color:#444;">
            <li>Log in using your registered email and password</li>
            <li>Complete your profile information</li>
            <li>Explore courses, timetables, and more</li>
          </ul>
          <div style="text-align:center; margin-top:25px;">
            <a href="${LOGIN_URL}" style="display:inline-block; padding:12px 25px; background:#16a34a; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
              Login to Portal
            </a>
          </div>
          `
        );
        break;

      case 'rejected':
        subject = `${PORTAL_NAME} – Application Status Update`;
        html = wrapInBrandedTemplate(
          "Application Not Approved ❌",
          "#dc2626",
          `
          <p>Dear <strong>${name}</strong>,</p>
          <p>We regret to inform you that your application to the <strong>${PORTAL_NAME}</strong> has not been approved at this time.</p>
          <div style="background:#fef2f2; border:1px solid #dc2626; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; color:#991b1b;">⚠️ Please contact the NUESA administration for more information or to resolve any issues.</p>
          </div>
          <p><strong>What you can do:</strong></p>
          <ul style="color:#444;">
            <li>Contact the NUESA office for clarification</li>
            <li>Review your application details</li>
            <li>Consider reapplying after addressing any issues</li>
          </ul>
          `
        );
        break;

      case 'suspended':
        subject = `${PORTAL_NAME} – Account Suspended`;
        html = wrapInBrandedTemplate(
          "Account Suspended ⚠️",
          "#dc2626",
          `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your <strong>${PORTAL_NAME}</strong> account has been <strong>temporarily suspended</strong>.</p>
          <div style="background:#fef2f2; border:1px solid #dc2626; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; color:#991b1b;">⚠️ Your access to the portal has been restricted. Please contact the NUESA administration immediately.</p>
          </div>
          <p><strong>Important:</strong></p>
          <ul style="color:#444;">
            <li>Your access to all portal features has been temporarily disabled</li>
            <li>Contact the NUESA office for clarification</li>
            <li>Bring any required documentation for account restoration</li>
          </ul>
          `
        );
        break;

      case 'promoted':
        subject = `${PORTAL_NAME} – Congratulations on Your Promotion! 🎉`;
        html = wrapInBrandedTemplate(
          "Role Promotion! 🎉",
          "#3b82f6",
          `
          <p>Dear <strong>${name}</strong>,</p>
          <p>We are pleased to inform you that you have been promoted to <strong>${role || 'a new role'}</strong> on the <strong>${PORTAL_NAME}</strong>!</p>
          <div style="background:#eff6ff; border:1px solid #3b82f6; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; color:#1e40af;">🎉 Your new role and permissions are now active.</p>
          </div>
          <p><strong>What this means:</strong></p>
          <ul style="color:#444;">
            <li>Access to additional features and permissions</li>
            <li>New responsibilities within the system</li>
            <li>Enhanced administrative capabilities</li>
          </ul>
          <div style="text-align:center; margin-top:25px;">
            <a href="${LOGIN_URL}" style="display:inline-block; padding:12px 25px; background:#16a34a; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
              Access Portal
            </a>
          </div>
          `
        );
        break;

      case 'deleted':
        subject = `${PORTAL_NAME} – Account Deletion Notice`;
        html = wrapInBrandedTemplate(
          "Account Deleted 🗑️",
          "#dc2626",
          `
          <p>Dear <strong>${name}</strong>,</p>
          <p>This is to inform you that your account has been <strong>permanently deleted</strong> from the <strong>${PORTAL_NAME}</strong>.</p>
          <div style="background:#fef2f2; border:1px solid #dc2626; padding:15px; border-radius:8px; margin:20px 0;">
            <p style="margin:0; color:#991b1b;">⚠️ All your data and access have been permanently removed from the system.</p>
          </div>
          <p><strong>What this means:</strong></p>
          <ul style="color:#444;">
            <li>Your account and all associated data have been permanently deleted</li>
            <li>You no longer have access to the portal</li>
            <li>This email address can be used to create a new account if needed</li>
          </ul>
          <p>If you believe this was done in error, please contact the NUESA administration.</p>
          `
        );
        break;
    }

    const emailResponse = await resend.emails.send({
      from: "NUESA Portal <noreply@notify.nuesa.com.ng>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
