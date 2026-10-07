import DispatchWorkspace from "./workspace";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import { demoScenario } from "../lib/demo";
import { optimize } from "../lib/optimizer";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <DispatchWorkspace
      initialScenario={demoScenario}
      initialResult={optimize(demoScenario)}
      userName={user?.fullName ?? "SHADOWNET"}
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
