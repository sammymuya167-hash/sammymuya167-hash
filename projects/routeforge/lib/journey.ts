import type { GPSPoint } from "./dispatch";

export type JourneyView = { segments: GPSPoint[][]; position: GPSPoint | null; moving: boolean; excludedPoints: number };

export function journeyDistance(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const r=Math.PI/180, n=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
  return 12742000*Math.atan2(Math.sqrt(n),Math.sqrt(Math.max(0,1-n)));
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
  const segments:GPSPoint[][]=[];let anchor:GPSPoint|null=null,previous:GPSPoint|null=null,pending:GPSPoint[]=[],moving=false,segment:GPSPoint[]|null=null,quietAt:number|null=null;
  for(const p of valid) {
    if(!previous||previous.tripId!==p.tripId||p.recordedAt-previous.recordedAt>120000) {
      anchor=p;pending=[p];moving=false;segment=null;quietAt=null;previous=p;continue;
    }
    previous=p;
    // Explicit zero speed wins over changing indoor coordinates. Availability,
    // battery and last-seen heartbeats continue without drawing those fixes.
    const stopped=p.speed!=null&&p.speed<.3;
    if(stopped) {
      if(quietAt==null)quietAt=p.recordedAt;
      pending=[];
      if(p.recordedAt-quietAt>=10000){moving=false;segment=null;}
      continue;
    }
    quietAt=null;
    if(moving&&anchor&&segment) {
      const metres=journeyDistance(anchor,p),noise=Math.max(3,Math.min(10,Math.min(anchor.accuracy,p.accuracy)*.35));
      if(metres<noise) {
        if(!pending.length)pending=[anchor];pending.push(p);
        if(p.recordedAt-pending[0].recordedAt>=15000){moving=false;segment=null;pending=[anchor,p];}
        continue;
      }
      pending=[];segment.push(p);anchor=p;continue;
    }
    if(!pending.length)pending=anchor?[anchor]:[p];
    // An old anchor is not evidence of movement across a long wait.
    if(p.recordedAt-pending[0].recordedAt>120000)pending=[p];
    const last=pending.at(-1)!;
    if(p.eventId!==last.eventId&&journeyDistance(last,p)>=Math.max(3,Math.min(10,Math.min(last.accuracy,p.accuracy)*.35)))pending.push(p);
    if(pending.length<3)continue;
    const first=pending[0],seconds=(p.recordedAt-first.recordedAt)/1000;
    if(seconds<6)continue;
    const travelled=pending.slice(1).reduce((n,q,i)=>n+journeyDistance(pending[i],q),0),net=journeyDistance(first,p),accuracy=pending.reduce((n,q)=>n+q.accuracy,0)/pending.length;
    const speedEvidence=pending.filter(q=>q.speed!=null&&q.speed>=.65).length>=2;
    // Without speed, require stronger positional evidence. Random indoor fixes
    // and gradual provider drift cannot accumulate mileage through this gate.
    const threshold=Math.max(speedEvidence?8:15,accuracy*(speedEvidence?1.5:3));
    if(net<threshold||net/Math.max(1,travelled)<(speedEvidence?.65:.75)||net/seconds<.35)continue;
    segment=[...pending];segments.push(segment);anchor=p;pending=[];moving=true;
  }
  const latest=valid.at(-1),position=anchor&&latest?{...latest,lat:anchor.lat,lng:anchor.lng,accuracy:Math.max(anchor.accuracy,latest.accuracy),speed:moving?latest.speed:0,heading:moving?latest.heading:null}:null;
  const accepted=new Set(segments.flat().map(p=>p.eventId));
  return {segments,position,moving,excludedPoints:ordered.length-accepted.size};
}

export function journeySegments(points: GPSPoint[]) { return journeyView(points).segments; }

/** Keep an on-screen stationary marker fixed as bounded history windows roll.
 * Fresh metadata still advances, and a new trip, GPS gap or verified movement
 * releases the anchor. This is a derived marker, never a rewritten GPS event. */
export function holdStationaryPosition(previous:GPSPoint|null,next:GPSPoint|null,moving:boolean) {
  if(!previous||!next||moving||previous.tripId!==next.tripId||next.recordedAt<previous.recordedAt||next.recordedAt-previous.recordedAt>120000)return next;
  return {...next,lat:previous.lat,lng:previous.lng,accuracy:Math.max(previous.accuracy,next.accuracy)};
}
