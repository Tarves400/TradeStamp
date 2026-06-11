// Text-to-Speech Edge Function
// Converts text to audio via LemonFox TTS, uploads to Storage, returns public URL
// Includes 30s upstream timeout and server-side text truncation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TTS_ENDPOINT = "https://app-c74e0t74d2wx-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech";
const TTS_TIMEOUT_MS = 30_000;
const TTS_MAX_CHARS = 1000;

Deno.serve(async (req: Request): Promise<Response> => {
  console.log(`[TTS] ${req.method} ${req.url}`);
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse client request
    let input: string;
    let voice: string;
    let responseFormat: string;
    let language: string | undefined;
    try {
      const body = await req.json();
      input = body.input;
      voice = body.voice ?? "heart";
      responseFormat = body.response_format ?? "mp3";
      language = body.language;
      if (!input) throw new Error("Missing input");
      // Server-side truncation: cap at TTS_MAX_CHARS to keep audio fast and clear
      if (input.length > TTS_MAX_CHARS) {
        input = `${input.slice(0, TTS_MAX_CHARS - 3)}...`;
        console.log(`[TTS] Input truncated to ${TTS_MAX_CHARS} chars`);
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // TTS uses platform gateway key (NOT user Gemini key)
    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      console.error("[TTS] INTEGRATIONS_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call upstream TTS API with timeout
    console.log(`[TTS] Calling upstream (voice=${voice}, lang=${language ?? "auto"})...`);
    const ttsPayload: Record<string, string> = { input, voice, response_format: responseFormat };
    if (language) ttsPayload.language = language;
    const upstream = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(ttsPayload),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });
    console.log(`[TTS] Upstream status: ${upstream.status}`);

    // Forward quota/balance errors
    if (upstream.status === 429 || upstream.status === 402) {
      const errText = await upstream.text();
      return new Response(errText, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => "");
      console.error(`[TTS] Upstream error ${upstream.status}: ${errBody.slice(0, 500)}`);
      return new Response(
        JSON.stringify({ error: `Upstream error: ${upstream.status}`, detail: errBody.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Upload binary audio to Supabase Storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const ext = responseFormat ?? "mp3";
    const filePath = `tts/${crypto.randomUUID()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated-media")
      .upload(filePath, upstream.body!, {
        contentType,
        cacheControl: "no-cache",
        duplex: "half",
      } as RequestInit & { cacheControl: string; upsert?: boolean });

    if (uploadError) {
      console.error(`[TTS] Storage upload error: ${uploadError.message}`);
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);
    console.log(`[TTS] Uploaded to ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ audioUrl: urlData.publicUrl, path: uploadData.path }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[TTS] Unhandled error: ${msg}`);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
