import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleChatRequest } from "../../../lib/chat-service";
export const dynamic = "force-dynamic";
async function handle(req: Request) {
  if (!env.DB) return Response.json({ error: "Private message storage is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return handleChatRequest(req, env.DB, await getChatGPTUser());
}
export const GET = handle;
export const POST = handle;
