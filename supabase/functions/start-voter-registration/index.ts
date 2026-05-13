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

const FACE_DISTANCE_THRESHOLD = 0.45;
const MIN_SIMILARITY_PERCENT = 65;

const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const isFaceMatch = (candidate: number[], reference: number[]): boolean => {
  if (candidate.length === 0 || candidate.length !== reference.length) {
    return false;
  }

  const distance = euclideanDistance(candidate, reference);
  const similarity = Math.max(
    0,
    Math.min(100, Math.round((1 - distance) * 100)),
  );

  return (
    distance < FACE_DISTANCE_THRESHOLD && similarity >= MIN_SIMILARITY_PERCENT
  );
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

    console.log("Profile fetch error:", profileError);
    console.log("Admin profile:", adminProfile);
    console.log("Role", adminProfile?.role);

    if (profileError || !adminProfile || adminProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admin can initiate voter registration" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as Partial<{
      fullName: string;
      email: string;
      faceImageBase64?: string; // optional base64-encoded face image
      faceEmbedding?: number[];
      faceMetadata?: Record<string, unknown>;
    }>;
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const faceImageBase64 = body.faceImageBase64;
    const faceEmbedding = Array.isArray(body.faceEmbedding)
      ? body.faceEmbedding
      : null;

    if (!fullName || !email) {
      return new Response(
        JSON.stringify({ error: "fullName and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (Array.isArray(faceEmbedding) && faceEmbedding.length > 0) {
      const { data: existingEmbeddings, error: embeddingsError } =
        await adminClient
          .from("voter_face_embeddings")
          .select("email, embedding");

      if (embeddingsError) {
        return new Response(
          JSON.stringify({
            error: `Failed to validate face data: ${embeddingsError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const hasMatchingFace = (existingEmbeddings ?? []).some((row: any) => {
        const existing = Array.isArray(row?.embedding) ? row.embedding : [];
        return isFaceMatch(existing, faceEmbedding);
      });

      if (hasMatchingFace) {
        return new Response(
          JSON.stringify({
            error:
              "This face is already registered with another voter. Please use the original voter email or contact support.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Check if a user with this email already exists in auth.users
    const { data: existingUsers, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (!listError && existingUsers?.users) {
      const emailExists = existingUsers.users.some(
        (u: any) => u.email?.toLowerCase() === email,
      );
      if (emailExists) {
        return new Response(
          JSON.stringify({
            error: `A user with email "${email}" is already registered. Please use a different email address.`,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Check if there is already a pending registration request for this email
    const { data: pendingRequest } = await adminClient
      .from("voter_registration_requests")
      .select("id, status")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingRequest) {
      return new Response(
        JSON.stringify({
          error: `A pending registration request already exists for "${email}". Please wait for the voter to complete their registration or cancel the existing request.`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = crypto.randomUUID();
    const generatedPassword = generatePassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Face image will be stored after the voter account is created.
    // For now, keep the base64 in the registration request metadata so it
    // can be moved to voter_faces once the voter_id exists.
    const { error: insertError } = await adminClient
      .from("voter_registration_requests")
      .insert({
        full_name: fullName,
        email,
        generated_password: generatedPassword,
        approval_token: token,
        requested_by: user.id,
        expires_at: expiresAt,
        status: "pending",
        face_image_base64: faceImageBase64 ?? null,
        face_embedding: faceEmbedding,
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

    const approveUrl = `${supabaseUrl}/functions/v1/complete-voter-registration?token=${encodeURIComponent(token)}`;

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c5aa0;">VoteKro - Complete Voter Registration</h2>
            <p>Dear ${fullName},</p>
            <p>An administrator started your voter registration. To authorize and complete account creation, click the button below.</p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Generated Password:</strong> ${generatedPassword}</p>
            </div>

            <p style="margin: 24px 0;">
              <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">
                Authorize And Complete Registration
              </a>
            </p>

            <p>If the button does not work, use this link:</p>
            <p><a href="${approveUrl}" target="_blank" rel="noopener noreferrer">${approveUrl}</a></p>

            <p><strong>Note:</strong> This link expires in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
          </div>
        </body>
      </html>
    `;

    const text = `VoteKro - Complete Voter Registration

Dear ${fullName},

An administrator started your voter registration. Click this link to authorize and complete account creation:
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
        subject: "VoteKro - Complete Voter Registration",
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
