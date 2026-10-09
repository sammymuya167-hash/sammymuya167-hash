package app.shadownet.routeforge.driver;
import android.content.Context;
import android.webkit.WebResourceResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.mapsforge.core.model.Tile;
import org.mapsforge.map.android.graphics.AndroidGraphicFactory;
import org.mapsforge.map.reader.MapFile;
import org.mapsforge.map.model.DisplayModel;
import org.mapsforge.map.layer.renderer.DatabaseRenderer;
import org.mapsforge.map.layer.renderer.RendererJob;
import org.mapsforge.map.layer.cache.InMemoryTileCache;
import org.mapsforge.map.rendertheme.StreamRenderTheme;
import org.mapsforge.map.rendertheme.rule.RenderThemeFuture;

/** Offline road packs by county plus a shared Kenya vector basemap. No tile scraping. */
final class OfflineMaps {
 static volatile boolean downloading=false;static volatile String progress="";
 private static MapFile map;private static DatabaseRenderer renderer;private static RenderThemeFuture theme;private static DisplayModel display;private static final android.util.LruCache<String,byte[]> tiles=new android.util.LruCache<String,byte[]>(8388608){protected int sizeOf(String k,byte[] v){return v.length;}};
 private static File folder(Context c){return new File(c.getFilesDir(),"maps-v1");}
 static JSONArray counties(Context c)throws Exception{try(InputStream in=c.getAssets().open("roads/counties.json")){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] chunk=new byte[4096];int n;while((n=in.read(chunk))!=-1)b.write(chunk,0,n);return new JSONObject(b.toString("UTF-8")).getJSONArray("counties");}}
 static JSONObject state(Context c)throws Exception{JSONArray packs=counties(c),rows=new JSONArray();File roads=new File(c.getFilesDir(),"roads-v1.7.10");for(int i=0;i<packs.length();i++){JSONObject p=new JSONObject(packs.getJSONObject(i).toString());JSONArray files=p.getJSONArray("files");boolean available=true;long bytes=0;for(int j=0;j<files.length();j++){File f=new File(roads,files.getString(j));if(!f.isFile()||f.length()<1024)available=false;bytes+=f.length();}p.put("available",available).put("bytes",bytes);rows.put(p);}return new JSONObject().put("counties",rows).put("downloading",downloading).put("progress",progress).put("basemap",new File(folder(c),"kenya.map").isFile()).put("attribution","Mapsforge · © OpenStreetMap contributors (ODbL); county extents: geoBoundaries / RCMRD, public domain");}
 static void county(Context c,String id)throws Exception{if(!Session.loggedIn(c))throw new IllegalStateException("Sign in to download maps.");JSONArray packs=counties(c);JSONObject found=null;for(int i=0;i<packs.length();i++)if(id.equals(packs.getJSONObject(i).getString("id")))found=packs.getJSONObject(i);if(found==null)throw new IllegalStateException("Choose a Kenyan county.");downloading=true;try{progress="Downloading "+found.getString("name")+" road region";OfflineRoads.downloadCounty(c,found.getJSONArray("files"));progress="County roads saved. Directions work offline. Install the Kenya basemap for offline street labels.";}finally{downloading=false;}}
 static void basemap(Context c)throws Exception{if(!Session.loggedIn(c))throw new IllegalStateException("Sign in to download maps.");downloading=true;File dir=folder(c);if(!dir.isDirectory()&&!dir.mkdirs())throw new java.io.IOException("Could not prepare map storage");File part=new File(dir,"kenya.map.part"),target=new File(dir,"kenya.map");HttpURLConnection connection=(HttpURLConnection)new URL("https://download.mapsforge.org/maps/v5/africa/kenya.map").openConnection();
  try{connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);if(connection.getResponseCode()!=200)throw new java.io.IOException("Kenya map unavailable");long length=connection.getContentLengthLong();if(length<1048576||length>805306368)throw new java.io.IOException("Invalid basemap size");if(dir.getUsableSpace()<length+52428800)throw new IllegalStateException("Free at least "+((length+52428800)/1048576)+" MB for the Kenya map.");try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(part)){byte[] b=new byte[65536];long total=0;int n;while((n=in.read(b))!=-1){if(!Session.loggedIn(c))throw new IllegalStateException("Sign in again to resume map setup");total+=n;if(total>length)throw new java.io.IOException("Invalid map length");out.write(b,0,n);progress="Kenya basemap · "+(total/1048576)+" / "+(length/1048576)+" MB";}if(total!=length)throw new java.io.IOException("Incomplete basemap");out.getFD().sync();}MapFile check=new MapFile(part);check.close();synchronized(OfflineMaps.class){if(map!=null){map.close();map=null;renderer=null;}if(!part.renameTo(target))throw new java.io.IOException("Could not save basemap");tiles.evictAll();}progress="Kenya basemap installed. Streets and labels work offline in all 47 counties.";
  }catch(Exception e){part.delete();throw e;}finally{connection.disconnect();downloading=false;}
 }
 static synchronized WebResourceResponse tile(Context c,String raw){
  try{android.net.Uri uri=android.net.Uri.parse(raw);if(!"tile.openstreetmap.org".equals(uri.getHost())||!"https".equals(uri.getScheme())||!uri.getPath().matches("/[0-9]{1,2}/[0-9]+/[0-9]+\\.png"))return null;File file=new File(folder(c),"kenya.map");if(!file.isFile())return null;String key=uri.getPath();byte[] data=tiles.get(key);if(data==null){String[] parts=key.substring(1).replace(".png","").split("/");int z=Integer.parseInt(parts[0]);long x=Long.parseLong(parts[1]),y=Long.parseLong(parts[2]);if(z>19||x<0||y<0||x>=(1L<<z)||y>=(1L<<z))return null;if(map==null){AndroidGraphicFactory.createInstance(c.getApplicationContext());map=new MapFile(file);display=new DisplayModel();display.setFixedTileSize(256);theme=new RenderThemeFuture(AndroidGraphicFactory.INSTANCE,new StreamRenderTheme("",c.getAssets().open("roads/offline-theme.xml")),display);theme.run();renderer=new DatabaseRenderer(map,AndroidGraphicFactory.INSTANCE,new InMemoryTileCache(32),null,true,false,null);}Tile tile=new Tile(x,y,(byte)z,256);if(!map.supportsTile(tile))return null;org.mapsforge.core.graphics.TileBitmap bitmap=renderer.executeJob(new RendererJob(tile,map,theme,display,1f,false,false));if(bitmap==null)return null;ByteArrayOutputStream out=new ByteArrayOutputStream();AndroidGraphicFactory.getBitmap(bitmap).compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);bitmap.decrementRefCount();data=out.toByteArray();tiles.put(key,data);}return new WebResourceResponse("image/png",null,new ByteArrayInputStream(data));
  }catch(Exception ignored){return null;}
 }
}
