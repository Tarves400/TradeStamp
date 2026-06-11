// Trading AI Agent — Large Language Model Edge Function
// Proxies SSE stream from Google Gemini API to client for real-time responses
// Uses gemini-2.5-flash which is natively multimodal (text + image + audio)
// Upgraded with generationConfig, safetySettings, systemInstruction, model selection and timeouts

const GATEWAY_BASE = "https://app-c74e0t74d2wx-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models";
const GOOGLE_STREAM_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Request timeout: 55s (Edge Function hard-kills at 60s)
const REQUEST_TIMEOUT_MS = 55_000;

const TRADING_SYSTEM_PROMPT = `You are TradeStamp AI, a specialized trading assistant. You ONLY answer questions related to forex trading, technical analysis, risk management, trading psychology, market analysis, trade journaling, and trading strategy. If the user asks about anything unrelated to trading (such as cooking, general knowledge, politics, entertainment, personal advice, etc.), politely refuse and remind them that you only assist with trading-related topics. Keep responses concise and actionable. You may communicate in the user's language.`;

// Trading-optimized generation config
// Flash: thinkingBudget:0 disables internal chain-of-thought → sub-500ms TTFT for text
// Pro: allow thinking for deeper chart/strategy analysis
const GENERATION_CONFIG_FLASH = {
  temperature: 0.3,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 2048,
  responseMimeType: "text/plain",
  thinkingConfig: { thinkingBudget: 0 },  // disable thinking → fastest possible TTFT
};

const GENERATION_CONFIG_PRO = {
  temperature: 0.3,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 4096,
  responseMimeType: "text/plain",
  // Pro: no thinkingBudget override — default thinking for deeper analysis
};

// Disable all safety filters — trading content ("risk", "loss", "gambling") must not be blocked
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

type Part = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

type ContentItem = {
  role: string;
  parts: Part[];
};

function buildStreamUrl(base: string, model: string): string {
  return `${base}/${model}:streamGenerateContent?alt=sse`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log(`[LLM] ${req.method} ${req.url}`);
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
    let contents: ContentItem[];
    let requestedModel = "gemini-2.5-flash";
    try {
      const body = await req.json();
      contents = body.contents;
      if (body.model) requestedModel = body.model;
      if (!Array.isArray(contents) || contents.length === 0) {
        throw new Error("Missing or empty contents");
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[LLM] Model: ${requestedModel}, messages: ${contents.length}`);

    const userKey = Deno.env.get("USER_GEMINI_API_KEY");
    const platformKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!userKey && !platformKey) {
      console.error("[LLM] No API key available");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Modern Gemini API: systemInstruction + contents (no injected fake exchange)
    // Flash uses thinkingBudget:0 for fastest TTFT; Pro uses default thinking for depth
    const genConfig = requestedModel.includes("pro") ? GENERATION_CONFIG_PRO : GENERATION_CONFIG_FLASH;
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: TRADING_SYSTEM_PROMPT }] },
      contents,
      generationConfig: genConfig,
      safetySettings: SAFETY_SETTINGS,
    });

    const SSE_HEADERS = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Connection": "keep-alive",
    };

    // ── Fast path: platform key only (most users) — zero extra round-trip ──
    if (!userKey && platformKey) {
      const platformUrl = buildStreamUrl(GATEWAY_BASE, requestedModel);
      const upstream = await fetch(platformUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${platformKey}`,
        },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
      }
      const errText = await upstream.text().catch(() => "");
      if (upstream.status === 429 || upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI quota exceeded", detail: errText.slice(0, 500) }), {
          status: upstream.status, headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}`, detail: errText.slice(0, 500) }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }

    // ── User key path: try user key, fall back to platform key on failure ──
    if (userKey) {
      const userUrl = `${buildStreamUrl(GOOGLE_STREAM_BASE, requestedModel)}&key=${encodeURIComponent(userKey)}`;
      const upstream = await fetch(userUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }).catch((e) => {
        console.error(`[LLM] User key fetch error: ${e.message}`);
        return null;
      });

      if (upstream?.ok && upstream.body) {
        return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
      }
      console.error(`[LLM] User key failed (${upstream?.status ?? "err"}) — falling back to platform key`);
    }

    // ── Fall back to platform key ──
    if (!platformKey) {
      return new Response(
        JSON.stringify({ error: "AI quota exceeded", detail: "No platform fallback configured." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const platformUrl = buildStreamUrl(GATEWAY_BASE, requestedModel);
    const upstream = await fetch(platformUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${platformKey}`,
      },
      body: payload,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (upstream.status === 429 || upstream.status === 402) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ error: "AI quota exceeded", detail: errText.slice(0, 500) }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => "");
      console.error(`[LLM] Platform upstream error ${upstream.status}: ${errBody.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: `Upstream error: ${upstream.status}`, detail: errBody.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pipe the SSE stream straight through to the client
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[LLM] Unhandled error: ${msg}`);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
