import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationEmailRequest {
  to: string;
  name: string;
  type: 'approved' | 'rejected' | 'suspended' | 'promoted' | 'deleted';
  role?: string;
}

const VALID_TYPES = ['approved', 'rejected', 'suspended', 'promoted', 'deleted'];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
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

    // Verify caller is an admin
    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      console.log("Non-admin attempted to send notification email:", userId);
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to, name, type, role }: NotificationEmailRequest = await req.json();

    // Validate inputs
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

    // Validate email exists in profiles table
    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", to)
      .maybeSingle();

    if (targetError || !targetProfile) {
      console.log("Attempted to send email to non-existent profile:", to);
      return new Response(JSON.stringify({ error: "Target email not found in system" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Admin ${userId} sending ${type} email to ${to} for ${name}`);

    let subject = "";
    let html = "";

    switch (type) {
      case 'approved':
        subject = "Application Approved - Welcome!";
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #22c55e; text-align: center;">Application Approved!</h1>
            <p>Dear ${name},</p>
            <p>Congratulations! Your application has been <strong>approved</strong> and you can now access the portal.</p>
            <div style="background: #f0fdf4; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #166534;">✅ You can now log in to your account and access all features.</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Log in to your account using your credentials</li>
              <li>Complete your profile information</li>
              <li>Explore the available features</li>
            </ul>
            <p>If you have any questions, please don't hesitate to contact the administration.</p>
            <p>Best regards,<br>OAUSTECH Portal Team</p>
          </div>
        `;
        break;

      case 'rejected':
        subject = "Application Status Update";
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; text-align: center;">Application Status Update</h1>
            <p>Dear ${name},</p>
            <p>We regret to inform you that your application has been <strong>rejected</strong>.</p>
            <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;">⚠️ Please contact the faculty authorities to resolve any issues or for more information.</p>
            </div>
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Contact the admissions office for clarification</li>
              <li>Review your application requirements</li>
              <li>Consider reapplying after addressing any issues</li>
            </ul>
            <p>For assistance, please visit the faculty office during business hours or contact the administration.</p>
            <p>Best regards,<br>OAUSTECH Portal Team</p>
          </div>
        `;
        break;

      case 'suspended':
        subject = "Account Suspended - Action Required";
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; text-align: center;">Account Suspended</h1>
            <p>Dear ${name},</p>
            <p>Your account has been <strong>suspended</strong> temporarily.</p>
            <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;">⚠️ Please contact the faculty authorities immediately to resolve this issue and reactivate your account.</p>
            </div>
            <p><strong>Important:</strong></p>
            <ul>
              <li>Your access to the portal has been temporarily restricted</li>
              <li>Contact the administration office for clarification</li>
              <li>Bring any required documentation for account restoration</li>
            </ul>
            <p>Please visit the faculty office during business hours to resolve this matter promptly.</p>
            <p>Best regards,<br>OAUSTECH Portal Team</p>
          </div>
        `;
        break;

      case 'promoted':
        subject = "Congratulations - Role Promotion!";
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #3b82f6; text-align: center;">Congratulations on Your Promotion!</h1>
            <p>Dear ${name},</p>
            <p>We are pleased to inform you that you have been promoted to <strong>${role || 'a new role'}</strong>!</p>
            <div style="background: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af;">🎉 Your new role and permissions are now active in the portal.</p>
            </div>
            <p><strong>What this means:</strong></p>
            <ul>
              <li>Access to additional features and permissions</li>
              <li>New responsibilities within the system</li>
              <li>Enhanced administrative capabilities</li>
            </ul>
            <p>Log in to your account to explore your new features and responsibilities.</p>
            <p>Best regards,<br>OAUSTECH Portal Team</p>
          </div>
        `;
        break;

      case 'deleted':
        subject = "Account Deletion Notice";
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626; text-align: center;">Account Deletion Notice</h1>
            <p>Dear ${name},</p>
            <p>This is to inform you that your account has been <strong>permanently deleted</strong> from the OAUSTECH Portal.</p>
            <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;">⚠️ All your data and access have been permanently removed from the system.</p>
            </div>
            <p><strong>What this means:</strong></p>
            <ul>
              <li>Your account and all associated data have been permanently deleted</li>
              <li>You no longer have access to the portal</li>
              <li>This email address can now be used to create a new account if needed</li>
            </ul>
            <p>If you believe this was done in error or need to create a new account, please contact the administration office.</p>
            <p>Best regards,<br>OAUSTECH Portal Team</p>
          </div>
        `;
        break;
    }

    const emailResponse = await resend.emails.send({
      from: "OAUSTECH Portal <onboarding@resend.dev>",
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
