import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import TrackingPortal from "./portal";
export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const user = await getChatGPTUser();
  return (
    <TrackingPortal
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/tracking")}
      userName={user?.fullName ?? "Dispatcher"}
    />
  );
}
