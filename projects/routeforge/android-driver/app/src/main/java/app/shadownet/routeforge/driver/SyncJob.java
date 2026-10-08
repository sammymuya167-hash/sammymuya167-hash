package app.shadownet.routeforge.driver;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
final public class SyncJob extends JobService {
 static void schedule(Context c){JobScheduler jobs=c.getSystemService(JobScheduler.class);ComponentName component=new ComponentName(c,SyncJob.class);
  jobs.schedule(new JobInfo.Builder(2001,component).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15*60*1000).build());retry(c);}
 static void retry(Context c){c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(2002,new ComponentName(c,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(1000).setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build());}
 private volatile boolean cancelled;
 public boolean onStartJob(JobParameters params){cancelled=false;new Thread(()->{boolean done=Api.sync(getApplicationContext());if(!cancelled)jobFinished(params,!done&&Session.get(this)!=null);},"routeforge-sync").start();return true;}
 public boolean onStopJob(JobParameters params){cancelled=true;return true;}
}
