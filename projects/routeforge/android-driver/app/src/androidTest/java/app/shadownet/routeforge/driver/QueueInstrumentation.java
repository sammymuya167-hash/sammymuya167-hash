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
        b.putString("test", name); b.putInt("numtests", 11); b.putInt("current", number);
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
            web.evaluateJavascript("(function(){if(typeof applyState!=='function'||typeof go!=='function'||typeof Rider==='undefined')return {ready:false};go('trips');var text=document.getElementById('tripcontent').textContent;go('account');return {ready:true,paired:!!state.paired,bridge:typeof Rider.action==='function'&&typeof Rider.settings==='function',credentials:typeof Rider.token!=='undefined'||typeof Rider.session!=='undefined',totals:text.indexOf('REPORTED COLLECTIONS')>=0&&text.indexOf('VERIFIED BY OFFICE')>=0,pairing:document.getElementById('paircard').style.display!=='none',pages:['home','offers','route','trips','account'].every(function(id){return !!document.getElementById(id);})};})()", result -> { value.set(result); done.countDown(); });
        });
        check(done.await(5, TimeUnit.SECONDS), "Packaged UI evaluation must respond");
        return new JSONObject(value.get());
    }
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
            Session.save(getTargetContext(),new JSONObject().put("deviceId",device).put("driverName","Synthetic rider").put("token","test-only-token"));
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
            check(screen.optBoolean("pairing") && !screen.optBoolean("paired") && !TrackingService.running, "Opening an unpaired phone must show pairing without starting GPS");
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
            Bundle result = new Bundle(); result.putString("stream", "\nOK (11 tests)\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            android.util.Log.e("RouteForgeTests",activeTest,error);
            Bundle failure=new Bundle();failure.putString("class",getClass().getName());failure.putString("test",activeTest);failure.putInt("numtests",11);failure.putInt("current",activeNumber);failure.putString("stack",android.util.Log.getStackTraceString(error));failure.putString("stream",error.toString());sendStatus(-2,failure);
            Bundle result = new Bundle(); result.putString("stream", "Queue test failed: " + error);
            finish(Activity.RESULT_CANCELED, result);
        } finally { if(ui[0]!=null)runOnMainSync(ui[0]::finish);queue.clear();queue.clearCommands();Session.clear(getTargetContext());Session.prefs(getTargetContext()).edit().remove("pending_unlink").commit(); }
    }
}
