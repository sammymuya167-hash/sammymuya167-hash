import Studio from "./studio";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { demoBoard } from "../lib/demo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <Studio initialBoard={demoBoard} signedIn={Boolean(user)} signInPath={chatGPTSignInPath("/")} />;
}
