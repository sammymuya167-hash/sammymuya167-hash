import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

typedef Json = Map<String, dynamic>;

class ApiError implements Exception {
  final String message;
  final int status;
  ApiError(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

abstract class TokenVault {
  Future<String?> read();
  Future<void> write(String t);
  Future<void> clear();
}

class SecureVault implements TokenVault {
  final FlutterSecureStorage storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  @override
  Future<String?> read() => storage.read(key: 'shadowsocial.session.v1');
  @override
  Future<void> write(String t) =>
      storage.write(key: 'shadowsocial.session.v1', value: t);
  @override
  Future<void> clear() => storage.delete(key: 'shadowsocial.session.v1');
}

class Api extends ChangeNotifier {
  final String origin;
  final http.Client client;
  final TokenVault vault;
  String? token;
  Json me = {};
  bool ready = false;
  String? bootError;
  Api({
    this.origin = 'https://shadowsocial-shadownet.sammymuya167.chatgpt.site',
    http.Client? client,
    TokenVault? vault,
  }) : client = client ?? http.Client(),
       vault = vault ?? SecureVault();
  Json? get profile => me['profile'] as Json?;
  bool get staff => ['owner', 'admin', 'moderator'].contains(profile?['role']);
  Map<String, String> get headers => {
    'Accept': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
  String image(String id) => '$origin/api/media/$id';
  Future<Json> call(String path, {String method = 'GET', Json? data}) async {
    try {
      final r = await client
          .send(
            http.Request(method, Uri.parse('$origin/api/$path'))
              ..headers.addAll({
                ...headers,
                if (data != null) 'Content-Type': 'application/json',
              })
              ..body = data == null ? '' : jsonEncode(data),
          )
          .timeout(Duration(seconds: 30));
      final raw = await r.stream.bytesToString().timeout(Duration(seconds: 30));
      Json b;
      try {
        b = jsonDecode(raw) as Json;
      } catch (_) {
        throw ApiError(
          'The server could not complete this request. Try again.',
          r.statusCode,
        );
      }
      if (r.statusCode >= 400) {
        if (r.statusCode == 401 && !path.startsWith('auth/')) {
          token = null;
          me = {};
          await vault.clear();
          notifyListeners();
        }
        throw ApiError(
          b['error']?.toString() ?? 'Request failed.',
          r.statusCode,
        );
      }
      return b;
    } on ApiError {
      rethrow;
    } on TimeoutException {
      throw ApiError('Connection timed out. Please try again.');
    } catch (_) {
      throw ApiError('Could not connect. Check your internet connection.');
    }
  }

  Future<void> boot() async {
    try {
      token = await vault.read();
      if (token != null) me = await call('me');
      bootError = null;
    } catch (e) {
      if (e is ApiError && e.status == 401) {
        token = null;
        me = {};
        await vault.clear();
      } else {
        bootError = e.toString();
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<String?> auth(String mode, Json b) async {
    final r = await call('auth/$mode', method: 'POST', data: b);
    token = r['token'] as String?;
    if (token == null) throw ApiError('No session was returned.');
    await vault.write(token!);
    me = await call('me');
    notifyListeners();
    return r['recoveryCode'] as String?;
  }

  Future<void> refresh() async {
    me = await call('me');
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await call('auth/logout', method: 'POST', data: {});
    } finally {
      token = null;
      me = {};
      await vault.clear();
      notifyListeners();
    }
  }

  Future<String> upload(Uint8List bytes) async {
    if (bytes.length > 6 * 1024 * 1024)
      throw ApiError('Choose a photo smaller than 6 MB.');
    try {
      final r = await client
          .post(
            Uri.parse('$origin/api/upload'),
            headers: {...headers, 'Content-Type': 'application/octet-stream'},
            body: bytes,
          )
          .timeout(Duration(seconds: 60));
      final b = jsonDecode(r.body) as Json;
      if (r.statusCode >= 400)
        throw ApiError(b['error'] ?? 'Upload failed.', r.statusCode);
      return b['id'] as String;
    } on ApiError {
      rethrow;
    } catch (_) {
      throw ApiError('The photo could not be uploaded. Try again.');
    }
  }

  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}

List<Json> rows(Json data, String key) =>
    (data[key] as List? ?? [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
