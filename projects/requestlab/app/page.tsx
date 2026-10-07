import Studio from "./studio";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { demoWorkspace } from "../lib/demo";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <Studio
      initialWorkspace={demoWorkspace}
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
