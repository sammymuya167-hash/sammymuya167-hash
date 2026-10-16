import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';
import 'social.dart';
import 'updates.dart';

const ink = Color(0xff153d35),
    mint = Color(0xffd6f47c),
    paper = Color(0xfff5f7f2);
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: paper,
    ),
  );
  runApp(ShadowSocialApp());
}

class ShadowSocialApp extends StatefulWidget {
  final Api? api;
  final Duration splashDuration;
  const ShadowSocialApp({
    super.key,
    this.api,
    this.splashDuration = const Duration(milliseconds: 1500),
  });
  @override
  State<ShadowSocialApp> createState() => _ShadowSocialAppState();
}

class _ShadowSocialAppState extends State<ShadowSocialApp> {
  late final Api api;
  final appNavigator = GlobalKey<NavigatorState>();
  bool splash = true;
  @override
  void initState() {
    super.initState();
    api = widget.api ?? Api();
    Future.wait([api.boot(), Future<void>.delayed(widget.splashDuration)]).then(
      (_) {
        if (mounted) setState(() => splash = false);
      },
    );
  }

  @override
  void dispose() {
    api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    navigatorKey: appNavigator,
    debugShowCheckedModeBanner: false,
    title: 'ShadowSocial',
    theme: ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: paper,
      colorScheme: ColorScheme.fromSeed(
        seedColor: ink,
        primary: ink,
        secondary: mint,
        surface: Colors.white,
      ),
      fontFamily: 'sans-serif',
      appBarTheme: AppBarTheme(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Color(0xffdde5dc)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Color(0xffdde5dc)),
        ),
        contentPadding: EdgeInsets.all(18),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: Size(48, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
    ),
    builder:
        (context, child) =>
            UpdateHost(api: api, navigatorKey: appNavigator, child: child!),
    home: AnimatedBuilder(
      animation: api,
      builder:
          (context, _) =>
              splash
                  ? SplashScreen()
                  : api.bootError != null
                  ? Scaffold(
                    body: Center(
                      child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            BrandMark(),
                            SizedBox(height: 24),
                            Text(api.bootError!, textAlign: TextAlign.center),
                            SizedBox(height: 20),
                            FilledButton(
                              onPressed: () => api.boot(),
                              child: Text('Try again'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  : api.profile == null
                  ? AuthScreen(api: api)
                  : api.profile!['status'] != 'active'
                  ? RestrictedScreen(api: api)
                  : SocialHome(api: api),
    ),
  );
}

class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, this.size = 64});
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: mint,
      borderRadius: BorderRadius.circular(size * .3),
    ),
    child: Icon(Icons.bubble_chart_rounded, color: ink, size: size * .65),
  );
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController c;
  @override
  void initState() {
    super.initState();
    c = AnimationController(vsync: this, duration: Duration(milliseconds: 1200))
      ..forward();
  }

  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ink,
    body: AnimatedBuilder(
      animation: c,
      builder:
          (context, _) => Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(painter: OrbitPainter(c.value)),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Transform.rotate(
                      angle: (1 - Curves.easeOutBack.transform(c.value)) * -.8,
                      child: Transform.scale(
                        scale: .4 + .6 * Curves.easeOutBack.transform(c.value),
                        child: BrandMark(size: 100),
                      ),
                    ),
                    SizedBox(height: 28),
                    Opacity(
                      opacity: c.value,
                      child: Column(
                        children: [
                          Text(
                            'ShadowSocial',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1,
                            ),
                          ),
                          SizedBox(height: 10),
                          Text(
                            'YOUR PEOPLE. YOUR WORLD.',
                            style: TextStyle(
                              color: mint,
                              fontSize: 11,
                              letterSpacing: 3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                bottom: 55,
                left: 0,
                right: 0,
                child: Column(
                  children: [
                    SizedBox(
                      width: 92,
                      child: LinearProgressIndicator(
                        value: c.value,
                        color: mint,
                        backgroundColor: Colors.white12,
                        minHeight: 3,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    SizedBox(height: 22),
                    Text(
                      'SHADOWNET',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 10,
                        letterSpacing: 4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
    ),
  );
}

class OrbitPainter extends CustomPainter {
  final double progress;
  OrbitPainter(this.progress);
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * .45);
    final p =
        Paint()
          ..color = Colors.white.withValues(alpha: .07)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1;
    for (var i = 1; i <= 4; i++) {
      canvas.drawCircle(center, 95.0 + i * 58 + progress * 12, p);
    }
    for (var i = 0; i < 6; i++) {
      final a = i * math.pi / 3 + progress * .5;
      canvas.drawCircle(
        center + Offset(math.cos(a) * 210, math.sin(a) * 210),
        i % 2 == 0 ? 6 : 3,
        Paint()..color = mint.withValues(alpha: .3),
      );
    }
  }

  @override
  bool shouldRepaint(OrbitPainter old) => old.progress != progress;
}

void notice(BuildContext context, Object text) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(text.toString()),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

Future<void> recoveryDialog(
  BuildContext context,
  String code,
) => showDialog<void>(
  context: context,
  barrierDismissible: false,
  builder:
      (ctx) => AlertDialog(
        title: Text('Save your recovery code'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Keep this private. It lets you reset your password without email. A new code replaces it after each reset.',
              ),
              SizedBox(height: 20),
              SelectableText(
                code,
                style: TextStyle(fontFamily: 'monospace', fontSize: 14),
              ),
              SizedBox(height: 12),
              TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: code));
                  notice(ctx, 'Recovery code copied.');
                },
                icon: Icon(Icons.copy_rounded),
                label: Text('Copy code'),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('I saved my code'),
          ),
        ],
      ),
);

