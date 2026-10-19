/**
 * ShadowBot's private Workers AI bridge. Only the application server holds GATEWAY_KEY.
 * Accepts OpenAI chat-completions requests; returns Workers AI SSE (response fields).
 */
export default {
  async fetch(request, env) {
    if (
      new URL(request.url).pathname !== "/v1/chat/completions" ||
      request.method !== "POST"
    )
      return new Response("Not found", { status: 404 });
    const supplied = request.headers.get("Authorization") || "";
    const hash = async (s) =>
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
      );
    const [a, b] = await Promise.all([
      hash(supplied),
      hash("Bearer " + env.GATEWAY_KEY),
    ]);
    if (!crypto.subtle.timingSafeEqual(a, b))
      return new Response("Unauthorized", { status: 401 });
    if (Number(request.headers.get("Content-Length") || 0) > 50000)
      return new Response("Too large", { status: 413 });
    let body;
    try {
      const reader = request.body?.getReader();
      if (!reader) return new Response("Missing body", { status: 400 });
      let size = 0;
      const parts = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 50000) {
            await reader.cancel();
            return new Response("Too large", { status: 413 });
          }
          parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      body = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (
      !Array.isArray(body.messages) ||
      !body.messages.length ||
      body.messages.length > 22 ||
      body.messages.some(
        (m) =>
          !["system", "user", "assistant"].includes(m.role) ||
          typeof m.content !== "string",
      ) ||
      JSON.stringify(body.messages).length > 45000
    )
      return new Response("Invalid messages", { status: 400 });
    try {
      const stream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: body.messages,
        stream: true,
        max_tokens: 768,
        temperature: 0.4,
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new Response("AI temporarily unavailable", { status: 502 });
    }
  },
};
