import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;
const MIN_PASSWORD_LENGTH = 8;

// Validate email format
function validateEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

// Validate OTP format (6 digits)
function validateOTP(otp: string): boolean {
  return typeof otp === 'string' && OTP_REGEX.test(otp.trim());
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

// Generate a 6-digit numeric OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email via Titan / Custom SMTP or custom domain email providers (Resend, SendGrid, Brevo, Postmark)
async function sendCustomDomainEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string; provider?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtpout.secureserver.net";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER") || "help@styloren.com";
  const smtpPass = Deno.env.get("SMTP_PASS") || "Styloani@2026";
  const fromEmail = Deno.env.get("CUSTOM_FROM_EMAIL") || Deno.env.get("FROM_EMAIL") || smtpUser || "help@styloren.com";
  const fromName = Deno.env.get("CUSTOM_FROM_NAME") || Deno.env.get("FROM_NAME") || "Styloren";

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
  const brevoApiKey = Deno.env.get("BREVO_API_KEY") || Deno.env.get("SENDINBLUE_API_KEY");
  const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");

  // 1. Try Custom SMTP (Titan Email)
  if (smtpHost && smtpUser && smtpPass) {
    try {
      console.log(`Sending email to ${to} from ${fromEmail} via SMTP (${smtpHost}:${smtpPort})`);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });

      console.log("Email sent successfully via Titan SMTP");
      return { success: true, provider: "smtp" };
    } catch (smtpErr: any) {
      console.error("SMTP sending error:", smtpErr);
      if (!resendApiKey && !sendgridApiKey && !brevoApiKey && !postmarkToken) {
        return { success: false, error: `SMTP error: ${smtpErr.message}`, provider: "smtp" };
      }
    }
  }

  // 2. Try Resend
  if (resendApiKey) {
    try {
      console.log(`Sending email to ${to} from ${fromEmail} via Resend`);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Resend API error:", response.status, errorText);
        return { success: false, error: `Resend error: ${errorText}`, provider: "resend" };
      }

      console.log("Email sent successfully via Resend");
      return { success: true, provider: "resend" };
    } catch (err: any) {
      console.error("Resend request failed:", err);
      return { success: false, error: err.message, provider: "resend" };
    }
  }

  // 2. Try SendGrid
  if (sendgridApiKey) {
    try {
      console.log(`Sending email to ${to} from ${fromEmail} via SendGrid`);
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SendGrid API error:", response.status, errorText);
        return { success: false, error: `SendGrid error: ${errorText}`, provider: "sendgrid" };
      }

      console.log("Email sent successfully via SendGrid");
      return { success: true, provider: "sendgrid" };
    } catch (err: any) {
      console.error("SendGrid request failed:", err);
      return { success: false, error: err.message, provider: "sendgrid" };
    }
  }

  // 3. Try Brevo (Sendinblue)
  if (brevoApiKey) {
    try {
      console.log(`Sending email to ${to} from ${fromEmail} via Brevo`);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Brevo API error:", response.status, errorText);
        return { success: false, error: `Brevo error: ${errorText}`, provider: "brevo" };
      }

      console.log("Email sent successfully via Brevo");
      return { success: true, provider: "brevo" };
    } catch (err: any) {
      console.error("Brevo request failed:", err);
      return { success: false, error: err.message, provider: "brevo" };
    }
  }

  // 4. Try Postmark
  if (postmarkToken) {
    try {
      console.log(`Sending email to ${to} from ${fromEmail} via Postmark`);
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": postmarkToken,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          From: `${fromName} <${fromEmail}>`,
          To: to,
          Subject: subject,
          HtmlBody: html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Postmark API error:", response.status, errorText);
        return { success: false, error: `Postmark error: ${errorText}`, provider: "postmark" };
      }

      console.log("Email sent successfully via Postmark");
      return { success: true, provider: "postmark" };
    } catch (err: any) {
      console.error("Postmark request failed:", err);
      return { success: false, error: err.message, provider: "postmark" };
    }
  }

  console.error("No transactional email provider configured (set RESEND_API_KEY, SENDGRID_API_KEY, BREVO_API_KEY, or POSTMARK_SERVER_TOKEN)");
  return { 
    success: false, 
    error: "No email service configured. Please set RESEND_API_KEY or SENDGRID_API_KEY with your custom domain sender in Supabase Secrets." 
  };
}

