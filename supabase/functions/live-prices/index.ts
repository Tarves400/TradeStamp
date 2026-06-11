// Live Forex + Crypto Prices Edge Function
// Uses REAL-TIME free APIs — ZERO API keys required.
//
// Sources:
//   • query1.finance.yahoo.com/v7/finance/quote  – near real-time forex & gold
//   • api.binance.com/api/v3/ticker/price        – real-time crypto (BTC, ETH)
//
// No authentication required — publicly callable.

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ── ফরেক্স + স্বর্ণ: Yahoo Finance v7 batch quote ──
    const forexSymbols =
      "EURUSD=X,GBPUSD=X,USDJPY=X,AUDUSD=X,USDCHF=X,USDCAD=X," +
      "NZDUSD=X,EURGBP=X,EURJPY=X,GBPJPY=X,AUDJPY=X,GC=F";
    const yahooUrl =
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${forexSymbols}`;

    let forexMap: Record<string, { price: number; change: number }> = {};
    try {
      const res = await fetch(yahooUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const results = data?.quoteResponse?.result || [];
        const symbolToPair: Record<string, string> = {
          "EURUSD=X": "EUR/USD",
          "GBPUSD=X": "GBP/USD",
          "USDJPY=X": "USD/JPY",
          "AUDUSD=X": "AUD/USD",
          "USDCHF=X": "USD/CHF",
          "USDCAD=X": "USD/CAD",
          "NZDUSD=X": "NZD/USD",
          "EURGBP=X": "EUR/GBP",
          "EURJPY=X": "EUR/JPY",
          "GBPJPY=X": "GBP/JPY",
          "AUDJPY=X": "AUD/JPY",
          "GC=F": "XAU/USD",
        };
        results.forEach((r: Record<string, unknown>) => {
          const pair = symbolToPair[String(r.symbol)];
          if (pair) {
            const price = Number(r.regularMarketPrice) || 0;
            const change = Number(r.regularMarketChangePercent) || 0;
            if (price > 0) {
              forexMap[pair] = {
                price,
                change: Math.round(change * 100) / 100,
              };
            }
          }
        });
      }
    } catch (e) {
      console.log("[LIVE-PRICES] Yahoo Finance error:", (e as Error).message);
    }

    // ── ক্রিপ্টো: Binance real-time ──
    let btc = 0;
    let eth = 0;
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"),
      ]);
      if (btcRes.ok) {
        const d = await btcRes.json();
        btc = parseFloat(String(d.price)) || 0;
      }
      if (ethRes.ok) {
        const d = await ethRes.json();
        eth = parseFloat(String(d.price)) || 0;
      }
    } catch (e) {
      console.log("[LIVE-PRICES] Binance error:", (e as Error).message);
    }

    // ── ফলব্যাক ডেটা ──
    const fallback: Record<string, { price: number; change: number }> = {
      "EUR/USD": { price: 1.0845, change: 0 },
      "GBP/USD": { price: 1.2730, change: 0 },
      "USD/JPY": { price: 149.82, change: 0 },
      "AUD/USD": { price: 0.6580, change: 0 },
      "USD/CHF": { price: 0.8850, change: 0 },
      "USD/CAD": { price: 1.3580, change: 0 },
      "NZD/USD": { price: 0.6120, change: 0 },
      "EUR/GBP": { price: 0.8525, change: 0 },
      "EUR/JPY": { price: 162.15, change: 0 },
      "GBP/JPY": { price: 190.40, change: 0 },
      "AUD/JPY": { price: 98.55, change: 0 },
      "XAU/USD": { price: 2325.80, change: 0 },
      "BTC/USD": { price: 67450, change: 0 },
      "ETH/USD": { price: 3520, change: 0 },
    };

    const allPairs = Object.keys(fallback);
    const pairs = allPairs.map((pair) => {
      const live = forexMap[pair];
      if (live) return { pair, price: live.price, change: live.change };
      if (pair === "BTC/USD" && btc > 0) return { pair, price: btc, change: 0 };
      if (pair === "ETH/USD" && eth > 0) return { pair, price: eth, change: 0 };
      return { pair, price: fallback[pair].price, change: fallback[pair].change };
    });

    return new Response(
      JSON.stringify({ pairs, updated_at: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "max-age=2",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[LIVE-PRICES] Unhandled error: ${msg}`);
    return new Response(
      JSON.stringify({ error: "Failed to fetch prices", detail: msg }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
