/* eslint-disable @next/next/no-html-link-for-pages -- These office transitions intentionally reload the full document in the Sites host. */
import DispatchWorkspace from "../workspace";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { officeData } from "../../lib/office-store";
import { listDevices } from "../../lib/tracking-store";
import { listDispatches } from "../../lib/dispatch-store";
import { driverChoices } from "../../lib/office";
import type { Scenario } from "../../lib/model";
export const dynamic="force-dynamic";
export default async function Planner(){
  const user=await getChatGPTUser();
  if(!user)return <main className="planner-entry"><h1>Your company route planner</h1><p>Sign in to load your private office locations, queued orders and onboarded drivers.</p><a className="tracking-primary" href={chatGPTSignInPath("/planner")} target="_top">Sign in with ChatGPT</a></main>;
  const [office,devices,dispatches]=await Promise.all([officeData(user.userId),listDevices(user.userId),listDispatches(user.userId)]);
  if(!office.settings.location)return <main className="planner-entry"><h1>Locate your main office first.</h1><p>The planner uses your saved office location as its depot. Add it in the main office before calculating real delivery estimates.</p><a className="tracking-primary" href="/" target="_top">Open main office →</a></main>;
  const choices=driverChoices(devices,office.profiles,dispatches);
  const scenario:Scenario={name:"Company delivery plan",depot:office.settings.location,deliveries:office.orders.filter(o=>o.status==="queued").slice(0,60).map(o=>({id:o.id,name:o.title,address:o.destination.address,lat:o.destination.lat,lng:o.destination.lng,weight:1,serviceMinutes:5,windowStart:480,windowEnd:1200,priority:"normal"})),vehicles:choices.slice(0,8).map((c,i)=>({id:c.device.id,name:c.device.vehicleLabel||`${c.device.driverName}'s vehicle`,driver:c.device.driverName,capacity:30,costPerKm:c.profile?.ratePerKm??0,shiftStart:480,shiftEnd:1200,active:c.available,color:["#608bff","#5bddc9","#a385ff","#ffa566"][i%4]})),speedKph:28,roadFactor:1.3};
  return <DispatchWorkspace initialScenario={scenario} initialResult={null} signedIn userName={user.fullName??"Office"} signInPath={chatGPTSignInPath("/planner")}/>;
}
