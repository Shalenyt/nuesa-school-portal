import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string;
  name: string;
  type: 'approved' | 'rejected' | 'suspended' | 'promoted' | 'deleted';
  role?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, name, type, role }: NotificationEmailRequest = await req.json();

    console.log(`Sending ${type} email to ${to} for ${name}`);

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
            <p>We are pleased to inform you that you have been promoted to <strong>${role}</strong>!</p>
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
            <p>Congratulations once again on this achievement!</p>
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

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);