import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shadowsocial/api.dart';
import 'package:shadowsocial/main.dart';

class MemoryVault implements TokenVault {
  String? token;
  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String t) async {
    token = t;
  }

  @override
  Future<void> clear() async {
    token = null;
  }
}

void main() {
  testWidgets('Native splash leads to own login and signup forms', (
    tester,
  ) async {
    tester.view.physicalSize = Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = Api(
      vault: MemoryVault(),
      client: MockClient(
        (r) async => http.Response(
          jsonEncode({
            'profile': null,
            'config': {'rules': 'Be kind. Share content you own.'},
          }),
          200,
        ),
      ),
    );
    await tester.pumpWidget(
      ShadowSocialApp(api: api, splashDuration: Duration(milliseconds: 1200)),
    );
    expect(find.byType(SplashScreen), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.byKey(Key('email-field')), findsOneWidget);
    expect(find.byKey(Key('password-field')), findsOneWidget);
    expect(find.text('Good to see you.'), findsOneWidget);
    await tester.ensureVisible(find.text('New around here? Create an account'));
    await tester.tap(find.text('New around here? Create an account'));
    await tester.pumpAndSettle();
    expect(find.text('Display name'), findsOneWidget);
    expect(find.text('Username'), findsOneWidget);
    expect(find.byType(CheckboxListTile), findsOneWidget);
      expect(tester.takeException(), isNull);
  });
  test(
    'Secure session token is sent as bearer and never placed in URLs',
    () async {
      final vault = MemoryVault();
      final seen = <http.Request>[];
      final api = Api(
        vault: vault,
        client: MockClient((r) async {
          seen.add(r);
          return http.Response('{}', 200);
        }),
      );
      api.token = 'a' * 64;
      await api.call('posts');
      expect(seen.single.headers['Authorization'], 'Bearer ${'a' * 64}');
      expect(seen.single.url.query, isEmpty);
      api.dispose();
    },
  );
  test('Server rejection clears revoked session', () async {
    final vault = MemoryVault()..token = 'a' * 64;
    final api = Api(
      vault: vault,
      client: MockClient(
        (r) async => http.Response('{"error":"Session expired"}', 401),
      ),
    );
    await api.boot();
    expect(api.token, isNull);
    expect(vault.token, isNull);
    expect(api.profile, isNull);
    api.dispose();
  });
}
