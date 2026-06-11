// Speech-to-Text Edge Function
// Receives audio file URL, calls Whisper API, returns transcription text

const STT_ENDPOINT = "https://app-c74e0t74d2wx-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions";

Deno.serve(async (req: Request): Promise<Response> => {
  console.log(`[STT] ${req.method} ${req.url}`);
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
    let fileUrl: string;
    let language: string | undefined;
    let responseFormat: string;
    try {
      const body = await req.json();
      fileUrl = body.fileUrl;
      if (!fileUrl) throw new Error("Missing fileUrl");
      language = body.language;
      responseFormat = body.responseFormat ?? "json";
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // STT uses platform gateway key (NOT user Gemini key)
    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      console.error("[STT] INTEGRATIONS_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build request params
    const params: Record<string, string> = { file: fileUrl, response_format: responseFormat };
    if (language) params.language = language;

    // Call upstream STT API
    console.log("[STT] Calling upstream...");
    const upstream = await fetch(STT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    });
    console.log(`[STT] Upstream status: ${upstream.status}`);

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
      console.error(`[STT] Upstream error ${upstream.status}: ${errBody.slice(0, 500)}`);
      return new Response(
        JSON.stringify({ error: `Upstream error: ${upstream.status}`, detail: errBody.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return JSON response
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[STT] Unhandled error: ${msg}`);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
