import OfficeWorkspace from "./office/workspace";
import { officeIdentity } from "../lib/accounts";
import LoginScreen from "./login/screen";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await officeIdentity();
  if(!user)return <LoginScreen/>;
  return (
    <OfficeWorkspace
      userName={user.name}
      signedIn={true}
      signInPath="/login"
    />
  );
}
