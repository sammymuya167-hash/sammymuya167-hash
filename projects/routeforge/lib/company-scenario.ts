import { driverChoices, type OfficeData } from "./office";
import type { Device } from "./tracking";
import type { Dispatch } from "./dispatch";
import type { Scenario } from "./model";

export function companyScenario(office:OfficeData,devices:Device[],dispatches:Dispatch[]):Scenario|null {
  if(!office.settings.location)return null;
  const choices=driverChoices(devices,office.profiles,dispatches);
  return {
    name:"Company delivery plan",depot:office.settings.location,
    deliveries:office.orders.filter(o=>o.status==="queued").slice(0,60).map(o=>({id:o.id,name:o.title,address:o.destination.address,lat:o.destination.lat,lng:o.destination.lng,weight:1,serviceMinutes:5,windowStart:480,windowEnd:1200,priority:"normal"})),
    vehicles:choices.slice(0,8).map((c,i)=>({id:c.device.id,name:c.device.vehicleLabel||`${c.device.driverName}'s vehicle`,driver:c.device.driverName,capacity:30,costPerKm:c.profile?.ratePerKm??0,shiftStart:480,shiftEnd:1200,active:c.available,color:["#608bff","#5bddc9","#a385ff","#ffa566"][i%4]})),
    speedKph:28,roadFactor:1.3,
  };
}
