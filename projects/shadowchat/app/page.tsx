import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import ShadowChat from "./shadowchat";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return <ShadowChat initialSignedIn={Boolean(user)} signInPath={chatGPTSignInPath("/")} />;
}
