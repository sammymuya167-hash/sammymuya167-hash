import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
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
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Native signup, sharing, people and profile use the real API', (
    tester,
  ) async {
    final api = Api(origin: 'http://10.0.2.2:8787', vault: MemoryVault());
    await tester.pumpWidget(ShadowSocialApp(api: api));
    await tester.pump(Duration(milliseconds: 350));
    await binding.convertFlutterSurfaceToImage();
    await tester.pump();
    await binding.takeScreenshot('01-native-splash');
    await tester.pump(Duration(seconds: 2));
    await tester.pumpAndSettle();
    await binding.takeScreenshot('02-native-login');
    final signup = find.text('New around here? Create an account');
    await tester.ensureVisible(signup);
    await tester.tap(signup);
    await tester.pumpAndSettle();
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Native Tester');
    await tester.enterText(fields.at(1), 'android_native');
    await tester.enterText(
      find.byKey(Key('email-field')),
      'android-native@example.test',
    );
    await tester.enterText(
      find.byKey(Key('password-field')),
      'native-testing-password',
    );
    await tester.ensureVisible(find.byType(CheckboxListTile));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.ensureVisible(find.byKey(Key('auth-submit')));
    await tester.tap(find.byKey(Key('auth-submit')));
    for (
      int i = 0;
      i < 60 && find.text('I saved my code').evaluate().isEmpty;
      i++
    ) {
      await tester.pump(Duration(milliseconds: 500));
    }
    expect(find.text('I saved my code'), findsOneWidget);
    await tester.tap(find.text('I saved my code'));
    await tester.pumpAndSettle();
    expect(api.profile?['username'], 'android_native');
    await binding.takeScreenshot('03-native-feed');
    await tester.tap(find.text('Create').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(Key('post-caption')),
      'My first native Android moment',
    );
    await tester.tap(find.text('Publish'));
    for (
      int i = 0;
      i < 60 && find.byKey(Key('post-caption')).evaluate().isNotEmpty;
      i++
    ) {
      await tester.pump(Duration(milliseconds: 500));
    }
    await tester.pumpAndSettle();
    final published = await api.call('posts');
    expect(
      rows(
        published,
        'posts',
      ).any((post) => post['caption'] == 'My first native Android moment'),
      isTrue,
    );
    await tester.drag(find.byType(ListView).first, Offset(0, -500));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('My first native Android moment', findRichText: true),
      findsWidgets,
    );
    await tester.tap(find.text('Explore').last);
    await tester.pumpAndSettle();
    expect(find.text('CI Friend'), findsOneWidget);
    await binding.takeScreenshot('04-native-explore');
    await tester.tap(find.text('Follow').first);
    for (int i = 0; i < 60 && find.text('Following').evaluate().isEmpty; i++) {
      await tester.pump(Duration(milliseconds: 250));
    }
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsWidgets);
    await tester.tap(find.text('You').last);
    await tester.pumpAndSettle();
    expect(find.text('@android_native'), findsWidgets);
    await binding.takeScreenshot('05-native-profile');
    expect(tester.takeException(), isNull);
  });
}
