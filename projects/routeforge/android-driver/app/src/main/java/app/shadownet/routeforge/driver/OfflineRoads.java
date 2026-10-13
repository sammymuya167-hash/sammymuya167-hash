package app.shadownet.routeforge.driver;
import android.content.Context;
import android.location.Location;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import btools.router.RoutingContext;
import btools.router.RoutingEngine;
import btools.router.OsmNodeNamed;
import btools.router.OsmTrack;
import btools.router.OsmPathElement;

/** MIT-licensed BRouter runs on this phone. Only public road files are downloaded. */
final class OfflineRoads {
 private static volatile RoutingEngine activeEngine;private static final java.util.concurrent.atomic.AtomicLong generation=new java.util.concurrent.atomic.AtomicLong();
 static volatile String progress="";
 static void cancel(){generation.incrementAndGet();RoutingEngine e=activeEngine;if(e!=null)e.terminate();}
 private static void checkGeneration(long expected){if(expected!=generation.get())throw new IllegalStateException("Road routing paused. Your delivery is retained.");}
 static String tile(double lat,double lng){int x=(int)Math.floor(lng/5)*5,y=(int)Math.floor(lat/5)*5;return (x<0?"W":"E")+Math.abs(x)+"_"+(y<0?"S":"N")+Math.abs(y)+".rd5";}
 static List<String> required(JSONObject from,JSONObject to)throws Exception{
  double minLat=Math.min(from.getDouble("lat"),to.getDouble("lat"))-.08,maxLat=Math.max(from.getDouble("lat"),to.getDouble("lat"))+.08,minLng=Math.min(from.getDouble("lng"),to.getDouble("lng"))-.08,maxLng=Math.max(from.getDouble("lng"),to.getDouble("lng"))+.08;
  List<String> files=new ArrayList<>();for(int lat=(int)Math.floor(minLat/5)*5;lat<=maxLat;lat+=5)for(int lng=(int)Math.floor(minLng/5)*5;lng<=maxLng;lng+=5){if(files.size()>=6)throw new IllegalStateException("This route crosses too many regions. Open road navigation for this long journey.");files.add(tile(lat,lng));}return files;
 }
 private static void copyAsset(Context c,String name,File target)throws Exception{try(InputStream in=c.getAssets().open("roads/"+name);FileOutputStream out=new FileOutputStream(target)){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}}
 private static void download(Context c,String name,File folder,long expected)throws Exception{
  if(!name.matches("[EW][0-9]{1,3}_[NS][0-9]{1,2}\\.rd5"))throw new IllegalArgumentException("Invalid road region");File target=new File(folder,name);
  // Road files contain no customer data and are reusable across rider accounts.
  if(target.isFile()&&target.length()>1024&&!Session.prefs(c).getBoolean("roads_download_allowed",false))return;
  if(target.isFile()&&target.length()>1024&&System.currentTimeMillis()-target.lastModified()<30L*86400000)return;
  if(!target.isFile()&&!Session.prefs(c).getBoolean("roads_download_allowed",false))throw new IllegalStateException("Load road directions to download the regional road map once (about 34 MB around Nairobi). Saved road maps work offline.");
  checkGeneration(expected);HttpURLConnection connection=(HttpURLConnection)new URL("https://brouter.de/brouter/segments4/"+name).openConnection();File part=new File(folder,name+".part");
  try{connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestProperty("User-Agent","RouteForgeRider/1.4 (+"+Session.API+")");int status=connection.getResponseCode();if(status!=200)throw new java.io.IOException("Road region unavailable");long length=connection.getContentLengthLong();if(length<1024||length>134217728)throw new java.io.IOException("Road region is too large");if(folder.getUsableSpace()<length+20971520)throw new IllegalStateException("Free some phone storage before downloading the road map.");
   try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(part)){byte[] b=new byte[16384];long total=0;int n;while((n=in.read(b))!=-1){checkGeneration(expected);total+=n;if(total>length)throw new java.io.IOException("Invalid road file length");out.write(b,0,n);progress="Downloading road map · "+(total/1048576)+" / "+(length/1048576)+" MB. This is cached for future rides.";}if(total!=length)throw new java.io.IOException("Incomplete road file");out.getFD().sync();}
   if(!part.renameTo(target))throw new java.io.IOException("Could not save road data");
  }catch(Exception e){part.delete();if(expected==generation.get()&&target.isFile()&&target.length()>1024){progress="Using saved road data while offline";return;}throw e;}finally{connection.disconnect();}
 }
 static void installBundle(Context c)throws Exception{
  File folder=new File(c.getFilesDir(),"roads-v1.7.10");if(!folder.isDirectory()&&!folder.mkdirs())throw new java.io.IOException("Could not prepare roads");File target=new File(folder,"E35_S5.rd5");if(!target.isFile())try{File part=new File(folder,"E35_S5.rd5.bundle");copyAsset(c,"E35_S5.rd5",part);if(part.length()>1024){if(!part.renameTo(target))throw new java.io.IOException("Could not install bundled roads");}else part.delete();}catch(java.io.FileNotFoundException ignored){}
 }
 static void downloadCounty(Context c,JSONArray files)throws Exception{installBundle(c);File folder=new File(c.getFilesDir(),"roads-v1.7.10");long expected=generation.get();for(int i=0;i<files.length();i++)download(c,files.getString(i),folder,expected);}
 static JSONObject route(Context c,JSONObject from,JSONObject to,String profile)throws Exception{
  installBundle(c);long expected=generation.get();if(!Session.loggedIn(c)||!TrackingService.running)throw new IllegalStateException("Start duty to load road directions.");File folder=new File(c.getFilesDir(),"roads-v1.7.10");if(!folder.isDirectory()&&!folder.mkdirs())throw new java.io.IOException("Could not prepare road storage");
  for(String name:new String[]{"lookups.dat","car-vario.brf","trekking.brf"})copyAsset(c,name,new File(folder,name));
  for(String name:required(from,to)){checkGeneration(expected);download(c,name,folder,expected);}
  return calculate(folder,from,to,profile,expected);
 }
 static JSONObject calculate(File folder,JSONObject from,JSONObject to,String profile)throws Exception{return calculate(folder,from,to,profile,generation.get());}
 private static JSONObject calculate(File folder,JSONObject from,JSONObject to,String profile,long expected)throws Exception{
  progress="Calculating your road route…";RoutingContext rc=new RoutingContext();rc.localFunction=new File(folder,profile.equals("cycling")?"trekking.brf":"car-vario.brf").getAbsolutePath();rc.memoryclass=64;
  List<OsmNodeNamed> waypoints=new ArrayList<>();for(JSONObject point:new JSONObject[]{from,to}){OsmNodeNamed n=new OsmNodeNamed();n.ilon=(int)Math.round((point.getDouble("lng")+180)*1000000);n.ilat=(int)Math.round((point.getDouble("lat")+90)*1000000);n.name=waypoints.isEmpty()?"from":"to";waypoints.add(n);}
  RoutingEngine engine=new RoutingEngine(null,null,folder,waypoints,rc);activeEngine=engine;engine.quite=true;
  try{checkGeneration(expected);engine.doRun(20000);checkGeneration(expected);if(engine.getErrorMessage()!=null)throw new IllegalStateException("A road route could not be found near these pins. Check the entrance or open road navigation.");OsmTrack track=engine.getFoundTrack();if(track==null||track.nodes.size()<2||track.nodes.size()>30000)throw new IllegalStateException("Road route unavailable");
   StringBuilder line=new StringBuilder();int oldLat=0,oldLng=0;for(OsmPathElement node:track.nodes){int lat=node.getILat()-90000000,lng=node.getILon()-180000000;encode(line,lat-oldLat);encode(line,lng-oldLng);oldLat=lat;oldLng=lng;}if(line.length()>150000)throw new IllegalStateException("This route is too long to display. Open road navigation.");
   float[] first=new float[1],last=new float[1];OsmPathElement a=track.nodes.get(0),b=track.nodes.get(track.nodes.size()-1);Location.distanceBetween(from.getDouble("lat"),from.getDouble("lng"),(a.getILat()-90000000)/1e6,(a.getILon()-180000000)/1e6,first);Location.distanceBetween(to.getDouble("lat"),to.getDouble("lng"),(b.getILat()-90000000)/1e6,(b.getILon()-180000000)/1e6,last);
   if(first[0]>250||last[0]>250)throw new IllegalStateException("The entrance pin is too far from a mapped road. Check the location with the office.");
   return new JSONObject().put("from",new JSONObject().put("lat",from.getDouble("lat")).put("lng",from.getDouble("lng"))).put("to",new JSONObject().put("lat",to.getDouble("lat")).put("lng",to.getDouble("lng"))).put("distanceMeters",track.distance).put("durationSeconds",track.getTotalSeconds()).put("geometry",line.toString()).put("profile",profile).put("calculatedAt",System.currentTimeMillis()).put("snappedMeters",new JSONArray().put(first[0]).put(last[0])).put("attribution","BRouter · © OpenStreetMap contributors (ODbL)");
  }finally{activeEngine=null;progress="";}
 }
 private static void encode(StringBuilder line,int delta){long value=delta<0?~((long)delta<<1):(long)delta<<1;while(value>=32){line.append((char)((32|(value&31))+63));value>>=5;}line.append((char)(value+63));}
}
