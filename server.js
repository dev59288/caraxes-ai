// CARAXES AI — Node.js 18+ backend. No npm packages required.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_BODY = 2 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY) {
        reject(new Error("Request is too large. Keep it under 2 MB."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("Invalid JSON request.")); }
    });
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  if (!API_KEY) {
    return send(res, 503, {
      error: "AI is not connected yet. Add GEMINI_API_KEY in your hosting environment variables."
    });
  }

  let payload;
  try { payload = await readBody(req); }
  catch (err) { return send(res, 400, { error: err.message }); }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length || messages.length > 40) {
    return send(res, 400, { error: "Send between 1 and 40 conversation messages." });
  }

  const contents = [];
  for (const msg of messages) {
    if (!msg || !["user", "model"].includes(msg.role) || typeof msg.text !== "string") continue;
    const text = msg.text.trim().slice(0, 30000);
    if (text) contents.push({ role: msg.role, parts: [{ text }] });
  }
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return send(res, 400, { error: "The latest message must be a user message." });
  }

  const body = {
    systemInstruction: {
      parts: [{
        text: "You are CARAXES AI, a helpful, clear, thoughtful assistant. Reply in the user's language. Use readable paragraphs, headings and lists when useful. Be honest about uncertainty and never claim to have performed actions you cannot perform."
      }]
    },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
  };

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      const message = result?.error?.message || "The AI provider returned an error.";
      return send(res, upstream.status, { error: message });
    }
    const answer = (result.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "").join("").trim();
    if (!answer) return send(res, 502, { error: "The AI returned an empty response. Please try again." });
    return send(res, 200, { reply: answer, model: MODEL });
  } catch (err) {
    return send(res, 502, { error: err.name === "TimeoutError" ? "AI request timed out. Try again." : "Could not reach the AI provider. Check your server connection." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true, aiConfigured: Boolean(API_KEY), model: MODEL });
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    return handleChat(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { error: "Method not allowed." });
  }

  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, "index.html")) {
    return send(res, 403, { error: "Forbidden." });
  }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: "Not found." });
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`CARAXES AI running at http://${HOST}:${PORT}`);
  console.log(`AI configured: ${Boolean(API_KEY)} | Model: ${MODEL}`);
});
