import type { GPSPoint } from "./dispatch";

export type JourneyView = { segments: GPSPoint[][]; position: GPSPoint | null; moving: boolean; excludedPoints: number };

export function journeyDistance(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const r=Math.PI/180, n=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
  return 12742000*Math.atan2(Math.sqrt(n),Math.sqrt(Math.max(0,1-n)));
}

function movementEvidence(points:GPSPoint[],continuing=false) {
  if(points.length<3)return false;
  const first=points[0],last=points.at(-1)!,seconds=(last.recordedAt-first.recordedAt)/1000;
  if(seconds<6||seconds>60)return false;
  const travelled=points.slice(1).reduce((n,p,i)=>n+journeyDistance(points[i],p),0),net=journeyDistance(first,last),accuracy=points.reduce((n,p)=>n+p.accuracy,0)/points.length;
  const speedEvidence=points.filter(p=>p.speed!=null&&p.speed>=.65).length>=2;
  const threshold=Math.max(continuing?6:speedEvidence?8:15,accuracy*(continuing?1.2:speedEvidence?1.5:3),first.accuracy+last.accuracy);
  return net>=threshold&&net/Math.max(1,travelled)>=(speedEvidence?.65:continuing?.7:.75)&&net/seconds>=.35;
}

/** Long, repeatedly reversing fixes inside one small area are uncertain GPS,
 * even when a receiver reports walking speed. Keep their raw evidence, but do
 * not present the accumulated loops as verified travel. Phone motion evidence
 * preserves genuine local walks; ordinary road journeys leave the small area.
 */
function verifiedSegments(segments:GPSPoint[][],valid:GPSPoint[]) {
  const groups:GPSPoint[][][]=[];
  for(const segment of segments){const previous=groups.at(-1),end=previous?.at(-1)?.at(-1);if(end&&end.tripId===segment[0].tripId&&segment[0].recordedAt-end.recordedAt<=120000)previous!.push(segment);else groups.push([segment]);}
  return groups.flatMap(group=>{
    const first=group[0][0],last=group.at(-1)!.at(-1)!,seconds=(last.recordedAt-first.recordedAt)/1000;
    if(seconds<90)return group;
    const fixes=valid.filter(p=>p.tripId===first.tripId&&p.recordedAt>=first.recordedAt&&p.recordedAt<=last.recordedAt);
    if(fixes.length<8||fixes.some(p=>p.motion==='moving'))return group;
    const cornerA={lat:Math.min(...fixes.map(p=>p.lat)),lng:Math.min(...fixes.map(p=>p.lng))},cornerB={lat:Math.max(...fixes.map(p=>p.lat)),lng:Math.max(...fixes.map(p=>p.lng))};
    const extent=journeyDistance(cornerA,cornerB),travelled=fixes.slice(1).reduce((n,p,i)=>n+journeyDistance(fixes[i],p),0),net=journeyDistance(first,last);
    return extent<=150&&travelled>=Math.max(40,extent*2)&&net/Math.max(1,travelled)<.4&&net/seconds<.35?[]:group;
  });
}

/** One movement gate for the office, native map and mileage. Raw evidence is
 * never rewritten. Three coherent fixes must confirm motion before a trail is
 * backfilled. A zero-speed fix is a location heartbeat, not travelled distance.
 * Missing GPS and separate trips never acquire invented connecting lines.
 */
