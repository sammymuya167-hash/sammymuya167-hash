/** UTF-8/SSE decoder shared by browser and provider adapter. Handles split code points and CRLF. */
export async function* readSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let event = "message";
  let data: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let n: number;
      while ((n = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, n).replace(/\r$/, "");
        pending = pending.slice(n + 1);
        if (!line) {
          if (data.length) yield { event, data: data.join("\n") };
          event = "message";
          data = [];
        } else if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:"))
          data.push(line.slice(5).replace(/^ /, ""));
      }
      if (pending.length > 131072)
        throw new Error("Stream frame exceeds limit");
      if (done) break;
    }
    if (pending.startsWith("data:")) data.push(pending.slice(5).trimStart());
    if (data.length) yield { event, data: data.join("\n") };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}
