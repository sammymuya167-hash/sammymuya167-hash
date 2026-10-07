import Workspace from "./workspace";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { demoBoard } from "../lib/demo";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <Workspace
      initialBoard={demoBoard()}
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
