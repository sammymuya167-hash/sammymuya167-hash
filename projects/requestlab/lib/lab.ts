import { z } from "zod";
export const methods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
] as const;
export const pairSchema = z.object({
  id: z.string().max(80),
  key: z.string().max(100),
  value: z.string().max(2000),
  enabled: z.boolean(),
});
export type Pair = z.infer<typeof pairSchema>;
export const assertionSchema = z.object({
  id: z.string().max(80),
  kind: z.enum(["status", "json", "exists", "header", "time"]),
  path: z.string().max(200),
  expected: z.string().max(1000),
});
export type Assertion = z.infer<typeof assertionSchema>;
export const requestSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  method: z.enum(methods),
  url: z.string().trim().min(1).max(2000),
  headers: z.array(pairSchema).max(24),
  body: z.string().max(24000),
  assertions: z.array(assertionSchema).max(20),
});
export type RequestDraft = z.infer<typeof requestSchema>;
export const environmentSchema = z.object({
  id: z.string().max(80),
  name: z.string().trim().min(1).max(60),
  variables: z
    .array(
      z.object({
        id: z.string().max(80),
        key: z
          .string()
          .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
          .max(80),
        value: z.string().max(2000),
        secret: z.boolean(),
      }),
    )
    .max(24),
});
export type Environment = z.infer<typeof environmentSchema>;
export const workspaceSchema = z
  .object({
    collections: z
      .array(
        z.object({
          id: z.string().max(80),
          name: z.string().trim().min(1).max(80),
          requests: z.array(requestSchema).max(40),
        }),
      )
      .max(15),
    environments: z.array(environmentSchema).max(10),
  })
  .superRefine((data, context) => {
    const ids = data.collections.flatMap((c) => [
      c.id,
      ...c.requests.map((r) => r.id),
    ]);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Collections and requests need unique IDs.",
      });
    if (
      new Set(data.environments.map((e) => e.id)).size !==
      data.environments.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Environment IDs must be unique.",
      });
    for (const environment of data.environments)
      if (
        new Set(environment.variables.map((v) => v.key)).size !==
        environment.variables.length
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variable names must be unique within an environment.",
        });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Check = {
  id: string;
  label: string;
  passed: boolean;
  actual: string;
};
export type ResponseResult = {
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  headers: [string, string][];
  body: string;
  checks: Check[];
  error?: string;
};
export function interpolate(
  text: string,
  environment: Environment,
  origin: string,
) {
  const variables = new Map(environment.variables.map((v) => [v.key, v.value]));
  variables.set("origin", origin);
  const expand = (value: string, seen: Set<string>): string =>
    value.replace(
      /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
      (_, key: string) => {
        if (!variables.has(key))
          throw new Error(`Add the missing variable: ${key}.`);
        if (seen.has(key) || seen.size > 24)
          throw new Error(`Variable cycle detected at ${key}.`);
        return expand(variables.get(key)!, new Set([...seen, key]));
      },
    );
  return expand(text, new Set());
}
export function jsonPath(value: unknown, path: string): unknown {
  if (!path || path === "$") return value;
  const parts = path.startsWith("/")
    ? path
        .slice(1)
        .split("/")
        .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    : path.replace(/^\$\.?/, "").split(".");
  let cursor: unknown = value;
  for (const part of parts) {
    if (["__proto__", "prototype", "constructor"].includes(part))
      return undefined;
    if (
      !cursor ||
      typeof cursor !== "object" ||
      !Object.prototype.hasOwnProperty.call(cursor, part)
    )
      return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  const keys = Object.keys(aa);
  return (
    keys.length === Object.keys(bb).length &&
    keys.every(
      (k) => Object.prototype.hasOwnProperty.call(bb, k) && equal(aa[k], bb[k]),
    )
  );
}
const printable = (value: unknown) =>
  value === undefined
    ? "missing"
    : typeof value === "string"
      ? value.slice(0, 140)
      : (JSON.stringify(value)?.slice(0, 140) ?? "missing");
export function evaluateAssertions(
  assertions: Assertion[],
  result: Omit<ResponseResult, "checks">,
): Check[] {
  let json: unknown;
  try {
    json = JSON.parse(result.body);
  } catch {
    json = undefined;
  }
  return assertions.map((a) => {
    let passed = false,
      actual: unknown,
      label = "";
    if (a.kind === "status") {
      actual = result.status;
      passed = result.status === Number(a.expected);
      label = `Status is ${a.expected}`;
    } else if (a.kind === "time") {
      actual = Math.round(result.durationMs);
      passed =
        result.durationMs <= Number(a.expected) && Number(a.expected) >= 0;
      label = `Response under ${a.expected} ms`;
    } else if (a.kind === "header") {
      actual = result.headers.find(
        ([key]) => key.toLowerCase() === a.path.toLowerCase(),
      )?.[1];
      passed =
        actual !== undefined &&
        String(actual).toLowerCase().includes(a.expected.toLowerCase());
      label = `Header ${a.path} contains ${a.expected}`;
    } else {
      actual = jsonPath(json, a.path);
      label =
        a.kind === "exists"
          ? `${a.path} exists`
          : `${a.path} equals ${a.expected}`;
      let expected: unknown;
      try {
        expected = JSON.parse(a.expected);
      } catch {
        expected = a.expected;
      }
      passed =
        a.kind === "exists" ? actual !== undefined : equal(actual, expected);
    }
    return {
      id: a.id,
      label,
      passed: !result.error && passed,
      actual: printable(actual),
    };
  });
}
export function resolveRequest(
  draft: RequestDraft,
  environment: Environment,
  origin: string,
) {
  const parsed = requestSchema.parse(draft);
  const url = new URL(interpolate(parsed.url, environment, origin), origin);
  if (url.username || url.password)
    throw new Error("Use a session-only header for credentials, not a URL.");
  if (url.origin === origin) {
    if (!url.pathname.startsWith("/api/mock/"))
      throw new Error("Same-origin requests must target /api/mock/.");
  } else if (url.protocol !== "https:")
    throw new Error(
      "External endpoints must use HTTPS and allow browser CORS requests.",
    );
  const headers = new Headers();
  for (const pair of parsed.headers.filter((h) => h.enabled && h.key.trim())) {
    if (
      /^(cookie|host|origin|referer|content-length|oai-|sec-)/i.test(pair.key)
    )
      throw new Error(`The browser controls the ${pair.key} header.`);
    headers.set(pair.key.trim(), interpolate(pair.value, environment, origin));
  }
  const body = ["GET", "HEAD"].includes(parsed.method)
    ? undefined
    : interpolate(parsed.body, environment, origin);
  return { url: url.toString(), method: parsed.method, headers, body };
}
export async function runRequest(
  draft: RequestDraft,
  environment: Environment,
  origin: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ResponseResult> {
  const start = performance.now(),
    controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const request = resolveRequest(draft, environment, origin);
    const response = await fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    const chunks: Uint8Array[] = [];
    let sizeBytes = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sizeBytes += value.byteLength;
          if (sizeBytes > 1048576) {
            await reader.cancel();
            throw new Error("Response exceeds the 1 MiB display limit.");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result: ResponseResult = {
      status: response.status,
      statusText: response.statusText,
      durationMs: performance.now() - start,
      sizeBytes,
      headers: Array.from(response.headers.entries()),
      body: new TextDecoder().decode(bytes),
      checks: [],
    };
    result.checks = evaluateAssertions(draft.assertions, result);
    return result;
  } catch (error) {
    const message = timedOut
      ? "Request timed out after 15 seconds."
      : controller.signal.aborted
        ? "Request cancelled."
        : error instanceof TypeError
          ? "The browser could not reach this API. Check the URL, CORS policy, TLS, and redirects. RequestLab does not proxy external requests."
          : error instanceof Error
            ? error.message
            : "The request failed.";
    const result: ResponseResult = {
      status: 0,
      statusText: "Request failed",
      durationMs: performance.now() - start,
      sizeBytes: 0,
      headers: [],
      body: "",
      error: message,
      checks: [],
    };
    result.checks = evaluateAssertions(draft.assertions, result);
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
const sensitiveKey =
  /authorization|cookie|api[-_]?key|token|secret|password|credential/i;
export function sanitizeWorkspace(input: Workspace): Workspace {
  const copy = structuredClone(input);
  for (const environment of copy.environments)
    for (const variable of environment.variables)
      if (variable.secret || sensitiveKey.test(variable.key)) {
        variable.secret = true;
        variable.value = "";
      }
  for (const collection of copy.collections)
    for (const request of collection.requests)
      for (const header of request.headers)
        if (
          sensitiveKey.test(header.key) &&
          !/^\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}$/.test(header.value)
        )
          header.value = "";
  return copy;
}
export function curlCommand(
  draft: RequestDraft,
  environment: Environment,
  origin: string,
) {
  const safeEnvironment = {
    ...environment,
    variables: environment.variables.map((v) => ({
      ...v,
      value: v.secret || sensitiveKey.test(v.key) ? `<${v.key}>` : v.value,
    })),
  };
  const safeDraft = structuredClone(draft);
  safeDraft.headers.forEach((h) => {
    if (sensitiveKey.test(h.key) && !h.value.includes("{{"))
      h.value = "<session-secret>";
  });
  const r = resolveRequest(safeDraft, safeEnvironment, origin);
  const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
  return [
    "curl",
    "-X",
    r.method,
    quote(r.url),
    ...Array.from(r.headers.entries()).flatMap(([key, value]) => [
      "-H",
      quote(`${key}: ${value}`),
    ]),
    ...(r.body ? ["--data-raw", quote(r.body)] : []),
  ].join(" ");
}
