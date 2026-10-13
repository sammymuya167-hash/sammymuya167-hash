import { networkEnv } from "../../lib/network-security";
import OfficeWorkspace from "../office/workspace";
import { officeIdentity } from "../../lib/accounts";
import LoginScreen from "../login/screen";
import { officeData } from "../../lib/office-store";
import { listDevices } from "../../lib/tracking-store";
import { listDispatches } from "../../lib/dispatch-store";
import { companyScenario } from "../../lib/company-scenario";
export const dynamic="force-dynamic";
export default async function Planner(){
  const user=await officeIdentity();
  if(!user||user.merchantStatus==='suspended')return <LoginScreen returnTo="/planner"/>;
  const records=await Promise.all([officeData(user.owner),listDevices(user.owner),listDispatches(user.owner,false)]);
  const scenario=records?companyScenario(...records):null;
  return <OfficeWorkspace staffRole={user.role} platformAdmin={user.role==='owner'&&user.owner===networkEnv().ROUTEFORGE_PLATFORM_OWNER} signedIn={true} userName={user.name} signInPath="/login?returnTo=/planner" initialView="planner" initialPlannerScenario={scenario}/>;
}
