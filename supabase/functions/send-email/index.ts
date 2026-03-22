// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "re_hWFS2BMt_MDEHefYsh8Q5ix3PAp9xP94H";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = (await req.json()) as SendEmailRequest;

    // Validate inputs
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Send email using Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: to,
        subject: subject,
        html: html,
        text: text || null,
      }),
    });

    if (!response.ok) {
      const resendError = await response.text();
      console.error("Resend API error:", resendError);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${resendError}` }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
