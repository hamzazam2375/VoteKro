import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const generatePassword = (length = 10) => {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint32Array(length));
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += chars[values[index] % chars.length];
  }

  return password;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("EMAIL_FROM");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!resendApiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "Missing email provider secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !adminProfile || adminProfile.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Only admin can initiate auditor registration",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as Partial<{
      fullName: string;
      email: string;
    }>;
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!fullName || !email) {
      return new Response(
        JSON.stringify({ error: "fullName and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = crypto.randomUUID();
    const generatedPassword = generatePassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await adminClient
      .from("auditor_registration_requests")
      .insert({
        full_name: fullName,
        email,
        generated_password: generatedPassword,
        approval_token: token,
        requested_by: user.id,
        expires_at: expiresAt,
        status: "pending",
      });

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: `Failed to create registration request: ${insertError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const approveUrl = `${supabaseUrl}/functions/v1/complete-auditor-registration?token=${encodeURIComponent(token)}`;

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">VoteKro - Complete Auditor Registration</h2>
            <p>Dear ${fullName},</p>
            <p>An administrator started your auditor registration. To authorize and complete account creation, click the button below.</p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Generated Password:</strong> ${generatedPassword}</p>
            </div>

            <p style="margin: 24px 0;">
              <a href="${approveUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">
                Authorize And Complete Registration
              </a>
            </p>

            <p>If the button does not work, use this link:</p>
            <p><a href="${approveUrl}">${approveUrl}</a></p>

            <p><strong>Note:</strong> This link expires in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
          </div>
        </body>
      </html>
    `;

    const text = `VoteKro - Complete Auditor Registration

Dear ${fullName},

An administrator started your auditor registration. Click this link to authorize and complete account creation:
${approveUrl}

Email: ${email}
Generated Password: ${generatedPassword}

This link expires in 24 hours.`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "VoteKro - Complete Auditor Registration",
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to send registration email",
          details: resendError,
        }),
        {
          status: resendResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
