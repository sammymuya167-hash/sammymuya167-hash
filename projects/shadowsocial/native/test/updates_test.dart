import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shadowsocial/api.dart';
import 'package:shadowsocial/updates.dart';
import 'widget_test.dart' show MemoryVault;

Json release({
  int code = 6,
  String path = '/api/android/v0.5.0',
  String abi = 'arm64-v8a',
}) => {
  'version': 'v0.5.0',
  'versionCode': code,
  'downloadPath': path,
  'sha256': 'a' * 64,
  'bytes': 31000000,
  'minSdk': 26,
  'supportedAbis': [abi],
};
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(updateChannel, (call) async {
          if (call.method == 'info')
            return {
              'version': '0.4.0',
              'versionCode': 5,
              'sdk': 35,
              'abis': ['arm64-v8a'],
            };
          if (call.method == 'download')
            throw PlatformException(
              code: 'checksum',
              message: 'The update checksum did not match.',
            );
          return 'installer';
        });
  });
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(updateChannel, null),
  );
  test('Release parser rejects external URLs and invalid checksums', () {
    expect(
      AppRelease.parse(release(path: 'https://evil.test/app.apk')),
      isNull,
    );
    expect(AppRelease.parse({...release(), 'sha256': 'wrong'}), isNull);
    expect(AppRelease.parse({...release(), 'bytes': 104857601}), isNull);
    expect(AppRelease.parse(release()), isNotNull);
  });
  test('Office policy controls notices without downgrading clients', () async {
    Json data = {
      'enabled': true,
      'critical': false,
      'release': release(),
      'notes': 'A new release',
    };
    final api = Api(
      vault: MemoryVault(),
      client: MockClient((_) async => http.Response(jsonEncode(data), 200)),
    );
    final c = UpdateController(api);
    await c.check(manual: true);
    expect(c.showNotice, true);
    c.dismiss();
    expect(c.showNotice, false);
    data['critical'] = true;
    await c.check(manual: true);
    expect(c.showNotice, true);
    data['release'] = release(code: 4);
    await c.check(manual: true);
    expect(c.release, isNull);
    data['release'] = release(abi: 'x86_64');
    await c.check(manual: true);
    expect(c.supported, false);
    expect(c.showNotice, false);
    data['enabled'] = false;
    await c.check(manual: true);
    expect(c.release, isNull);
    c.dispose();
    api.dispose();
  });
  testWidgets('Failed verification cannot expose an install button', (
    tester,
  ) async {
    final api = Api(
      vault: MemoryVault(),
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'enabled': true,
            'release': release(),
            'notes': 'Safer updates',
          }),
          200,
        ),
      ),
    );
    final c = UpdateController(api);
    await c.check(manual: true);
    await tester.pumpWidget(MaterialApp(home: UpdatesScreen(controller: c)));
    expect(find.text('Download update'), findsOneWidget);
    await tester.tap(find.text('Download update'));
    await tester.pumpAndSettle();
    expect(c.error, 'The update checksum did not match.');
    await tester.scrollUntilVisible(
      find.text('The update checksum did not match.'),
      200,
    );
    expect(find.text('The update checksum did not match.'), findsOneWidget);
    expect(find.text('Install update'), findsNothing);
    await tester.pumpWidget(SizedBox());
    c.dispose();
    api.dispose();
  });
  testWidgets('Update notice opens the native update screen', (tester) async {
    final api = Api(
      vault: MemoryVault(),
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({'enabled': true, 'release': release()}),
          200,
        ),
      ),
    );
    final key = GlobalKey<NavigatorState>();
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: key,
        builder:
            (context, child) =>
                UpdateHost(api: api, navigatorKey: key, child: child!),
        home: Scaffold(body: Text('Community')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Update available · v0.5.0'), findsOneWidget);
    await tester.tap(find.text('View'));
    await tester.pumpAndSettle();
    expect(find.text('App updates'), findsOneWidget);
    expect(find.text('Download update'), findsOneWidget);
    await tester.pumpWidget(SizedBox());
    api.dispose();
  });
}