export function journeyView(points: GPSPoint[]): JourneyView {
  const ordered=[...new Map(points.map(p=>[p.eventId,p])).values()].sort((a,b)=>a.recordedAt-b.recordedAt);
  const valid:GPSPoint[]=[];
  for(let i=0;i<ordered.length;i++) {
    const p=ordered[i],previous=ordered[i-1],next=ordered[i+1];
    if(![p.lat,p.lng,p.accuracy,p.recordedAt].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||p.accuracy<0||p.accuracy>50)continue;
    if(previous&&next&&previous.tripId===p.tripId&&next.tripId===p.tripId&&next.recordedAt-previous.recordedAt>0&&next.recordedAt-previous.recordedAt<=10000&&previous.accuracy<=50&&next.accuracy<=50&&journeyDistance(previous,next)<Math.max(15,(previous.accuracy+next.accuracy)*.75)&&journeyDistance(previous,p)>Math.max(30,1.5*(previous.accuracy+p.accuracy))&&journeyDistance(next,p)>Math.max(30,1.5*(next.accuracy+p.accuracy)))continue;
    const a=valid.at(-1),gap=a?p.recordedAt-a.recordedAt:0;
    if(a&&a.tripId===p.tripId&&(gap<=0||gap<=120000&&journeyDistance(a,p)>55*gap/1000+a.accuracy+p.accuracy))continue;
    valid.push(p);
  }
  const segments:GPSPoint[][]=[];let anchor:GPSPoint|null=null,runStart:GPSPoint|null=null,previous:GPSPoint|null=null,pending:GPSPoint[]=[],moving=false,segment:GPSPoint[]|null=null;
  for(const p of valid) {
    if(!previous||previous.tripId!==p.tripId||p.recordedAt-previous.recordedAt>120000) {
      anchor=p;runStart=p;pending=[p];moving=false;segment=null;previous=p;continue;
    }
    previous=p;
    // Explicit zero speed wins over changing indoor coordinates. Availability,
    // battery and last-seen heartbeats continue without drawing those fixes.
    const gpsStopped=p.speed!=null&&p.speed<.3;
    // A quiet accelerometer alone cannot identify a steadily moving vehicle.
    // It vetoes local walking-sized drift; larger, coherent GPS displacement
    // can still establish travel without accelerometer vibration.
    const recent=segment?.slice(-5),recentFirst=recent?.[0],recentLast=recent?.at(-1),recentNet=recentFirst&&recentLast?journeyDistance(recentFirst,recentLast):0,recentSeconds=recentFirst&&recentLast?(recentLast.recordedAt-recentFirst.recordedAt)/1000:0;
    const steadyTravel=moving&&recentNet>=30&&recentSeconds>0&&recentNet/recentSeconds>=1.5;
    const sensorStopped=!steadyTravel&&p.motion==='still'&&(p.speed==null||p.speed<3)&&(!anchor||journeyDistance(anchor,p)<=Math.max(30,anchor.accuracy+p.accuracy));
    const stopped=gpsStopped||sensorStopped;
    if(stopped) {
      if(sensorStopped&&!gpsStopped){if(!pending.length&&anchor)pending=[anchor];pending.push(p);pending=pending.filter(q=>p.recordedAt-q.recordedAt<=60000);}else pending=[];
      moving=false;segment=null;
      continue;
    }
    if(moving&&anchor&&segment) {
      const metres=journeyDistance(anchor,p),noise=Math.max(3,Math.min(10,Math.min(anchor.accuracy,p.accuracy)*.35));
      if(metres<noise) {
        if(!pending.length)pending=[anchor];pending.push(p);
        if(p.recordedAt-pending[0].recordedAt>=15000){moving=false;segment=null;pending=[anchor,p];}
        continue;
      }
      const proof=[...segment.slice(-5),...pending,p].filter(q=>p.recordedAt-q.recordedAt<=60000);
      if(movementEvidence(proof,true)){segment.push(...pending.filter(q=>q.eventId!==anchor!.eventId),p);pending=[];anchor=p;continue;}
      // Motion must stay credible. A previous good walk is not permission to
      // append changing indoor coordinates or low-quality network locations.
      moving=false;segment=null;pending=[anchor];
    }
    if(!pending.length)pending=anchor?[anchor]:[p];
    // Slide the confirmation window: an inaccurate old network fix must not
    // poison every subsequent walking fix until a whole trip is restarted.
    while(pending.length&&p.recordedAt-pending[0].recordedAt>60000)pending.shift();
    if(!pending.length)pending=[p];
    const last=pending.at(-1)!;
    if(p.eventId!==last.eventId&&journeyDistance(last,p)>=Math.max(3,Math.min(10,Math.min(last.accuracy,p.accuracy)*.35)))pending.push(p);
    while(pending.length>=3&&!movementEvidence(pending)){
      const seconds=(p.recordedAt-pending[0].recordedAt)/1000,travelled=pending.slice(1).reduce((n,q,i)=>n+journeyDistance(pending[i],q),0),net=journeyDistance(pending[0],p);
      if(net/Math.max(1,travelled)>=.65&&(seconds<30||net/seconds>=.35))break;
      pending.shift();
    }
    if(!movementEvidence(pending))continue;
    segment=[...pending];segments.push(segment);anchor=p;pending=[];moving=true;
  }
  const verified=verifiedSegments(segments,valid),latest=valid.at(-1);
  if(segment&&!verified.includes(segment))moving=false;
  // Excluded loop evidence cannot leave its final wandering fix as the map
  // anchor. Fresh heartbeat metadata advances without fabricating distance.
  const lastVerified=verified.at(-1)?.at(-1),stable=lastVerified&&runStart&&lastVerified.tripId===runStart.tripId&&lastVerified.recordedAt>=runStart.recordedAt?lastVerified:runStart;
  if(!moving&&stable)anchor=stable;
  const position=anchor&&latest?{...latest,lat:anchor.lat,lng:anchor.lng,accuracy:Math.max(anchor.accuracy,latest.accuracy),speed:moving?latest.speed:0,heading:moving?latest.heading:null}:null;
  const accepted=new Set(verified.flat().map(p=>p.eventId));
  return {segments:verified,position,moving,excludedPoints:ordered.length-accepted.size};
}

export function journeySegments(points: GPSPoint[]) { return journeyView(points).segments; }

/** Keep an on-screen stationary marker fixed as bounded history windows roll.
 * Fresh metadata still advances, and a new trip, GPS gap or verified movement
 * releases the anchor. This is a derived marker, never a rewritten GPS event. */
export function holdStationaryPosition(previous:GPSPoint|null,next:GPSPoint|null,moving:boolean) {
  if(!previous||!next||moving||previous.tripId!==next.tripId||next.recordedAt<previous.recordedAt||next.recordedAt-previous.recordedAt>120000)return next;
  return {...next,lat:previous.lat,lng:previous.lng,accuracy:Math.max(previous.accuracy,next.accuracy)};
}
