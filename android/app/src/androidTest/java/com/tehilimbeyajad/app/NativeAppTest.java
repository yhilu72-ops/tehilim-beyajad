package com.tehilimbeyajad.app;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NativeAppTest {
    private String evaluate(ActivityScenario<MainActivity> activity, String js) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        activity.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(js, value -> {
            result.set(value); done.countDown();
        }));
        assertTrue("JavaScript callback timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void awaitTrue(ActivityScenario<MainActivity> activity, String js) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate(activity, js))) return;
            Thread.sleep(250);
        }
        fail("Native app condition failed: " + js);
    }
    @Test public void installedAppReadsBundledPsalmsAndSchedulesNotifications() throws Exception {
        assertEquals("com.tehilimbeyajad.app", InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(activity, "!!window.TBJReminders && !!window.capacitorLocalNotifications && !!document.getElementById('v83Chapters')");
            assertEquals("true", evaluate(activity, "Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android' && Capacitor.isPluginAvailable('LocalNotifications') && Capacitor.isPluginAvailable('App') && Capacitor.isPluginAvailable('Share')"));
            evaluate(activity, "window.nativeTextCheck=false;fetch('tehilim.json').then(r=>r.json()).then(d=>{window.nativeTextCheck=Object.keys(d.chapters).length===150&&d.total_verses===2527;})");
            awaitTrue(activity, "window.nativeTextCheck===true");
            evaluate(activity, "window.nativeNotificationCheck=false;TBJReminders.enable(capacitorLocalNotifications.LocalNotifications,['08:00','22:30']).then(n=>{window.nativeNotificationCheck=n===10;}).catch(e=>{window.nativeNotificationError=e.message;})");
            awaitTrue(activity, "window.nativeNotificationCheck===true");
            evaluate(activity, "window.nativeCancelCheck=false;TBJReminders.disable(capacitorLocalNotifications.LocalNotifications).then(()=>capacitorLocalNotifications.LocalNotifications.getPending()).then(r=>{window.nativeCancelCheck=r.notifications.filter(n=>n.id>=73100&&n.id<=73121).length===0;})");
            awaitTrue(activity, "window.nativeCancelCheck===true");
        }
    }
}
