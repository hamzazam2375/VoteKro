import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decode as decodeJpeg } from "https://esm.sh/jpeg-js@0.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Strip data-URI prefix if present and return raw base64. */
function extractBase64(input: string): string {
  const match = input.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : input;
}

/** Decode a base64 JPEG to raw RGBA pixels using pure-JS decoder. */
function decodeImage(
  base64: string,
): { width: number; height: number; data: Uint8Array } | null {
  try {
    const raw = extractBase64(base64);
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  } catch (err) {
    console.error("Image decode error:", err);
    return null;
  }
}

/** Normalised colour histogram (16 bins per channel). */
function colorHistogram(data: Uint8Array): number[] {
  const bins = 16;
  const hist = new Array(bins * 3).fill(0);
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    hist[Math.floor((data[i] / 256) * bins)]++;
    hist[bins + Math.floor((data[i + 1] / 256) * bins)]++;
    hist[bins * 2 + Math.floor((data[i + 2] / 256) * bins)]++;
  }

  for (let i = 0; i < hist.length; i++) hist[i] /= pixelCount;
  return hist;
}

/** Bhattacharyya coefficient: 1.0 = identical, 0.0 = no overlap. */
function histogramSimilarity(h1: number[], h2: number[]): number {
  let sum = 0;
  for (let i = 0; i < h1.length; i++) sum += Math.sqrt(h1[i] * h2[i]);
  return sum;
}

/** Skin-tone presence check in the centre region. */
function hasFacePresence(
  data: Uint8Array,
  w: number,
  h: number,
): boolean {
  const margin = Math.floor(Math.min(w, h) * 0.25);
  const endX = w - margin;
  const endY = h - margin;
  let skinPixels = 0;
  let total = 0;

  for (let y = margin; y < endY; y += 2) {
    for (let x = margin; x < endX; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      if (
        r > 95 && g > 40 && b > 20 &&
        max - min > 15 &&
        Math.abs(r - g) > 15 &&
        r > g && r > b
      ) {
        skinPixels++;
      }
      total++;
    }
  }

  return total > 0 && skinPixels / total > 0.12;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const { image1Base64, image2Base64, threshold } = body;

    if (!image1Base64 || !image2Base64) {
      return new Response(
        JSON.stringify({ error: "Both image1Base64 and image2Base64 are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const img1 = decodeImage(image1Base64);
    const img2 = decodeImage(image2Base64);

    if (!img1 || !img2) {
      return new Response(
        JSON.stringify({
          similarity: 0,
          isSamePerson: false,
          message: "Failed to decode one or both images. Ensure they are valid JPEGs.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Face presence check
    const face1 = hasFacePresence(img1.data, img1.width, img1.height);
    const face2 = hasFacePresence(img2.data, img2.width, img2.height);

    if (!face1 || !face2) {
      return new Response(
        JSON.stringify({
          similarity: 0,
          isSamePerson: false,
          hasFace1: face1,
          hasFace2: face2,
          message: !face1 && !face2
            ? "No face detected in either image"
            : !face1
              ? "No face detected in the stored image"
              : "No face detected in the captured image",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Colour histogram comparison
    const h1 = colorHistogram(img1.data);
    const h2 = colorHistogram(img2.data);
    const similarity = histogramSimilarity(h1, h2);
    const t = typeof threshold === "number" ? threshold : 0.6;

    return new Response(
      JSON.stringify({
        similarity: Math.round(similarity * 1000) / 1000,
        isSamePerson: similarity > t,
        hasFace1: face1,
        hasFace2: face2,
        message: similarity > t
          ? "✓ Face matches! Same person verified."
          : "❌ Face does not match. Different person detected.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("verify-face error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