// Helper to search for user across all pages
async function findUserByEmail(supabase: any, targetEmail: string) {
  const normalized = targetEmail.toLowerCase().trim();
  let page = 1;
  const perPage = 200;

  while (page <= 25) { // Check up to 5,000 users
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(`Error listing users page ${page}:`, error);
      break;
    }

    const users = data?.users || [];
    if (users.length === 0) break;

    const found = users.find(
      (u: any) => u.email?.toLowerCase().trim() === normalized
    );
    if (found) {
      return found;
    }

    if (users.length < perPage) break;
    page++;
  }

  return null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, otp, newPassword, token } = await req.json();
    
    // Validate action
    if (!action || !['request', 'verify', 'reset'].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Password reset action: ${action}`);

    if (action === "request") {
      // Validate email format
      if (!validateEmail(email)) {
        console.log("Invalid email format provided");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Rate limiting: Check if user has made more than 5 requests in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .from("password_reset_rate_limits")
        .select("id")
        .eq("email", normalizedEmail)
        .gte("requested_at", oneHourAgo);

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      }

      if (rateLimitData && rateLimitData.length >= 5) {
        console.log(`Rate limit exceeded for email`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Too many reset attempts. Please wait a few minutes before trying again." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Record this request for rate limiting
      await supabase
        .from("password_reset_rate_limits")
        .insert({ email: normalizedEmail });

      // Check if email exists in auth.users using paginated search
      const existingUser = await findUserByEmail(supabase, normalizedEmail);

      if (!existingUser) {
        console.log(`Email not found in registered users: ${normalizedEmail}`);
        // Return success to prevent email enumeration
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Invalidate any existing OTPs for this email
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("email", normalizedEmail)
        .eq("used", false);

      // Generate new OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store OTP
      const { error: insertError } = await supabase
        .from("password_reset_otps")
        .insert({
          email: normalizedEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
        });

      if (insertError) {
        console.error("Error storing OTP:", insertError);
        throw new Error("Failed to generate reset code");
      }

      // Send email via Custom Domain Email Provider
      const subject = "Styloren - Your Password Reset Code";
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #111827; border-radius: 16px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; font-size: 24px; font-weight: bold;">
              ✨
            </div>
            <h2 style="font-size: 24px; font-weight: 700; margin: 12px 0 4px 0; color: #111827;">Styloren</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Your personal AI fashion advisor</p>
          </div>

          <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; border: 1px solid #f3f4f6; margin-bottom: 24px;">
            <h1 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Reset Your Password</h1>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">
              We received a request to reset your password. Use the verification code below to complete the reset:
            </p>
            <div style="background-color: #ffffff; border: 2px dashed #e5e7eb; border-radius: 10px; padding: 18px; text-align: center; margin-bottom: 16px;">
              <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #8b5cf6;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #6b7280; margin: 0; text-align: center;">
              ⏳ This code is valid for <strong>10 minutes</strong>.
            </p>
          </div>

          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 0 0 12px 0;">
            If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>

          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} Styloren. All rights reserved.
          </p>
        </div>
      `;

      const emailResult = await sendCustomDomainEmail(normalizedEmail, subject, html);
      
      if (!emailResult.success) {
        console.error("Custom domain email sending failed:", emailResult.error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Email sending failed: ${emailResult.error || "Please verify your custom domain email configuration in Supabase Secrets."}` 
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Password reset email successfully sent via ${emailResult.provider || "custom domain"}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "A 6-digit reset code has been sent to your email." 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "verify") {
      // Validate inputs
      if (!validateEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid email format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!validateOTP(otp)) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid code format. Please enter 6 digits." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const normalizedOTP = otp.trim();

      // Find the OTP record
      const { data: otpData, error: otpError } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("otp_code", normalizedOTP)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpError) {
        console.error("Error verifying OTP:", otpError);
        return new Response(
          JSON.stringify({ success: false, message: "Verification failed. Please try again." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!otpData) {
        console.log("Invalid or expired OTP");
        return new Response(
          JSON.stringify({ success: false, message: "Invalid or expired code. Please request a new one." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Generate a verification token for the password reset step
      const verificationToken = crypto.randomUUID();

      // Update the OTP record with the verification token
      await supabase
        .from("password_reset_otps")
        .update({ 
          otp_code: verificationToken,
        })
        .eq("id", otpData.id);

      console.log("OTP verified successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Code verified successfully",
          token: verificationToken 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "reset") {
      // Validate email
      if (!validateEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid email format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate password server-side
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, message: passwordValidation.error }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Find valid verified OTP record for this email
      let otpQuery = supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (token) {
        otpQuery = otpQuery.eq("otp_code", token);
      }

      const { data: otpData, error: otpError } = await otpQuery.maybeSingle();

      if (otpError || !otpData) {
        console.error("No valid verified OTP/token found");
        return new Response(
          JSON.stringify({ success: false, message: "Session expired or verification invalid. Please start the reset process again." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find the user by email using paginated search
      const user = await findUserByEmail(supabase, normalizedEmail);

      if (!user) {
        console.error("User not found:", normalizedEmail);
        return new Response(
          JSON.stringify({ success: false, message: "User account not found." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ success: false, message: `Failed to update password: ${updateError.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark the OTP as used
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpData.id);

      console.log("Password reset successfully for user:", user.id);
      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully! You can now log in." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
