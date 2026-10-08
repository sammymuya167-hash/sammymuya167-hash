import { officeIdentity } from "../../lib/accounts";
import LoginScreen from "../login/screen";
import TrackingPortal from "./portal";
export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const user = await officeIdentity();
  if(!user)return <LoginScreen returnTo="/tracking"/>;
  return (
    <TrackingPortal
      signedIn={!!user}
      signInPath="/login?returnTo=/tracking"
      userName={user.name}
    />
  );
}
