export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function requireValue(
  ok: unknown,
  status: number,
  message: string,
): asserts ok {
  if (!ok) throw new HttpError(status, message);
}
export const hex = (a: ArrayBuffer) =>
  Array.from(new Uint8Array(a), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
export async function digest(s: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}
export async function passwordHash(
  password: string,
  salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return `pbkdf2-sha256$100000$${salt}$${hex(bits)}`;
}
export function equalText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function passwordMatches(password: string, stored: string) {
  const salt = stored.split("$")[2];
  return !!salt && equalText(await passwordHash(password, salt), stored);
}
export async function readJSON(
  request: Request,
  max = 80000,
): Promise<Record<string, unknown>> {
  requireValue(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    415,
    "Send application/json.",
  );
  const length = Number(request.headers.get("content-length") || 0);
  requireValue(length <= max, 413, "Request is too large.");
  requireValue(request.body, 400, "Request body is required.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((c) => {
    bytes.set(c, offset);
    offset += c.length;
  });
  try {
    const body: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    requireValue(
      body && typeof body === "object" && !Array.isArray(body),
      400,
      "Expected a JSON object.",
    );
    return body as Record<string, unknown>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function stringField(
  data: Record<string, unknown>,
  key: string,
  max: number,
  min = 1,
) {
  const v = data[key];
  requireValue(typeof v === "string", 400, `${key} must be text.`);
  const s = v.trim();
  requireValue(
    s.length >= min && s.length <= max,
    400,
    `${key} must contain ${min}–${max} characters.`,
  );
  return s;
}
export function securityHeaders(response: Response): Response {
  const h = new Headers(response.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  h.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
  );
  h.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, headers: h });
}
