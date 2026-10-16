from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parents[1]
a=root/'android'
p=a/'settings.gradle.kts'
s=p.read_text();s=re.sub(r'id\("com.android.application"\) version "[^"]+"', 'id("com.android.application") version "8.9.2"',s);p.write_text(s)
p=a/'gradle/wrapper/gradle-wrapper.properties';p.write_text(re.sub(r'gradle-[0-9.]+-(all|bin).zip','gradle-8.11.1-all.zip',p.read_text()))
p=a/'app/build.gradle.kts';s=p.read_text().replace('compileSdk = flutter.compileSdkVersion','compileSdk = 36').replace('ndkVersion = flutter.ndkVersion','ndkVersion = "27.0.12077973"').replace('minSdk = flutter.minSdkVersion','minSdk = 26').replace('targetSdk = flutter.targetSdkVersion','targetSdk = 35').replace('signingConfig = signingConfigs.getByName("debug")','signingConfig = null');p.write_text(s)
p=a/'app/src/main/AndroidManifest.xml';s=p.read_text().replace('<application','<uses-permission android:name="android.permission.INTERNET"/>\n    <uses-permission android:name="android.permission.CAMERA"/>\n    <uses-permission android:name="android.permission.RECORD_AUDIO"/>\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>\n    <uses-feature android:name="android.hardware.camera" android:required="false"/>\n    <application',1).replace('android:label="shadowsocial"','android:label="ShadowSocial" android:allowBackup="false" android:usesCleartextTraffic="false"');p.write_text(s)
p=a/'app/src/debug/AndroidManifest.xml';p.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"><uses-permission android:name="android.permission.INTERNET"/><application android:usesCleartextTraffic="true" tools:replace="android:usesCleartextTraffic"/></manifest>')
old=root.parent/'android/app/src/main/res';new=a/'app/src/main/res'
for d in old.glob('mipmap-*'):
 if d.is_dir():shutil.copytree(d,new/d.name,dirs_exist_ok=True)
for folder in ['values','values-night','values-v31','values-night-v31']:
 p=new/folder/'styles.xml';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('<resources><style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar"><item name="android:windowBackground">#153D35</item><item name="android:windowLightStatusBar">false</item><item name="android:statusBarColor">#153D35</item></style><style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar"><item name="android:windowBackground">#F5F7F2</item></style></resources>')
print('Android release configured: native Flutter, API 35, no cleartext, unsigned for private signing')

for name in ["drawable/ic_shadowsocial.xml","values/colors.xml"]:
 p=new/name;p.parent.mkdir(exist_ok=True,parents=True);shutil.copy2(old/name,p)
