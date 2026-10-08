import OfficeWorkspace from "../office/workspace";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { officeData } from "../../lib/office-store";
import { listDevices } from "../../lib/tracking-store";
import { listDispatches } from "../../lib/dispatch-store";
import { companyScenario } from "../../lib/company-scenario";
export const dynamic="force-dynamic";
export default async function Planner(){
  const user=await getChatGPTUser();
  const records=user?await Promise.all([officeData(user.userId),listDevices(user.userId),listDispatches(user.userId,false)]):null;
  const scenario=records?companyScenario(...records):null;
  return <OfficeWorkspace signedIn={!!user} userName={user?.fullName??"Office"} signInPath={chatGPTSignInPath("/planner")} initialView="planner" initialPlannerScenario={scenario}/>;
}