class AuthScreen extends StatefulWidget {
  final Api api;
  const AuthScreen({super.key, required this.api});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController(),
      username = TextEditingController(),
      code = TextEditingController();
  String mode = 'login', rules = '';
  bool busy = false, accepted = false, obscure = true;
  String? error;
  @override
  void initState() {
    super.initState();
    widget.api
        .call('me')
        .then((b) {
          if (mounted) setState(() => rules = b['config']?['rules'] ?? '');
        })
        .catchError((_) {});
  }

  @override
  void dispose() {
    for (final c in [email, password, name, username, code]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (mode == 'signup' && !accepted) {
      setState(
        () =>
            error =
                'Accept the community rules and confirm you are at least 16.',
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final recovery = await widget.api.auth(mode, {
        'email': email.text.trim(),
        'password': password.text,
        'name': name.text.trim(),
        'username': username.text.trim(),
        'recoveryCode': code.text.trim(),
        'acceptRules': accepted,
        'ageConfirmed': accepted,
      });
      if (recovery != null && mounted) await recoveryDialog(context, recovery);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void change(String m) {
    setState(() {
      mode = m;
      error = null;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(25, 24, 25, 30),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: MediaQuery.sizeOf(context).height - 100,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  BrandMark(size: 43),
                  SizedBox(width: 12),
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'ShadowSocial',
                        style: TextStyle(
                          color: ink,
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -.8,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 8),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: mint,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'by SHADOWNET',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 28),
              Container(
                height: 185,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Stack(
                  clipBehavior: Clip.hardEdge,
                  children: [
                    Positioned(
                      right: -30,
                      top: -70,
                      child: Container(
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white12, width: 38),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 20,
                      bottom: 24,
                      child: Transform.rotate(
                        angle: -.15,
                        child: Container(
                          padding: EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: mint,
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Icon(
                            Icons.favorite_rounded,
                            size: 43,
                            color: ink,
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.all(25),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'A LITTLE CLOSER.',
                              style: TextStyle(
                                color: mint,
                                fontSize: 10,
                                letterSpacing: 2,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 13),
                            Text(
                              'Your people.\nYour world.',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 29,
                                height: 1.08,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -1,
                              ),
                            ),
                            SizedBox(height: 12),
                            Text(
                              'Share moments. Make connections.',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 28),
              Text(
                mode == 'signup'
                    ? 'Make yourself at home.'
                    : mode == 'recover'
                    ? 'Find your way back.'
                    : 'Good to see you.',
                style: TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w800,
                  color: ink,
                  letterSpacing: -.8,
                ),
              ),
              SizedBox(height: 7),
              Text(
                mode == 'signup'
                    ? 'Create an account and start your own story.'
                    : mode == 'recover'
                    ? 'Reset with your private recovery code.'
                    : 'Sign in to catch up with your world.',
                style: TextStyle(color: Colors.black54),
              ),
              SizedBox(height: 23),
              Form(
                key: form,
                child: Column(
                  children: [
                    if (mode == 'signup') ...[
                      TextFormField(
                        controller: name,
                        decoration: InputDecoration(
                          labelText: 'Display name',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator:
                            (v) =>
                                v == null || v.trim().isEmpty
                                    ? 'Enter your name.'
                                    : null,
                      ),
                      SizedBox(height: 13),
                      TextFormField(
                        controller: username,
                        decoration: InputDecoration(
                          labelText: 'Username',
                          prefixIcon: Icon(Icons.alternate_email),
                        ),
                        validator:
                            (v) =>
                                RegExp(r'^[a-z0-9_]{3,24}$').hasMatch(v ?? '')
                                    ? null
                                    : 'Use 3–24 lowercase letters, numbers or underscores.',
                      ),
                      SizedBox(height: 13),
                    ],
                    TextFormField(
                      key: Key('email-field'),
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: [AutofillHints.username],
                      decoration: InputDecoration(
                        labelText:
                            mode == 'login'
                                ? 'Email or username'
                                : 'Email address',
                        prefixIcon: Icon(Icons.mail_outline_rounded),
                      ),
                      validator:
                          (v) =>
                              v == null || v.trim().isEmpty
                                  ? 'Enter your email or username.'
                                  : null,
                    ),
                    SizedBox(height: 13),
                    if (mode == 'recover') ...[
                      TextFormField(
                        controller: code,
                        decoration: InputDecoration(
                          labelText: 'Recovery code',
                          prefixIcon: Icon(Icons.key_rounded),
                        ),
                        validator:
                            (v) =>
                                (v?.trim().length ?? 0) == 64
                                    ? null
                                    : 'Enter your saved recovery code.',
                      ),
                      SizedBox(height: 13),
                    ],
                    TextFormField(
                      key: Key('password-field'),
                      controller: password,
                      obscureText: obscure,
                      autofillHints: [
                        mode == 'signup'
                            ? AutofillHints.newPassword
                            : AutofillHints.password,
                      ],
                      decoration: InputDecoration(
                        labelText:
                            mode == 'recover' ? 'New password' : 'Password',
                        prefixIcon: Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => obscure = !obscure),
                          icon: Icon(
                            obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator:
                          (v) =>
                              (v?.length ?? 0) >= 12
                                  ? null
                                  : 'Use at least 12 characters.',
                    ),
                    SizedBox(height: 8),
                    if (mode == 'signup')
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: accepted,
                        onChanged:
                            busy
                                ? null
                                : (v) => setState(() => accepted = v ?? false),
                        title: Text(
                          'I am at least 16 and accept the community rules.',
                          style: TextStyle(fontSize: 12),
                        ),
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                    if (mode == 'signup')
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed:
                              () => showDialog<void>(
                                context: context,
                                builder:
                                    (ctx) => AlertDialog(
                                      title: Text('Community rules'),
                                      content: SingleChildScrollView(
                                        child: Text(
                                          rules.isEmpty
                                              ? 'Be kind. Respect privacy. Share content you own. No abuse, scams or illegal content.'
                                              : rules,
                                        ),
                                      ),
                                      actions: [
                                        TextButton(
                                          onPressed: () => Navigator.pop(ctx),
                                          child: Text('Close'),
                                        ),
                                      ],
                                    ),
                              ),
                          child: Text('Read our community rules'),
                        ),
                      ),
                    if (mode == 'login')
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: busy ? null : () => change('recover'),
                          child: Text('Forgot password?'),
                        ),
                      ),
                    if (error != null)
                      Padding(
                        padding: EdgeInsets.only(bottom: 14),
                        child: Text(
                          error!,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        key: Key('auth-submit'),
                        onPressed: busy ? null : submit,
                        child:
                            busy
                                ? SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                                : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        mode == 'signup'
                                            ? 'Create account'
                                            : mode == 'recover'
                                            ? 'Reset password'
                                            : 'Sign in',
                                      ),
                                    ),
                                    SizedBox(width: 10),
                                    Icon(Icons.arrow_forward_rounded, size: 18),
                                  ],
                                ),
                      ),
                    ),
                    SizedBox(height: 13),
                    TextButton(
                      onPressed:
                          busy
                              ? null
                              : () =>
                                  change(mode == 'signup' ? 'login' : 'signup'),
                      child: Text(
                        mode == 'signup'
                            ? 'Already part of the community? Sign in'
                            : 'New around here? Create an account',
                      ),
                    ),
                    if (mode == 'recover')
                      TextButton(
                        onPressed: busy ? null : () => change('login'),
                        child: Text('Back to sign in'),
                      ),
                  ],
                ),
              ),
              SizedBox(height: 20),
              Center(
                child: Text(
                  'A community with you at the heart.',
                  style: TextStyle(fontSize: 11, color: Colors.black38),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class RestrictedScreen extends StatefulWidget {
  final Api api;
  const RestrictedScreen({super.key, required this.api});
  @override
  State<RestrictedScreen> createState() => _RestrictedScreenState();
}

class _RestrictedScreenState extends State<RestrictedScreen> {
  final message = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Account review'),
      actions: [
        IconButton(
          onPressed: () => widget.api.logout(),
          icon: Icon(Icons.logout),
        ),
      ],
    ),
    body: ListView(
      padding: EdgeInsets.all(25),
      children: [
        Icon(Icons.shield_outlined, size: 70, color: ink),
        SizedBox(height: 22),
        Text(
          'Your account is ${widget.api.profile?['status']}.',
          style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold),
        ),
        SizedBox(height: 14),
        Text(
          widget.api.profile?['reason'] ?? 'Please review the community rules.',
        ),
        SizedBox(height: 25),
        TextField(
          controller: message,
          maxLines: 5,
          decoration: InputDecoration(
            labelText: 'Tell the team why you would like a review',
          ),
        ),
        SizedBox(height: 18),
        FilledButton(
          onPressed:
              busy
                  ? null
                  : () async {
                    setState(() => busy = true);
                    try {
                      await widget.api.call(
                        'appeals',
                        method: 'POST',
                        data: {'body': message.text},
                      );
                      if (mounted)
                        notice(context, 'Your appeal was sent to the team.');
                    } catch (e) {
                      if (mounted) notice(context, e);
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
          child: Text('Request a review'),
        ),
        TextButton(
          onPressed:
              () => widget.api.refresh().catchError((e) {
                notice(context, e);
              }),
          child: Text('Check account status'),
        ),
      ],
    ),
  );
}
