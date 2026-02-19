import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

// Send email via SendGrid
async function sendEmailViaSendGrid(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  
  if (!apiKey) {
    console.error("SendGrid API key not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    console.log(`Sending email to ${to} via SendGrid`);
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "noreply@styloren.com", name: "Styloren" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid error:", response.status, errorText);
      return { success: false, error: "Failed to send email" };
    }

    console.log("Email sent successfully via SendGrid");
    return { success: true };
  } catch (error) {
    console.error("SendGrid request failed:", error);
    return { success: false, error: "Email service unavailable" };
  }
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

    const { action, email, otp, newPassword } = await req.json();
    
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
        // Return success to prevent email enumeration
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Rate limiting: Check if user has made more than 3 requests in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .from("password_reset_rate_limits")
        .select("id")
        .eq("email", normalizedEmail)
        .gte("requested_at", oneHourAgo);

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      }

      if (rateLimitData && rateLimitData.length >= 3) {
        console.log(`Rate limit exceeded for email`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Record this request for rate limiting
      await supabase
        .from("password_reset_rate_limits")
        .insert({ email: normalizedEmail });

      // Check if email exists in auth.users
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error checking user:", userError);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const userExists = userData?.users?.some(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!userExists) {
        console.log(`Email not found`);
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

      // Send email via SendGrid
      const subject = "Styloren Password Reset OTP";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Password Reset</h1>
          <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
            Your Styloren password reset OTP is:
          </p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otpCode}</span>
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
            This OTP is valid for <strong>10 minutes</strong>.
          </p>
          <p style="color: #999; font-size: 14px;">
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `;

      const emailResult = await sendEmailViaSendGrid(normalizedEmail, subject, html);
      
      if (!emailResult.success) {
        console.error("Email sending failed:", emailResult.error);
        // Still return success to prevent information leakage
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "If this email is registered, you will receive a reset code shortly." 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Password reset email sent successfully");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If this email is registered, you will receive a reset code shortly." 
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
          JSON.stringify({ success: false, message: "Verification failed" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!otpData) {
        console.log("Invalid or expired OTP");
        return new Response(
          JSON.stringify({ success: false, message: "Invalid or expired code. Please try again." }),
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

      // Find a valid (unused) OTP record for this email (the one that was verified)
      const { data: otpData, error: otpError } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpError || !otpData) {
        console.error("No valid verified OTP found");
        return new Response(
          JSON.stringify({ success: false, message: "Session expired. Please start the reset process again." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find the user by email
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error finding user:", userError);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to reset password" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const user = userData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!user) {
        console.error("User not found");
        return new Response(
          JSON.stringify({ success: false, message: "User not found" }),
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
          JSON.stringify({ success: false, message: "Failed to update password" }),
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
        JSON.stringify({ success: true, message: "Password updated successfully" }),
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
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
