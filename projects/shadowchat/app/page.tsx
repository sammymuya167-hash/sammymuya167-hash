import { requireChatGPTUser } from "./chatgpt-auth";
import ShadowChat from "./shadowchat";
export const dynamic = "force-dynamic";
export default async function Home() {
  await requireChatGPTUser("/");
  return <ShadowChat />;
}
