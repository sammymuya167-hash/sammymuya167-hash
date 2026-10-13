import { networkEnv } from "../lib/network-security";
import OfficeWorkspace from "./office/workspace";
import { officeIdentity } from "../lib/accounts";
import LoginScreen from "./login/screen";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await officeIdentity();
  if(!user)return <LoginScreen/>;
  return (
    <OfficeWorkspace
      staffRole={user.role}
      platformAdmin={user.role==='owner'&&user.owner===networkEnv().ROUTEFORGE_PLATFORM_OWNER}
      userName={user.name}
      signedIn={true}
      signInPath="/login"
    />
  );
}
