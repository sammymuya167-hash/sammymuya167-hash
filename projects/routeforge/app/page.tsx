import OfficeWorkspace from "./office/workspace";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <OfficeWorkspace
      userName={user?.fullName ?? "SHADOWNET"}
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/")}
    />
  );
}
