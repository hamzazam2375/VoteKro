import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const htmlPage = (title: string, message: string, success: boolean) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; }
      .card { max-width: 640px; margin: 60px auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
      h1 { margin-top: 0; color: ${success ? "#065f46" : "#991b1b"}; }
      p { color: #374151; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>
`;

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      htmlPage(
        "Configuration Error",
        "Server configuration is missing required Supabase secrets.",
        false,
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return new Response(
      htmlPage("Invalid Link", "Registration link is invalid.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: requestRow, error: requestError } = await adminClient
    .from("voter_registration_requests")
    .select(
      "id, full_name, email, generated_password, expires_at, status, face_image_base64, face_embedding",
    )
    .eq("approval_token", token)
    .maybeSingle();

  if (requestError || !requestRow) {
    return new Response(
      htmlPage(
        "Invalid Link",
        "This registration link is invalid or already used.",
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (requestRow.status !== "pending") {
    return new Response(
      htmlPage(
        "Link Already Used",
        "This registration link has already been used.",
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (Date.now() > new Date(requestRow.expires_at).getTime()) {
    await adminClient
      .from("voter_registration_requests")
      .update({ status: "expired" })
      .eq("id", requestRow.id);

    return new Response(
      htmlPage(
        "Link Expired",
        "This registration link has expired. Ask admin to send a new one.",
        false,
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const { data: createdUserData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: requestRow.email,
      password: requestRow.generated_password,
      email_confirm: true,
      user_metadata: {
        full_name: requestRow.full_name,
        role: "voter",
      },
    });

  if (createUserError || !createdUserData.user) {
    await adminClient
      .from("voter_registration_requests")
      .update({ status: "failed" })
      .eq("id", requestRow.id);

    // Detect duplicate user and show a friendly message
    const errMsg = createUserError?.message ?? "Unknown error";
    const isDuplicate =
      errMsg.toLowerCase().includes("already been registered") ||
      errMsg.toLowerCase().includes("already exists") ||
      errMsg.toLowerCase().includes("duplicate");

    if (isDuplicate) {
      return new Response(
        htmlPage(
          "Already Registered",
          `A voter account with the email <strong>${requestRow.email}</strong> already exists.<br><br>` +
            `You can log in directly using the credentials that were sent to your email. ` +
            `If you forgot your password, please contact the election administrator.`,
          false,
        ),
        {
          status: 409,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    return new Response(
      htmlPage(
        "Registration Failed",
        `We were unable to create your voter account. Please contact the election administrator and share this error: <em>${errMsg}</em>`,
        false,
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    user_id: createdUserData.user.id,
    full_name: requestRow.full_name,
    role: "voter",
    is_verified: true,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(createdUserData.user.id);
    await adminClient
      .from("voter_registration_requests")
      .update({ status: "failed" })
      .eq("id", requestRow.id);

    return new Response(
      htmlPage(
        "Registration Failed",
        `Profile creation failed: ${profileError.message}`,
        false,
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  // Transfer face image from registration request to voter_faces table
  if (requestRow.face_image_base64) {
    try {
      await adminClient.from("voter_faces").insert({
        voter_id: createdUserData.user.id,
        face_image_base64: requestRow.face_image_base64,
        is_primary: true,
        metadata: {
          registrationMethod: "admin-capture",
          transferredAt: new Date().toISOString(),
        },
      });
    } catch (faceErr) {
      console.error("Failed to transfer face image:", faceErr);
      // Non-fatal: voter account is still created
    }
  }

  if (
    Array.isArray(requestRow.face_embedding) &&
    requestRow.face_embedding.length > 0
  ) {
    try {
      await adminClient.from("voter_face_embeddings").upsert(
        {
          voter_id: createdUserData.user.id,
          email: requestRow.email.toLowerCase(),
          embedding: requestRow.face_embedding,
          face_image_base64: requestRow.face_image_base64 ?? null,
        },
        { onConflict: "email" },
      );
    } catch (embeddingErr) {
      console.error("Failed to transfer face embedding:", embeddingErr);
      // Non-fatal: account creation still succeeds, but login verification may require re-enrollment.
    }
  }

  await adminClient
    .from("voter_registration_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_user_id: createdUserData.user.id,
    })
    .eq("id", requestRow.id);

  return new Response(
    htmlPage(
      "Registration Completed",
      "Your voter account has been created and authorized. You can now log in using the credentials sent in your email.",
      true,
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
});
