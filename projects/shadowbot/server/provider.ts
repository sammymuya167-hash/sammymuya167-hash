import { readSSE } from "../lib/sse.ts";
import { HttpError } from "./security.ts";
export type ChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};
export type ProviderConfig = {
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_LABEL?: string;
};
export function providerInfo(env: ProviderConfig) {
  return {
    ready: !!(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL),
    label: env.AI_LABEL || "OpenAI-compatible",
    model: env.AI_MODEL || "Not configured",
    retrieval: "Keyword retrieval",
    dailyLimit: 40,
  };
}
export function memoryWindow(
  rows: { role: string; content: string; status: string }[],
): ChatTurn[] {
  let remaining = 16000;
  const result: ChatTurn[] = [];
  for (const row of rows.slice().reverse()) {
    if (
      row.status !== "complete" ||
      (row.role !== "assistant" && row.role !== "user")
    )
      continue;
    if (row.content.length > remaining) break;
    result.unshift({ role: row.role, content: row.content });
    remaining -= row.content.length;
    if (result.length === 20) break;
  }
  while (result[0]?.role === "assistant") result.shift();
  return result;
}
export async function* generate(
  env: ProviderConfig,
  messages: ChatTurn[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (!providerInfo(env).ready)
    throw new HttpError(
      503,
      "AI is not configured. Set the server provider variables.",
    );
  const url = new URL(
    env.AI_BASE_URL!.replace(/\/$/, "") + "/chat/completions",
  );
  if (
    url.protocol !== "https:" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost"
  )
    throw new Error("Provider must use HTTPS");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      stream: true,
      max_tokens: 768,
      temperature: 0.4,
    }),
    signal,
    redirect: "manual",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      response.status === 429
        ? "The AI provider is busy. Try again shortly."
        : "The AI provider could not complete the request.",
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    await response.body?.cancel();
    throw new HttpError(
      502,
      "The AI provider did not return a supported stream.",
    );
  }
  let complete = false;
  for await (const frame of readSSE(response.body)) {
    if (frame.data === "[DONE]") {
      complete = true;
      break;
    }
    const item = JSON.parse(frame.data) as {
      error?: unknown;
      response?: string;
      choices?: {
        delta?: { content?: string };
        finish_reason?: string | null;
      }[];
    };
    if (item.error)
      throw new HttpError(502, "The AI provider reported an error.");
    const token = item.choices?.[0]?.delta?.content ?? item.response;
    if (typeof token === "string") yield token;
    if (item.choices?.[0]?.finish_reason) complete = true;
  }
  if (!complete)
    throw new HttpError(502, "The AI response ended early. Please try again.");
}
