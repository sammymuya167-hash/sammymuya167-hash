package app.shadownet.routeforge.driver;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.ParcelFileDescriptor;
import android.view.accessibility.AccessibilityNodeInfo;
import android.app.Instrumentation;
import android.content.Intent;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Uses only platform APIs; never records GPS or contacts the live portal. */
public final class QueueInstrumentation extends Instrumentation {
    private String activeTest="setup";private int activeNumber=0;
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    private JSONObject event() throws Exception {
        return new JSONObject().put("eventId", UUID.randomUUID().toString())
                .put("tripId", UUID.randomUUID().toString()).put("kind", "start")
                .put("recordedAt", System.currentTimeMillis());
    }
    private void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private void status(int code, String name, int number, String message) {
        activeTest=name;activeNumber=number;
        Bundle b = new Bundle(); b.putString("class", getClass().getName());
        b.putString("test", name); b.putInt("numtests", 30); b.putInt("current", number);
        b.putString("stream", message); sendStatus(code, b);
    }
    private boolean notificationCount(NotificationManager manager,int expected) throws Exception {
        // NotificationManager enqueues/cancels through system_server. Its
        // return is not an acknowledgement that the active list has changed.
        for(int attempt=0;attempt<40;attempt++){if(manager.getActiveNotifications().length==expected)return true;Thread.sleep(75);}
        return manager.getActiveNotifications().length==expected;
    }
    private String windowText(AccessibilityNodeInfo node) {
        if(node==null)return "<no active window>";
        StringBuilder text=new StringBuilder();
        if(node.getText()!=null)text.append(node.getClassName()).append(':').append(node.getText()).append(';');
        for(int i=0;i<node.getChildCount();i++)text.append(windowText(node.getChild(i)));
        return text.toString();
    }
    private JSONObject inspectUi(Activity activity) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        runOnMainSync(() -> {
            WebView web = (WebView) ((ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
            web.evaluateJavascript("(function(){if(typeof applyState!=='function'||typeof go!=='function'||typeof Rider==='undefined')return {ready:false};go('trips');var text=document.getElementById('tripcontent').textContent;go('account');return {ready:true,paired:!!state.paired,bridge:typeof Rider.action==='function'&&typeof Rider.login==='function'&&typeof Rider.logout==='function'&&typeof Rider.settings==='function',credentials:typeof Rider.token!=='undefined'||typeof Rider.session!=='undefined',totals:text.indexOf('REPORTED COLLECTIONS')>=0&&text.indexOf('VERIFIED BY OFFICE')>=0,login:document.getElementById('loginscreen').style.display!=='none'&&document.getElementById('loginpassword').type==='password'&&getComputedStyle(document.getElementById('ridernav')).display==='none',pages:['home','offers','route','trips','account'].every(function(id){return !!document.getElementById(id);})};})()", result -> { value.set(result); done.countDown(); });
        });
        check(done.await(5, TimeUnit.SECONDS), "Packaged UI evaluation must respond");
        return new JSONObject(value.get());
    }
    private android.location.Location fix(long time,long elapsed,double lat,double lng,float accuracy,String provider){android.location.Location value=new android.location.Location(provider);value.setTime(time);value.setElapsedRealtimeNanos(elapsed);value.setLatitude(lat);value.setLongitude(lng);value.setAccuracy(accuracy);value.setSpeed(1.5f);return value;}
    @Override public void onStart() {
        EventQueue queue = EventQueue.get(getTargetContext());
        Activity[] ui = new Activity[1];
        try {
            queue.clear();
            status(1, "offlineQueueSurvivesReopen", 1, "");
            JSONObject a = event(), b = event(); queue.add(a); queue.add(b);
            queue.close();
            check(queue.count() == 2, "Unsent events must survive a database reopen");
            check(queue.batch().length() == 2, "An attempted upload cannot empty the queue");
            status(0, "offlineQueueSurvivesReopen", 1, ".");
            status(1, "onlyAcknowledgedEventsAreDeleted", 2, "");
            JSONArray batch = queue.batch();
            queue.acknowledge(batch, new JSONArray().put(batch.getJSONObject(0).getString("eventId")));
            check(queue.count() == 1, "Partial receipt must leave the unacknowledged event");
            status(0, "onlyAcknowledgedEventsAreDeleted", 2, ".");
            status(1, "unexpectedAcknowledgementRollsBack", 3, "");
            queue.clear(); queue.add(event()); queue.add(event()); batch = queue.batch();
            boolean rejected = false;
            try { queue.acknowledge(batch, new JSONArray()
                    .put(batch.getJSONObject(0).getString("eventId"))
                    .put(UUID.randomUUID().toString())); }
            catch (IllegalArgumentException expected) { rejected = true; }
            check(rejected && queue.count() == 2, "An invalid receipt must roll back every deletion");
            status(0, "unexpectedAcknowledgementRollsBack", 3, ".");
            status(1, "riderCommandsSurviveReopenAndKeepOrder", 4, "");
            queue.clearCommands();String device=UUID.randomUUID().toString(),dispatch=UUID.randomUUID().toString();
            JSONObject collect=new JSONObject().put("operationId",UUID.randomUUID().toString()).put("action","collected").put("dispatchId",dispatch);
            JSONObject finish=new JSONObject().put("operationId",UUID.randomUUID().toString()).put("action","delivered").put("dispatchId",dispatch);
            queue.addCommand(device,collect);queue.addCommand(device,finish);queue.close();
            check(queue.commandCount()==2&&queue.command().getJSONObject("payload").getString("action").equals("collected"),"Offline collection must remain ahead of delivery after reopen");
            check(queue.completedLocally(dispatch),"An offline finish report must permit local end duty");
            queue.commandDone(collect.getString("operationId"));queue.commandError(finish.getString("operationId"),"Rejected fixture");
            check(!queue.completedLocally(dispatch)&&queue.commandCount()==1,"Rejected completion cannot release duty and must not disappear");
            status(0, "riderCommandsSurviveReopenAndKeepOrder", 4, ".");
            status(1, "versionOneJourneyMigrationPreservesEvents", 5, "");
            queue.clear();queue.clearCommands();queue.add(event());queue.getWritableDatabase().execSQL("DROP TABLE commands");queue.getWritableDatabase().setVersion(1);queue.close();
            check(queue.count()==1&&queue.commandCount()==0,"Version one GPS events must survive adding the rider action queue");
            status(0, "versionOneJourneyMigrationPreservesEvents", 5, ".");
            status(1, "encryptedLinkClearResetsTelemetryAndRetainsUnlink", 6, "");
            queue.clear();Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token"));
            Session.prefs(getTargetContext()).edit().putLong("last_fix",123).putLong("last_sync",456).putString("last_point","{}").putString("rider_state","{}").commit();
            Session.saveUnlink(getTargetContext(),new JSONObject().put("token","test-only-token").put("operationId",UUID.randomUUID().toString()));Session.clear(getTargetContext());
            check(Session.get(getTargetContext())==null&&Session.prefs(getTargetContext()).getLong("last_fix",0)==0&&Session.prefs(getTargetContext()).getLong("last_sync",0)==0,"Clear must reset link and stale telemetry");
            check(Session.pendingUnlink(getTargetContext())!=null,"Offline unlink token must survive securely until acknowledged");Session.prefs(getTargetContext()).edit().remove("pending_unlink").commit();
            status(0, "encryptedLinkClearResetsTelemetryAndRetainsUnlink", 6, ".");
            status(1, "packagedUiLoadsOfflineWithNativeBridge", 7, "");
            queue.clear();queue.clearCommands();Session.clear(getTargetContext());
            ui[0] = startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            JSONObject screen = new JSONObject();
            for (int attempt = 0; attempt < 30; attempt++) {
                screen = inspectUi(ui[0]);
                if (screen.optBoolean("ready")) break;
                Thread.sleep(100);
            }
            check(screen.optBoolean("ready"), "Offline rider interface must load without a server page");
            check(screen.optBoolean("bridge") && !screen.optBoolean("credentials"), "Packaged interface must have native controls without exposing credentials");
            check(screen.optBoolean("pages") && screen.optBoolean("totals"), "Map, offers, trip totals and account controls must remain available");
            check(screen.optBoolean("login") && !screen.optBoolean("paired") && !TrackingService.running, "Opening an unsigned phone must show a login without starting GPS: "+screen);
            check(queue.count()==0 && queue.commandCount()==0, "Opening the dashboard must not record or submit a trip");
            status(0, "packagedUiLoadsOfflineWithNativeBridge", 7, ".");
            status(1,"deliveryChannelsHaveSoundAndHeadsUp",8,"");
            NotificationManager manager=getTargetContext().getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel("delivery-offers","Old fixture channel",NotificationManager.IMPORTANCE_DEFAULT));
            DriverAlerts.channels(getTargetContext());
            for(String channel:new String[]{DriverAlerts.OFFERS,DriverAlerts.ASSIGNMENTS}){NotificationChannel configured=manager.getNotificationChannel(channel);check(configured.getImportance()==NotificationManager.IMPORTANCE_HIGH&&configured.getSound()!=null&&configured.shouldVibrate(),"Offers and assigned rides need high importance, sound and vibration");}
            check(manager.getNotificationChannel("delivery-offers").getImportance()==NotificationManager.IMPORTANCE_DEFAULT,"Upgrade must use a new channel rather than trying to rewrite an immutable old channel");
            status(0,"deliveryChannelsHaveSoundAndHeadsUp",8,".");
            status(1,"assignedDeliveryAlertsOnceAndCancelsOnCompletion",9,"");
            if(android.os.Build.VERSION.SDK_INT>=33)try(java.io.InputStream stream=new ParcelFileDescriptor.AutoCloseInputStream(getUiAutomation().executeShellCommand("pm grant "+getTargetContext().getPackageName()+" android.permission.POST_NOTIFICATIONS"))){while(stream.read()!=-1){}}
            check(manager.areNotificationsEnabled(),"Fixture notification permission must be granted");
            String assignedId=UUID.randomUUID().toString();JSONArray stops=new JSONArray().put(new JSONObject().put("id","one").put("name","Pickup").put("deliveredAt",JSONObject.NULL)).put(new JSONObject().put("id","two").put("name","Destination").put("deliveredAt",JSONObject.NULL));
            JSONObject assignment=new JSONObject().put("id",assignedId).put("name","Synthetic assigned delivery").put("stops",stops),snapshot=new JSONObject().put("serverTime",System.currentTimeMillis()).put("offers",new JSONArray()).put("assignment",assignment);
            DriverAlerts.sync(getTargetContext(),snapshot);
            check(notificationCount(manager,1)&&Session.prefs(getTargetContext()).getString("notified_assignment","").equals(assignedId),"Automatic assignment must create an alert independently of an offer: "+Session.prefs(getTargetContext()).getString("alerts_error",""));
            manager.cancel("assignment:"+assignedId,assignedId.hashCode());DriverAlerts.sync(getTargetContext(),snapshot);
            check(notificationCount(manager,0),"Dismissing a ride cannot make every poll sound again");
            String nextId=UUID.randomUUID().toString();assignment.put("id",nextId);DriverAlerts.sync(getTargetContext(),snapshot);check(notificationCount(manager,1),"A different assigned ride must alert again");
            for(int i=0;i<stops.length();i++)stops.getJSONObject(i).put("deliveredAt",System.currentTimeMillis());DriverAlerts.sync(getTargetContext(),snapshot);check(notificationCount(manager,0),"Completed deliveries cannot leave an active assignment alert behind");
            status(0,"assignedDeliveryAlertsOnceAndCancelsOnCompletion",9,".");
            status(1,"everyLegacyStopMustFinishBeforeLocalEndDuty",10,"");
            queue.clearCommands();for(int i=0;i<stops.length();i++)stops.getJSONObject(i).put("deliveredAt",JSONObject.NULL);
            Session.prefs(getTargetContext()).edit().putString("rider_state",snapshot.toString()).commit();
            JSONObject firstStop=new JSONObject().put("operationId",UUID.randomUUID().toString()).put("action","delivered").put("dispatchId",nextId).put("stopId","one");queue.addCommand(device,firstStop);
            check(!DriverApi.canStop(getTargetContext()),"Completing only the first legacy stop cannot end duty");
            JSONObject lastStop=new JSONObject().put("operationId",UUID.randomUUID().toString()).put("action","delivered").put("dispatchId",nextId).put("stopId","two");queue.addCommand(device,lastStop);check(DriverApi.canStop(getTargetContext()),"Every queued legacy completion should permit local end duty");
            queue.commandError(lastStop.getString("operationId"),"Rejected fixture");check(!DriverApi.canStop(getTargetContext()),"A rejected final stop cannot release duty");queue.clearCommands();Session.clear(getTargetContext());
            status(0,"everyLegacyStopMustFinishBeforeLocalEndDuty",10,".");
            status(1,"finishConfirmationUsesAWorkingNativeDialog",11,"");
            CountDownLatch confirmed=new CountDownLatch(1);AtomicReference<String> confirmation=new AtomicReference<>();
            runOnMainSync(()->{WebView web=(WebView)((ViewGroup)ui[0].findViewById(android.R.id.content)).getChildAt(0);web.evaluateJavascript("confirm('Synthetic delivery confirmation fixture')",value->{confirmation.set(value);confirmed.countDown();});});
            // The platform theme presents button labels in capitals. Locate
            // the actual dialog button without depending on that casing.
            boolean clicked=false;String visible="";
            for(int attempt=0;attempt<50&&!clicked;attempt++){
                AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();visible=windowText(root);
                if(root!=null&&visible.contains("Synthetic delivery confirmation fixture"))for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText("Confirm"))if("android.widget.Button".contentEquals(node.getClassName())&&"Confirm".equalsIgnoreCase(String.valueOf(node.getText())))clicked=node.performAction(AccessibilityNodeInfo.ACTION_CLICK)||clicked;
                if(!clicked)Thread.sleep(100);
            }
            check(clicked,"Finish delivery must show a clickable native confirmation: "+visible+"; JS result="+confirmation.get());
            check(confirmed.await(3,TimeUnit.SECONDS)&&"true".equals(confirmation.get()),"Confirm must return the rider's confirmation to JavaScript: "+confirmation.get());
            status(0,"finishConfirmationUsesAWorkingNativeDialog",11,".");
            status(1,"loginUpgradePreservesQueueOwnerAndEncryptedSession",12,"");
            Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token"));queue.add(event());
            check(!Session.loggedIn(getTargetContext()),"A legacy device token cannot count as a rider login");Session.clear(getTargetContext());
            check(Session.queueOwner(getTargetContext()).equals(device)&&queue.count()==1,"Session expiry must preserve the rider identity for unsent GPS");
            boolean different=false;try{Session.save(getTargetContext(),new JSONObject().put("deviceId",UUID.randomUUID().toString()).put("driverName","Other fixture").put("token","other-test-token").put("loggedIn",true));}catch(IllegalStateException expected){different=true;}
            check(different&&queue.count()==1,"Another account cannot take ownership of saved GPS");
            Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("username","TestRider").put("token","new-test-token").put("loggedIn",true));
            check(Session.loggedIn(getTargetContext())&&queue.count()==1,"Same-rider login must retain the queue");
            String stored=Session.prefs(getTargetContext()).getString("session","");check(!stored.contains("new-test-token")&&!stored.contains("TestRider"),"Native session must remain encrypted in Android storage");Session.clear(getTargetContext());
            status(0,"loginUpgradePreservesQueueOwnerAndEncryptedSession",12,".");
            status(1,"encryptedProofQueuePreservesReceiptAndRedactsOtp",13,"");
            queue.clearCommands();String proofReceipt=UUID.randomUUID().toString();
            JSONObject proofCommand=new JSONObject().put("operationId",proofReceipt).put("action","delivered").put("dispatchId",dispatch).put("orderId",UUID.randomUUID().toString()).put("otp","012345");queue.addCommand(device,proofCommand);queue.close();
            check(queue.command().getJSONObject("payload").getString("otp").equals("012345"),"Encrypted OTP must survive database reopen for offline retry");
            try(android.database.Cursor raw=queue.getReadableDatabase().rawQuery("SELECT payload FROM commands WHERE id=?",new String[]{proofReceipt})){check(raw.moveToFirst()&&!raw.getString(0).contains("012345")&&!raw.getString(0).contains("delivered"),"SQLite must never retain plaintext proof reports");}
            JSONObject visibleProof=queue.commands().getJSONObject(0);check(visibleProof.optBoolean("proofRequired")&&!visibleProof.getJSONObject("payload").has("otp"),"Published queue summaries must not return the OTP to JavaScript");
            queue.commandError(proofReceipt,"Rejected fixture");boolean foreignProof=false;try{queue.correctOtp(UUID.randomUUID().toString(),proofReceipt,"654321");}catch(IllegalStateException expected){foreignProof=true;}check(foreignProof,"Another rider cannot correct a saved proof");
            queue.correctOtp(device,proofReceipt,"654321");check(queue.command().getString("id").equals(proofReceipt)&&queue.command().getJSONObject("payload").getString("otp").equals("654321")&&queue.command().getString("error").isEmpty(),"Correcting OTP must keep the receipt and queue position");
            check(queue.completedLocally(dispatch),"Encrypted accepted-to-retry completion must permit local end duty");queue.clearCommands();
            status(0,"encryptedProofQueuePreservesReceiptAndRedactsOtp",13,".");
            status(1,"preUpgradeCommandsRemainReadableAndOrdered",14,"");
            String oldId=UUID.randomUUID().toString();JSONObject oldCommand=new JSONObject().put("operationId",oldId).put("action","collected").put("dispatchId",dispatch);
            android.content.ContentValues legacyRow=new android.content.ContentValues();legacyRow.put("id",oldId);legacyRow.put("device_id",device);legacyRow.put("payload",oldCommand.toString());queue.getWritableDatabase().insertOrThrow("commands",null,legacyRow);queue.addCommand(device,proofCommand);
            check(queue.command().getString("id").equals(oldId)&&queue.pending("collected",dispatch),"Pre-upgrade reports must remain first without migration or deletion");queue.commandDone(oldId);check(queue.command().getString("id").equals(proofReceipt),"Encrypted completion must follow the original collection");queue.clearCommands();
            status(0,"preUpgradeCommandsRemainReadableAndOrdered",14,".");
            status(1,"customerSnapshotEncryptedAndClearedOnLogout",15,"");
            queue.clear();Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token"));
            Session.cacheState(getTargetContext(),new JSONObject().put("customer",new JSONObject().put("phone","+254799123456")));
            check(!Session.prefs(getTargetContext()).getString("rider_state_encrypted","").contains("+254799123456")&&!Session.prefs(getTargetContext()).contains("rider_state"),"Customer snapshot must use device-key encryption");
            check(DriverApi.cached(getTargetContext()).getJSONObject("customer").getString("phone").equals("+254799123456"),"Customer snapshot must remain available offline");Session.clear(getTargetContext());check(DriverApi.cached(getTargetContext()).length()==0,"Signing out must clear encrypted customer snapshots");
            status(0,"customerSnapshotEncryptedAndClearedOnLogout",15,".");
            status(1,"nativeMerchantProofControlsAndOfflineNavigation",16,"");
            CountDownLatch merchantUi=new CountDownLatch(1);AtomicReference<String> merchantResult=new AtomicReference<>();
            runOnMainSync(()->{WebView web=(WebView)((ViewGroup)ui[0].findViewById(android.R.id.content)).getChildAt(0);web.evaluateJavascript("(function(){var previous=state;var order={id:'fixture-order',title:'Merchant parcel',network:true,requiresOtp:true,status:'assigned',customer:{name:'Fixture customer',phone:'+254712345678'}};var job={id:'fixture-dispatch',orderId:order.id,name:order.title,stops:[{id:'pickup',name:'Pickup',deliveredAt:null},{id:'delivery',name:'Customer',deliveredAt:null}]};applyState({paired:true,recording:false,canStop:false,commands:[{payload:{action:'collected',orderId:order.id,dispatchId:job.id},error:''}],data:{assignment:job,order:order,network:[{order:order,merchantName:'Fixture merchant',fleet:'shared',feeMinor:20000,customer:{name:'Fixture customer'}}],offers:[],recentOrders:[],payments:[]}});go('home');var text=document.getElementById('homecontent').textContent;openProof(active());var input=document.getElementById('deliveryotp');var result={otpControl:text.indexOf('Confirm delivery with OTP')>=0,contact:text.indexOf('Call assigned customer')>=0,cash:text.indexOf('Record customer payment')>=0,next:target().id,input:input.maxLength===6&&input.inputMode==='numeric',dialog:document.getElementById('proof').classList.contains('open'),bridge:typeof Rider.retryOtp==='function'&&typeof Rider.contactCustomer==='function'};input.value='012345';applyState({paired:false,data:{}});result.cleared=input.value==='';applyState(previous);return result;})()",value->{merchantResult.set(value);merchantUi.countDown();});});
            check(merchantUi.await(5,TimeUnit.SECONDS),"Packaged merchant controls must respond");JSONObject merchantScreen=new JSONObject(merchantResult.get());check(merchantScreen.optBoolean("otpControl")&&merchantScreen.optBoolean("contact")&&!merchantScreen.optBoolean("cash")&&merchantScreen.getString("next").equals("delivery"),"Actual packaged WebView must offer OTP, scoped contact and correct offline navigation: "+merchantScreen);check(merchantScreen.optBoolean("input")&&merchantScreen.optBoolean("dialog")&&merchantScreen.optBoolean("cleared")&&merchantScreen.optBoolean("bridge"),"OTP dialog must be usable, private on logout and backed by native controls: "+merchantScreen);
            status(0,"nativeMerchantProofControlsAndOfflineNavigation",16,".");
            runOnMainSync(()->callActivityOnPause(ui[0]));
            status(1,"realNairobiRoadGraphRoutesOnAndroid",17,"");
            java.io.File roads=new java.io.File(getTargetContext().getFilesDir(),"roads-instrumentation");check(roads.isDirectory()||roads.mkdirs(),"Test road directory must be available");
            for(String file:new String[]{"lookups.dat","car-vario.brf","trekking.brf","E35_S5.rd5"}){
                try(java.io.InputStream in=file.endsWith(".rd5")?getContext().getAssets().open("roads/"+file):getTargetContext().getAssets().open("roads/"+file);java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(roads,file))){byte[] bytes=new byte[16384];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}
            }
            JSONObject roadOrigin=new JSONObject().put("lat",-1.2864).put("lng",36.8172),roadDestination=new JSONObject().put("lat",-1.2921).put("lng",36.8256);
            check(OfflineRoads.tile(-1.2864,36.8172).equals("E35_S5.rd5")&&OfflineRoads.tile(-4.05,39.67).equals("E35_S5.rd5"),"Kenyan regional selection must use southern latitude and eastern longitude correctly");
            JSONObject road=OfflineRoads.calculate(roads,roadOrigin,roadDestination,"driving");
            check(road.getDouble("distanceMeters")>500&&road.getDouble("distanceMeters")<15000&&road.getDouble("durationSeconds")>0,"Pinned BRouter must calculate an actual reasonable road distance and duration: "+road);
            check(road.getString("geometry").length()>100&&road.getJSONArray("snappedMeters").getDouble(1)<=250,"Real road geometry must follow mapped road vertices near the recipient pin");
            status(0,"realNairobiRoadGraphRoutesOnAndroid",17,".");
            status(1,"savedRoadGraphRecalculatesWithoutNetwork",18,"");
            JSONObject repeated=OfflineRoads.calculate(roads,roadOrigin,roadDestination,"driving");check(repeated.getString("geometry").equals(road.getString("geometry"))&&repeated.getInt("distanceMeters")==road.getInt("distanceMeters"),"A cached road graph must reproduce road directions with no HTTP calls");
            JSONObject bicycle=OfflineRoads.calculate(roads,roadOrigin,roadDestination,"cycling");check(bicycle.getInt("distanceMeters")>0&&bicycle.getDouble("durationSeconds")>0&&bicycle.getString("profile").equals("cycling"),"Registered bicycles must use a functioning cycling road profile");
            status(0,"savedRoadGraphRecalculatesWithoutNetwork",18,".");
            status(1,"roadCoordinatesAreEncryptedAndClearedOnLogout",19,"");
            Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token").put("loggedIn",true));
            road.put("dispatchId","road-fixture").put("stopId","pickup");String roadCipher=Session.seal(new JSONObject().put("routes",new JSONArray().put(road)),"rider-roads:"+device);
            Session.prefs(getTargetContext()).edit().putString("rider_roads_encrypted",roadCipher).commit();check(!roadCipher.contains("36.8256")&&!roadCipher.contains(road.getString("geometry")),"Stored road geometry and recipient coordinates must be encrypted");check(RoadApi.cached(getTargetContext()).length()==1,"Saved road coordinates must remain usable offline");
            boolean foreignRoad=false;try{Session.unseal(roadCipher,"rider-roads:other-rider");}catch(Exception expected){foreignRoad=true;}check(foreignRoad,"Road cache must be bound to the rider account");Session.clear(getTargetContext());check(RoadApi.cached(getTargetContext()).length()==0,"Signing out must erase the private road cache while retaining reusable public road data");
            status(0,"roadCoordinatesAreEncryptedAndClearedOnLogout",19,".");
            status(1,"actualWebViewDrawsRoadCurveAndLegacyRecipient",20,"");
            JSONObject legacyContact=new JSONObject().put("id","road-order").put("title","Legacy road delivery").put("status","assigned").put("customer",new JSONObject().put("name","Synthetic recipient").put("phone","+254712345678"));
            JSONObject mapJob=new JSONObject().put("id","road-fixture").put("orderId","road-order").put("name","Road fixture").put("stops",new JSONArray().put(new JSONObject(roadDestination.toString()).put("id","pickup").put("name","Collect").put("deliveredAt",JSONObject.NULL)).put(new JSONObject().put("id","delivery").put("name","Drop").put("lat",-1.28).put("lng",36.82).put("deliveredAt",JSONObject.NULL)));
            JSONObject mapState=new JSONObject().put("paired",true).put("recording",false).put("point",roadOrigin).put("roadRoutes",new JSONArray().put(road)).put("commands",new JSONArray()).put("data",new JSONObject().put("assignment",mapJob).put("order",legacyContact).put("recentOrders",new JSONArray()).put("payments",new JSONArray()).put("offers",new JSONArray()));
            CountDownLatch mapUi=new CountDownLatch(1);AtomicReference<String> mapResult=new AtomicReference<>();
            runOnMainSync(()->{WebView web=(WebView)((ViewGroup)ui[0].findViewById(android.R.id.content)).getChildAt(0);web.evaluateJavascript("(function(){applyState("+mapState+");go('route');var line=document.querySelector('#mapline polyline'),summary=document.getElementById('routesummary').textContent,controls=document.getElementById('routeactions').textContent;var result={vertices:line?line.getAttribute('points').split(' ').length:0,straight:!!document.querySelector('#mapline line'),distance:summary.indexOf('km by road')>=0,time:summary.indexOf('no live traffic')>=0,contact:controls.indexOf('Call assigned customer')>=0,recipient:controls.indexOf('Synthetic recipient')>=0,otp:controls.indexOf('Confirm delivery with OTP')>=0,bridge:typeof Rider.route==='function'&&typeof Rider.cancelRoads==='function'&&typeof Rider.updateApp==='function'};applyState({paired:false,data:{}});result.cleared=document.querySelectorAll('#mapline polyline').length===0;return result;})()",value->{mapResult.set(value);mapUi.countDown();});});
            check(mapUi.await(5,TimeUnit.SECONDS),"Packaged road UI must respond");JSONObject roadScreen=new JSONObject(mapResult.get());check(roadScreen.getInt("vertices")>10&&!roadScreen.optBoolean("straight")&&roadScreen.optBoolean("distance")&&roadScreen.optBoolean("time"),"Actual Android WebView must draw the real road curve and show road distance: "+roadScreen);check(roadScreen.optBoolean("contact")&&roadScreen.optBoolean("recipient")&&!roadScreen.optBoolean("otp")&&roadScreen.optBoolean("bridge")&&roadScreen.optBoolean("cleared"),"Legacy contacts, native update controls and private logout must work: "+roadScreen);
            status(0,"actualWebViewDrawsRoadCurveAndLegacyRecipient",20,".");
            status(1,"gpsFilterRetainsWalkAndRejectsProviderJumps",21,"");
            GpsRecorder filter=new GpsRecorder();long clock=System.currentTimeMillis(),elapsed=android.os.SystemClock.elapsedRealtimeNanos();
            android.location.Location first=fix(clock,elapsed,-1.28,36.82,5,"gps");
            check(filter.eligible(first,elapsed,clock),"A precise satellite fix must start a walk");filter.accepted(first);
            android.location.Location walk=fix(clock+5000,elapsed+5000000000L,-1.27995,36.82,5,"gps");
            check(filter.eligible(walk,elapsed+5000000000L,clock+5000),"Five-metre walking movement must survive sampling");filter.accepted(walk);
            check(!filter.eligible(fix(clock+8000,elapsed+8000000000L,-1.1,36.5,5,"gps"),elapsed+8000000000L,clock+8000),"An impossible jump must not create a zigzag");
            check(!filter.eligible(fix(clock+10000,elapsed+10000000000L,-1.27,36.82,30,"network"),elapsed+10000000000L,clock+10000),"A network fix cannot replace recent satellite GPS");
            check(!filter.eligible(fix(clock+10000,elapsed+10000000000L,-1.2799,36.82,600,"gps"),elapsed+10000000000L,clock+10000),"A broad uncertainty cannot fabricate journey movement");
            check(!filter.eligible(first,elapsed+31000000000L,clock+31000),"Stale cached GPS cannot count as a new journey fix");
            status(0,"gpsFilterRetainsWalkAndRejectsProviderJumps",21,".");
            status(1,"offlineWalkSurvivesReopenAndAcknowledgement",22,"");
            queue.clear();queue.clearCommands();Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token").put("loggedIn",true));
            String offlineTrip=GpsRecorder.begin(getTargetContext());GpsRecorder walkRecorder=new GpsRecorder();clock=System.currentTimeMillis();elapsed=android.os.SystemClock.elapsedRealtimeNanos();
            for(int i=0;i<10;i++)check(walkRecorder.record(getTargetContext(),offlineTrip,fix(clock-27000+i*3000,elapsed-(27000-i*3000)*1000000L,-1.28+i*.00005,36.82,5,"gps"))!=null,"Walking fixes must save with no HTTP request");
            queue.close();JSONObject savedJourney=queue.journey(device);check(savedJourney.getInt("total")==10&&savedJourney.getInt("pending")==10&&savedJourney.getJSONArray("points").length()==10,"An offline walk must retain every measured point after SQLite reopen");
            JSONArray offlineBatch=queue.batch(),receipts=new JSONArray();for(int i=0;i<offlineBatch.length();i++)receipts.put(offlineBatch.getJSONObject(i).getString("eventId"));queue.acknowledge(offlineBatch,receipts);queue.close();
            savedJourney=queue.journey(device);check(queue.count()==0&&savedJourney.getInt("synced")==10&&savedJourney.getInt("pending")==0&&savedJourney.getJSONArray("points").length()==10,"Acknowledgement uploads the walk without erasing its local map");
            status(0,"offlineWalkSurvivesReopenAndAcknowledgement",22,".");
            status(1,"recoveryKeepsJourneyIdentityAndPrivacy",23,"");
            check(GpsRecorder.begin(getTargetContext()).equals(offlineTrip)&&queue.count()==0,"Resuming duty must reuse the saved trip without a duplicate start");
            check(queue.journey(UUID.randomUUID().toString()).getJSONArray("points").length()==0,"Another rider must never see this phone's saved journey");
            try(android.database.Cursor cursor=queue.getReadableDatabase().rawQuery("SELECT payload FROM journey_points WHERE device_id=?",new String[]{device})){while(cursor.moveToNext())check(!cursor.getString(0).contains("36.82"),"Persisted journey coordinates must be encrypted");}
            JSONObject privatePoint=new JSONObject(savedJourney.getJSONArray("points").getJSONObject(0).toString()).put("eventId",UUID.randomUUID().toString());queue.add(privatePoint);
            try(android.database.Cursor cursor=queue.getReadableDatabase().rawQuery("SELECT payload FROM events WHERE id=?",new String[]{privatePoint.getString("eventId")})){check(cursor.moveToFirst()&&!cursor.getString(0).contains("36.82"),"New upload queue payloads must also protect GPS coordinates");}
            check(queue.batch().getJSONObject(0).getString("eventId").equals(privatePoint.getString("eventId")),"Encryption must preserve the original retry identity");queue.clear();
            status(0,"recoveryKeepsJourneyIdentityAndPrivacy",23,".");
            status(1,"actualOfflineWebViewShowsJourneyWithoutDelivery",24,"");
            CountDownLatch journeyUi=new CountDownLatch(1);AtomicReference<String> journeyResult=new AtomicReference<>();
            JSONObject journeyState=new JSONObject().put("paired",true).put("recording",true).put("lastFix",clock).put("journey",savedJourney).put("commands",new JSONArray()).put("data",new JSONObject());
            runOnMainSync(()->{WebView web=(WebView)((ViewGroup)ui[0].findViewById(android.R.id.content)).getChildAt(0);web.evaluateJavascript("(function(){applyState("+journeyState+");go('route');fitJourney();var paths=[...document.querySelectorAll('[data-journey]')],text=document.getElementById('journeycontent').textContent;var result={vertices:paths.reduce((n,p)=>n+(p.getAttribute('d').match(/L/g)||[]).length,0),saved:text.indexOf('10 GPS points saved')>=0,synced:text.indexOf('10 uploaded')>=0,road:!!document.querySelector('[data-road]')};applyState({paired:false});result.private=document.querySelectorAll('[data-journey]').length===0&&journeyPoints().length===0;return result;})()",value->{journeyResult.set(value);journeyUi.countDown();});});
            check(journeyUi.await(5,TimeUnit.SECONDS),"Offline journey map must respond");JSONObject journeyScreen=new JSONObject(journeyResult.get());check(journeyScreen.getInt("vertices")==9&&journeyScreen.optBoolean("saved")&&journeyScreen.optBoolean("synced")&&!journeyScreen.optBoolean("road")&&journeyScreen.optBoolean("private"),"Actual offline UI must show the measured walk and clear it on logout: "+journeyScreen);
            status(0,"actualOfflineWebViewShowsJourneyWithoutDelivery",24,".");
            status(1,"versionTwoGpsQueueUpgradePreservesOfflineWalk",25,"");
            Session.prefs(getTargetContext()).edit().putBoolean("duty",false).remove("trip").commit();queue.clear();
            JSONObject oldPoint=new JSONObject(privatePoint.toString()).put("eventId",UUID.randomUUID().toString());android.content.ContentValues legacyGps=new android.content.ContentValues();legacyGps.put("id",oldPoint.getString("eventId"));legacyGps.put("recorded_at",oldPoint.getLong("recordedAt"));legacyGps.put("payload",oldPoint.toString());queue.getWritableDatabase().insertOrThrow("events",null,legacyGps);
            queue.getWritableDatabase().execSQL("DROP TABLE journey_points");queue.getWritableDatabase().setVersion(2);queue.close();
            check(queue.batch().getJSONObject(0).getString("eventId").equals(oldPoint.getString("eventId"))&&queue.journey(device).getInt("total")==1,"Additive v3 migration must backfill an existing offline walk without replacing its queue");
            check(!GpsRecorder.begin(getTargetContext()).equals(offlineTrip),"Privacy pause must make a later explicitly started walk a separate journey");
            status(0,"versionTwoGpsQueueUpgradePreservesOfflineWalk",25,".");
            status(1,"actualDashboardHeadingAndButtonContrast",26,"");
            String dashboardCss;try(java.io.InputStream in=getContext().getAssets().open("dashboard.css");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);dashboardCss=out.toString("UTF-8");}
            CountDownLatch contrastUi=new CountDownLatch(1);AtomicReference<String> contrastResult=new AtomicReference<>();
            String contrastScript="(function(){var host=document.createElement('div');document.body.append(host);var shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent="+JSONObject.quote(dashboardCss)+";shadow.append(style);var fixture=document.createElement('div');fixture.innerHTML='<div class=\"bwm-office network-shell\"><section class=\"network-card\"><h2>Merchant heading</h2><span class=\"network-badge\">Merchant</span><span class=\"network-badge active\">Active</span><span class=\"network-badge pending\">Pending</span><span class=\"network-badge suspended\">Suspended</span><button class=\"tracking-primary\">Create delivery</button><div class=\"network-tabs\"><button class=\"active\">Deliveries</button></div></section></div><div class=\"office-shell\"><div class=\"insight\"><strong>Planner heading</strong><p>Planner note</p></div></div><div class=\"planning-workspace\"><div class=\"guide-step\"><h3>Plan heading</h3><span>Route details</span></div></div>';shadow.append(fixture);function rgb(s){return(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);}function light(c){return c.map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);}function ratio(a,b){a=light(a);b=light(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}var ratios=[...fixture.querySelectorAll('h2,h3,.insight strong,.insight p,.guide-step span,.network-badge,.network-tabs button')].map(e=>{var style=getComputedStyle(e),bg=style.backgroundColor,parent=e;while(bg==='rgba(0, 0, 0, 0)'&&parent.parentElement){parent=parent.parentElement;bg=getComputedStyle(parent).backgroundColor;}return ratio(rgb(style.color),rgb(bg));});var button=fixture.querySelector('.tracking-primary'),buttonStyle=getComputedStyle(button);for(var color of buttonStyle.backgroundImage.match(/rgb[(][^)]*[)]/g)||[])ratios.push(ratio(rgb(buttonStyle.color),rgb(color)));var result={minimum:Math.min(...ratios),pairs:ratios.length};host.remove();return result;})()";
            runOnMainSync(()->{WebView web=(WebView)((ViewGroup)ui[0].findViewById(android.R.id.content)).getChildAt(0);web.evaluateJavascript(contrastScript,value->{contrastResult.set(value);contrastUi.countDown();});});
            check(contrastUi.await(5,TimeUnit.SECONDS),"Actual dashboard CSS contrast must respond");JSONObject contrast=new JSONObject(contrastResult.get());check(contrast.getInt("pairs")>=9&&contrast.getDouble("minimum")>=4.5,"Tinted headings, status labels and primary buttons must meet readable contrast: "+contrast);
            status(0,"actualDashboardHeadingAndButtonContrast",26,".");
            status(1,"countyRoadPacksIncludeKiambu",27,"");
            JSONArray counties=OfflineMaps.counties(getTargetContext());check(counties.length()==47,"Every Kenyan county must have an offline road pack");boolean kiambu=false;for(int k=0;k<counties.length();k++){JSONObject county=counties.getJSONObject(k);if(county.getString("name").equals("Kiambu")){kiambu=true;check(county.getJSONArray("files").toString().contains("E35_S5.rd5"),"Kiambu must use the bundled actual road graph");}}check(kiambu,"Kiambu county selection is present");
            status(0,"countyRoadPacksIncludeKiambu",27,".");status(1,"foreignUpdateRejected",28,"");
            try{UpdateApi.validate(new JSONObject().put("applicationId","foreign.app").put("certificateSha256","invalid"));throw new AssertionError("Foreign update must be refused");}catch(IllegalStateException expected){}
            status(0,"foreignUpdateRejected",28,".");
            status(1,"cloudRestoreNeverRequeuesAndKeepsRiderScope",29,"");
            int beforeRestore=queue.count();JSONObject restored=new JSONObject(oldPoint.toString()).put("eventId",UUID.randomUUID().toString());JSONArray restoreEvents=new JSONArray().put(restored).put(restored);queue.restoreJourney(device,restoreEvents);check(queue.count()==beforeRestore,"Cloud restore must never create an outgoing GPS event");check(queue.journeyFor(device,"trip",restored.getString("tripId"),new JSONObject()).getJSONArray("points").length()==2,"Original IDs deduplicate restored points");try{queue.restoreJourney("foreign-rider",restoreEvents);throw new AssertionError("Another rider cannot restore this history");}catch(IllegalStateException expected){}status(0,"cloudRestoreNeverRequeuesAndKeepsRiderScope",29,".");
            status(1,"actualOfflineVectorBasemapRendersWithoutNetwork",30,"");
            java.io.File mapDir=new java.io.File(getTargetContext().getFilesDir(),"maps-v1");mapDir.mkdirs();java.io.File fixtureMap=new java.io.File(mapDir,"kenya.map");try(java.io.InputStream in=getContext().getAssets().open("fixture.map");java.io.FileOutputStream out=new java.io.FileOutputStream(fixtureMap)){byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}
            org.mapsforge.map.reader.MapFile testMap=new org.mapsforge.map.reader.MapFile(fixtureMap);org.mapsforge.core.model.BoundingBox box=testMap.boundingBox();double mapLat=(box.minLatitude+box.maxLatitude)/2,mapLng=(box.minLongitude+box.maxLongitude)/2;testMap.close();int mapZ=14;long tx=(long)Math.floor((mapLng+180)/360*(1<<mapZ)),ty=(long)Math.floor((1-Math.log(Math.tan(Math.toRadians(mapLat))+1/Math.cos(Math.toRadians(mapLat)))/Math.PI)/2*(1<<mapZ));android.webkit.WebResourceResponse vectorTile=OfflineMaps.tile(getTargetContext(),"https://tile.openstreetmap.org/"+mapZ+"/"+tx+"/"+ty+".png");check(vectorTile!=null,"Mapsforge must return an offline PNG from a real map file");android.graphics.Bitmap tileBitmap=android.graphics.BitmapFactory.decodeStream(vectorTile.getData());check(tileBitmap!=null&&tileBitmap.getWidth()==256&&tileBitmap.getHeight()==256,"Offline basemap renders actual 256px tiles");tileBitmap.recycle();fixtureMap.delete();status(0,"actualOfflineVectorBasemapRendersWithoutNetwork",30,".");

            Bundle result = new Bundle(); result.putString("stream", "\nOK (26 tests)\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            android.util.Log.e("RouteForgeTests",activeTest,error);
            Bundle failure=new Bundle();failure.putString("class",getClass().getName());failure.putString("test",activeTest);failure.putInt("numtests",26);failure.putInt("current",activeNumber);failure.putString("stack",android.util.Log.getStackTraceString(error));failure.putString("stream",error.toString());sendStatus(-2,failure);
            Bundle result = new Bundle(); result.putString("stream", "Queue test failed: " + error);
            finish(Activity.RESULT_CANCELED, result);
        } finally { if(ui[0]!=null)runOnMainSync(ui[0]::finish);queue.clear();queue.clearCommands();Session.clear(getTargetContext());Session.prefs(getTargetContext()).edit().remove("pending_unlink").commit(); }
    }
}
