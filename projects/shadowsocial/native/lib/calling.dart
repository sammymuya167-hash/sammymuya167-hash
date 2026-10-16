import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'api.dart';
import 'main.dart';
import 'social.dart';

bool rtcScreenOpen = false;

Future<void> openCall(
  BuildContext context,
  Api api,
  Json peer,
  String kind,
) async {
  if (rtcScreenOpen) return;
  rtcScreenOpen = true;
  try {
    final b = await api.call(
      'rtc/rooms',
      method: 'POST',
      data: {'kind': kind, 'guest': peer['id']},
    );
    if (context.mounted)
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder:
              (_) => CallScreen(
                api: api,
                room: b['room'] as Json,
                label: peer['name'].toString(),
              ),
        ),
      );
  } catch (e) {
    if (context.mounted) notice(context, e);
  } finally {
    rtcScreenOpen = false;
  }
}

Future<void> checkIncoming(BuildContext context, Api api) async {
  if (rtcScreenOpen || api.profile == null) return;
  try {
    final b = await api.call('rtc');
    final incoming = rows(b, 'incoming');
    if (incoming.isEmpty || rtcScreenOpen || !context.mounted) return;
    rtcScreenOpen = true;
    try {
      await Navigator.push<void>(
        context,
        MaterialPageRoute(
          builder:
              (_) => CallScreen(
                api: api,
                room: incoming.first,
                label: incoming.first['name'].toString(),
              ),
        ),
      );
    } finally {
      rtcScreenOpen = false;
    }
  } catch (_) {}
}

class LiveDirectory extends StatefulWidget {
  final Api api;
  const LiveDirectory({super.key, required this.api});
  @override
  State<LiveDirectory> createState() => _LiveDirectoryState();
}

class _LiveDirectoryState extends State<LiveDirectory> {
  Json data = {};
  String? error;
  bool loading = true;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(Duration(seconds: 15), (_) => load());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call('rtc');
      if (mounted)
        setState(() {
          data = b;
          error = null;
          loading = false;
        });
    } catch (e) {
      if (mounted)
        setState(() {
          error = e.toString();
          loading = false;
        });
    }
  }

  Future<void> goLive() async {
    final title = TextEditingController();
    String audience =
        widget.api.profile?['private'] == 1 ? 'followers' : 'public';
    final accepted = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => StatefulBuilder(
            builder:
                (ctx, set) => AlertDialog(
                  title: Text('Your moment. Go live.'),
                  content: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: title,
                          maxLength: 100,
                          decoration: InputDecoration(
                            labelText: 'Give your live a title',
                          ),
                        ),
                        DropdownButtonFormField<String>(
                          value: audience,
                          items: [
                            if (widget.api.profile?['private'] != 1)
                              DropdownMenuItem(
                                value: 'public',
                                child: Text('Community'),
                              ),
                            DropdownMenuItem(
                              value: 'followers',
                              child: Text('Accepted followers'),
                            ),
                          ],
                          onChanged: (v) => set(() => audience = v!),
                          decoration: InputDecoration(
                            labelText: 'Who can watch',
                          ),
                        ),
                        SizedBox(height: 16),
                        Text(
                          'Camera and microphone turn on when you start. Community rules apply. Up to 30 viewers and one hour per live. No recording is saved by ShadowSocial.',
                        ),
                      ],
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: Text('Cancel'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: Text('Start live'),
                    ),
                  ],
                ),
          ),
    );
    final name = title.text.trim();
    title.dispose();
    if (accepted != true || !mounted || rtcScreenOpen) return;
    rtcScreenOpen = true;
    try {
      final b = await widget.api.call(
        'rtc/rooms',
        method: 'POST',
        data: {
          'kind': 'live',
          'title': name.isEmpty ? 'Live with me' : name,
          'audience': audience,
        },
      );
      if (mounted)
        await Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder:
                (_) => CallScreen(
                  api: widget.api,
                  room: b['room'] as Json,
                  label: name.isEmpty ? 'Your live' : name,
                ),
          ),
        );
      await load();
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      rtcScreenOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Live & calls'),
      actions: [
        IconButton(
          onPressed: load,
          tooltip: 'Refresh',
          icon: Icon(Icons.refresh),
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed:
          data['ready'] == true &&
                  (data['config'] as Json?)?['liveEnabled'] != false
              ? goLive
              : null,
      icon: Icon(Icons.sensors_rounded),
      label: Text('Go live'),
    ),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 100),
        children: [
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: ink,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.sensors_rounded, color: mint, size: 36),
                SizedBox(height: 16),
                Text(
                  'Be here.\nTogether.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    height: 1.05,
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  'Catch a live moment, or open a chat to call someone you follow each other with.',
                  style: TextStyle(color: Colors.white70, height: 1.5),
                ),
              ],
            ),
          ),
          SizedBox(height: 16),
          Text(
            'Incoming calls arrive while ShadowSocial is open. Calls and lives end when you leave the app.',
            style: TextStyle(color: Colors.black54, fontSize: 12),
          ),
          if (error != null)
            Padding(padding: EdgeInsets.all(16), child: Text(error!)),
          if (loading) Center(child: CircularProgressIndicator()),
          SizedBox(height: 24),
          Text(
            'LIVE NOW',
            style: TextStyle(
              letterSpacing: 2,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
          SizedBox(height: 12),
          if (!loading && rows(data, 'lives').isEmpty)
            EmptyCard(
              icon: Icons.sensors_rounded,
              title: 'A moment is waiting.',
              body: 'Be the first to go live with your community.',
            ),
          ...rows(data, 'lives').map(
            (r) => Card(
              child: ListTile(
                contentPadding: EdgeInsets.all(16),
                leading: Avatar(api: widget.api, person: r),
                title: Text(
                  r['title'].toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text('@${r['username']} · ${r['viewers']} watching'),
                trailing: Chip(
                  label: Text(
                    'LIVE',
                    style: TextStyle(color: Colors.white, fontSize: 10),
                  ),
                  backgroundColor: Colors.redAccent,
                ),
                onTap: () async {
                  if (rtcScreenOpen) return;
                  rtcScreenOpen = true;
                  try {
                    await Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder:
                            (_) => CallScreen(
                              api: widget.api,
                              room: r,
                              label: r['title'].toString(),
                            ),
                      ),
                    );
                  } finally {
                    rtcScreenOpen = false;
                    load();
                  }
                },
              ),
            ),
          ),
          SizedBox(height: 24),
          Text(
            'RECENT CALLS',
            style: TextStyle(
              letterSpacing: 2,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
          ...rows(data, 'history').map(
            (r) => ListTile(
              leading: Icon(
                r['kind'] == 'voice'
                    ? Icons.call_outlined
                    : Icons.videocam_outlined,
                color: ink,
              ),
              title: Text(r['name'].toString()),
              subtitle: Text(
                '${r['kind'] == 'voice' ? 'Voice' : 'Video'} · ${r['ended_reason'].toString().isEmpty ? r['state'] : r['ended_reason']}',
              ),
              trailing: Text(age(r['created_at'])),
            ),
          ),
        ],
      ),
    ),
  );
}

class CallScreen extends StatefulWidget {
  final Api api;
  final Json room;
  final String label;
  const CallScreen({
    super.key,
    required this.api,
    required this.room,
    required this.label,
  });
  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> with WidgetsBindingObserver {
  late Json room;
  final localView = RTCVideoRenderer(), remoteView = RTCVideoRenderer();
  RTCPeerConnection? pub, sub;
  MediaStream? local, remote;
  Timer? poll, beat, ring;
  bool polling = false,
      starting = false,
      started = false,
      subscribing = false,
      ended = false,
      muted = false,
      camera = true,
      speaker = true,
      rendered = false,
      leaving = false;
  String? connection, error;
  String status = 'Getting ready…';
  int viewers = 0;
  bool get live => room['kind'] == 'live';
  bool get host => room['host'] == widget.api.profile?['id'];
  bool get video => room['kind'] != 'voice';
  bool get publisher => !live || host;
  String get path => 'rtc/rooms/${room['id']}';
  @override
  void initState() {
    super.initState();
    room = Map<String, dynamic>.from(widget.room);
    speaker = video;
    WidgetsBinding.instance.addObserver(this);
    init();
  }

  Future<void> init() async {
    try {
      await localView.initialize();
      await remoteView.initialize();
      if (!mounted) return;
      setState(() => rendered = true);
      await tick();
      poll = Timer.periodic(Duration(seconds: 2), (_) => tick());
      if (!host && !live) {
        SystemSound.play(SystemSoundType.alert);
        ring = Timer.periodic(Duration(seconds: 6), (_) {
          if (!ended && room['state'] == 'ringing')
            SystemSound.play(SystemSoundType.alert);
        });
      }
    } catch (e) {
      finish(e.toString());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      leave();
    }
  }

  Future<void> tick() async {
    if (polling || ended || leaving) return;
    polling = true;
    try {
      final b = await widget.api.call(path);
      if (!mounted || ended) return;
      setState(() {
        room = b['room'] as Json;
        viewers = (b['viewers'] as num?)?.toInt() ?? 0;
      });
      if (room['state'] == 'ended') {
        await finish(room['ended_reason'].toString());
        return;
      }
      if (room['state'] == 'ringing') {
        setState(() => status = 'Ringing…');
      }
      if (room['state'] == 'active') {
        ring?.cancel();
        if (!started && !starting) await startMedia();
        if (started &&
            (!live || !host) &&
            sub == null &&
            !subscribing &&
            rows(b, 'published').isNotEmpty)
          await receive();
      }
    } catch (e) {
      if (e is ApiError &&
          (e.status == 403 || e.status == 404 || e.status == 410))
        await finish(e.toString());
      else if (mounted)
        setState(() => error = e.toString());
    } finally {
      polling = false;
    }
  }

  Future<Json> post(String action, [Json fields = const {}]) => widget.api.call(
    '$path/$action',
    method: 'POST',
    data: {if (connection != null) 'connection': connection, ...fields},
  );
  Future<void> accept() async {
    try {
      await post('accept');
      await tick();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> gather(RTCPeerConnection pc) async {
    final until = DateTime.now().add(Duration(seconds: 12));
    while (mounted &&
        !ended &&
        pc.iceGatheringState !=
            RTCIceGatheringState.RTCIceGatheringStateComplete &&
        DateTime.now().isBefore(until)) {
      await Future<void>.delayed(Duration(milliseconds: 100));
    }
    if (ended || !mounted) throw StateError('Session closed.');
  }

  Future<void> waitConnected(RTCPeerConnection pc) async {
    final until = DateTime.now().add(Duration(seconds: 22));
    while (mounted &&
        !ended &&
        pc.connectionState !=
            RTCPeerConnectionState.RTCPeerConnectionStateConnected &&
        DateTime.now().isBefore(until)) {
      if (pc.connectionState ==
          RTCPeerConnectionState.RTCPeerConnectionStateFailed)
        throw StateError(
          'Connection failed. Check your network and try again.',
        );
      await Future<void>.delayed(Duration(milliseconds: 120));
    }
    if (pc.connectionState !=
        RTCPeerConnectionState.RTCPeerConnectionStateConnected)
      throw StateError('Connection timed out. Leave and try again.');
  }

  Json desc(RTCSessionDescription d) => {'type': d.type, 'sdp': d.sdp};
  late Json rtcConfig;
  Future<void> startMedia() async {
    if (starting || started || ended) return;
    starting = true;
    try {
      setState(() {
        status =
            publisher
                ? 'Allow your ${video ? 'camera and microphone' : 'microphone'} to connect'
                : 'Connecting to the live…';
        error = null;
      });
      if (publisher) {
        final captured = await navigator.mediaDevices.getUserMedia({
          'audio': true,
          'video':
              video
                  ? {
                    'facingMode': 'user',
                    'width': 640,
                    'height': 480,
                    'frameRate': 24,
                  }
                  : false,
        });
        if (ended || !mounted) {
          for (final track in captured.getTracks()) {
            await track.stop();
          }
          await captured.dispose();
          return;
        }
        local = captured;
        localView.srcObject = local;
      }
      if (ended || !mounted) {
        await cleanup();
        return;
      }
      final b = await post('join');
      connection = b['connection'].toString();
      if (ended || !mounted) {
        await post('leave');
        return;
      }
      rtcConfig = {
        'iceServers': b['iceServers'],
        'sdpSemantics': 'unified-plan',
      };
      beat = Timer.periodic(Duration(seconds: 12), (_) async {
        if (!ended)
          try {
            await post('heartbeat');
          } catch (e) {
            if (e is ApiError && [401, 403, 404, 410].contains(e.status))
              finish(e.toString());
          }
      });
      await post('heartbeat');
      if (publisher) {
        final created = await createPeerConnection(rtcConfig);
        if (ended || !mounted) {
          await created.close();
          await created.dispose();
          return;
        }
        pub = created;
        for (final t in local!.getTracks()) {
          await pub!.addTrack(t, local!);
        }
        await pub!.setLocalDescription(await pub!.createOffer());
        await gather(pub!);
        final localDesc = await pub!.getLocalDescription();
        final trans = await pub!.getTransceivers();
        final offer = await post('publish', {
          'sessionDescription': desc(localDesc!),
          'tracks': [
            for (final t in trans)
              if (t.sender.track != null)
                {'mid': t.mid, 'kind': t.sender.track!.kind},
          ],
        });
        final d = offer['sessionDescription'] as Json;
        await pub!.setRemoteDescription(
          RTCSessionDescription(d['sdp'], d['type']),
        );
        await waitConnected(pub!);
        await post('ready');
      }
      await Helper.setSpeakerphoneOn(speaker);
      if (mounted && !ended)
        setState(() {
          started = true;
          status =
              live
                  ? (host ? 'You are live' : 'Waiting for the host…')
                  : 'Waiting for your friend’s media…';
        });
    } catch (e) {
      await finish('Could not connect: $e');
      try {
        await widget.api.call('$path/end', method: 'POST', data: {});
      } catch (_) {}
    } finally {
      starting = false;
    }
  }

  Future<void> receive() async {
    if (subscribing || sub != null || ended) return;
    subscribing = true;
    try {
      final pc = await createPeerConnection(rtcConfig);
      if (ended || !mounted) {
        await pc.close();
        await pc.dispose();
        return;
      }
      sub = pc;
      final received = await createLocalMediaStream('remote-${room['id']}');
      if (ended || !mounted) {
        await received.dispose();
        return;
      }
      remote = received;
      pc.onTrack = (event) async {
        if (ended || !mounted) return;
        if (event.streams.isNotEmpty) {
          remoteView.srcObject = event.streams.first;
        } else {
          await remote!.addTrack(event.track);
          remoteView.srcObject = remote;
        }
        if (mounted) setState(() {});
      };
      final b = await post('subscribe'), d = b['sessionDescription'] as Json;
      await pc.setRemoteDescription(RTCSessionDescription(d['sdp'], d['type']));
      await pc.setLocalDescription(await pc.createAnswer());
      await gather(pc);
      await post('answer', {
        'sessionDescription': desc((await pc.getLocalDescription())!),
      });
      await waitConnected(pc);
      if (mounted && !ended)
        setState(() => status = live ? 'Live now' : 'Connected');
      pc.onConnectionState = (state) {
        if (mounted &&
            !ended &&
            (state ==
                    RTCPeerConnectionState.RTCPeerConnectionStateDisconnected ||
                state == RTCPeerConnectionState.RTCPeerConnectionStateFailed)) {
          setState(
            () =>
                error =
                    'Connection interrupted. Leave and rejoin to reconnect.',
          );
        }
      };
    } catch (e) {
      await finish('Could not receive media: $e');
    } finally {
      subscribing = false;
    }
  }

  Future<void>? cleanupTask;
  Future<void> cleanup() => cleanupTask ??= releaseMedia();
  Future<void> releaseMedia() async {
    beat?.cancel();
    ring?.cancel();
    for (final t in local?.getTracks() ?? <MediaStreamTrack>[]) {
      await t.stop();
    }
    localView.srcObject = null;
    remoteView.srcObject = null;
    await pub?.close();
    await pub?.dispose();
    pub = null;
    await sub?.close();
    await sub?.dispose();
    sub = null;
    await local?.dispose();
    local = null;
    await remote?.dispose();
    remote = null;
  }

  Future<void> finish(String message) async {
    if (ended) return;
    ended = true;
    poll?.cancel();
    beat?.cancel();
    ring?.cancel();
    if (mounted)
      setState(() {
        status = message;
        error = null;
      });
    await cleanup();
  }

  Future<void> leave() async {
    if (leaving) return;
    leaving = true;
    await finish(live ? 'Live ended.' : 'Call ended.');
    try {
      if (connection != null)
        await post('leave');
      else if (host || !live)
        await widget.api.call('$path/end', method: 'POST', data: {});
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    poll?.cancel();
    beat?.cancel();
    ring?.cancel();
    if (!leaving) {
      leaving = true;
      if (connection != null) {
        post('leave').catchError((_) => <String, dynamic>{});
      } else if (host || !live) {
        widget.api
            .call('$path/end', method: 'POST', data: {})
            .catchError((_) => <String, dynamic>{});
      }
    }
    cleanup().whenComplete(() {
      localView.dispose();
      remoteView.dispose();
    });
    super.dispose();
  }

  Widget control(
    IconData icon,
    String label,
    VoidCallback? onTap, {
    Color? color,
  }) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton.filledTonal(
        onPressed: onTap,
        style: IconButton.styleFrom(
          backgroundColor: color ?? Colors.white12,
          foregroundColor: Colors.white,
          padding: EdgeInsets.all(17),
        ),
        icon: Icon(icon),
      ),
      SizedBox(height: 6),
      Text(label, style: TextStyle(color: Colors.white70, fontSize: 11)),
    ],
  );
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: ended,
    onPopInvokedWithResult: (didPop, _) async {
      if (!didPop) {
        await leave();
        if (context.mounted) Navigator.pop(context);
      }
    },
    child: Scaffold(
      backgroundColor: Color(0xff0b2420),
      body: SafeArea(
        child: Stack(
          children: [
            if (rendered && video && !ended && remoteView.srcObject != null)
              Positioned.fill(
                child: RTCVideoView(
                  remoteView,
                  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                ),
              ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black38,
                      Colors.transparent,
                      Colors.black87,
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(22),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(
                        live
                            ? Icons.sensors
                            : video
                            ? Icons.videocam_outlined
                            : Icons.call_outlined,
                        color: mint,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          live ? 'SHADOWSOCIAL LIVE' : 'SHADOWSOCIAL CALL',
                          style: TextStyle(
                            color: Colors.white70,
                            letterSpacing: 1.5,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (live && !ended)
                        Chip(
                          label: Text(
                            '$viewers watching',
                            style: TextStyle(fontSize: 10),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: 26),
                  Text(
                    widget.label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    room['state'] == 'ringing'
                        ? (host
                            ? 'Ringing…'
                            : 'Incoming ${video ? 'video' : 'voice'} call')
                        : status,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: mint, height: 1.4),
                  ),
                  if (error != null)
                    Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.orangeAccent),
                      ),
                    ),
                  Expanded(
                    child: Center(
                      child:
                          (!video || remoteView.srcObject == null)
                              ? Container(
                                width: 130,
                                height: 130,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withValues(alpha: .08),
                                  border: Border.all(
                                    color: mint.withValues(alpha: .25),
                                    width: 2,
                                  ),
                                ),
                                child: Icon(
                                  live
                                      ? Icons.sensors_rounded
                                      : Icons.person_rounded,
                                  size: 70,
                                  color: mint,
                                ),
                              )
                              : SizedBox(),
                    ),
                  ),
                  if (live && !host && !ended)
                    Text(
                      'Watching only · Your camera and microphone are off',
                      style: TextStyle(color: Colors.white60, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                  SizedBox(height: 18),
                  if (!ended && room['state'] == 'ringing' && !host)
                    FilledButton.icon(
                      onPressed: accept,
                      icon: Icon(Icons.call),
                      label: Text('Accept ${video ? 'video' : 'voice'} call'),
                      style: FilledButton.styleFrom(
                        backgroundColor: mint,
                        foregroundColor: ink,
                      ),
                    ),
                  if (started && !ended)
                    Wrap(
                      spacing: 18,
                      runSpacing: 12,
                      alignment: WrapAlignment.center,
                      children: [
                        if (publisher)
                          control(
                            muted ? Icons.mic_off : Icons.mic,
                            muted ? 'Unmute' : 'Mute',
                            () {
                              for (final t
                                  in local?.getAudioTracks() ??
                                      <MediaStreamTrack>[]) {
                                t.enabled = muted;
                              }
                              setState(() => muted = !muted);
                            },
                          ),
                        if (publisher && video)
                          control(
                            camera ? Icons.videocam : Icons.videocam_off,
                            camera ? 'Camera off' : 'Camera on',
                            () {
                              for (final t
                                  in local?.getVideoTracks() ??
                                      <MediaStreamTrack>[]) {
                                t.enabled = !camera;
                              }
                              setState(() => camera = !camera);
                            },
                          ),
                        if (publisher && video)
                          control(Icons.flip_camera_ios_outlined, 'Flip', () {
                            final ts = local?.getVideoTracks();
                            if (ts != null && ts.isNotEmpty)
                              Helper.switchCamera(ts.first);
                          }),
                        control(
                          speaker ? Icons.volume_up : Icons.hearing,
                          'Audio',
                          () async {
                            await Helper.setSpeakerphoneOn(!speaker);
                            if (mounted) setState(() => speaker = !speaker);
                          },
                        ),
                      ],
                    ),
                  SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () async {
                      await leave();
                      if (context.mounted) Navigator.pop(context);
                    },
                    icon: Icon(ended ? Icons.close : Icons.call_end),
                    label: Text(
                      ended
                          ? 'Close'
                          : live
                          ? (host ? 'End live' : 'Leave live')
                          : room['state'] == 'ringing' && !host
                          ? 'Decline'
                          : 'End call',
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor:
                          ended ? Colors.white12 : Colors.redAccent,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(
                        horizontal: 36,
                        vertical: 18,
                      ),
                    ),
                  ),
                  SizedBox(height: 14),
                  Text(
                    'Keep the app open · No recording saved',
                    style: TextStyle(color: Colors.white38, fontSize: 10),
                  ),
                ],
              ),
            ),
            if (rendered &&
                publisher &&
                video &&
                !ended &&
                localView.srcObject != null)
              Positioned(
                right: 18,
                bottom: 245,
                width: 96,
                height: 140,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: RTCVideoView(
                    localView,
                    mirror: true,
                    objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class MediaOffice extends StatefulWidget {
  final Api api;
  const MediaOffice({super.key, required this.api});
  @override
  State<MediaOffice> createState() => _MediaOfficeState();
}

class _MediaOfficeState extends State<MediaOffice> {
  Json data = {};
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call('rtc/office');
      if (mounted)
        setState(() {
          data = b;
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> settings(String key, bool value) async {
    setState(() => busy = true);
    try {
      await widget.api.call(
        'rtc/office/settings',
        method: 'POST',
        data: {...data['config'] as Json, key: value},
      );
      await load();
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Calls & live control'),
      actions: [
        IconButton(
          onPressed: load,
          icon: Icon(Icons.refresh),
          tooltip: 'Refresh',
        ),
      ],
    ),
    body: ListView(
      padding: EdgeInsets.all(20),
      children: [
        if (error != null) Text(error!),
        Text(
          'Community, in real time.',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        SizedBox(height: 12),
        Text(
          'Stop a session with a recorded reason. Private call media stays with participants; this office shows metadata.',
        ),
        if (widget.api.profile?['role'] == 'owner' &&
            data['config'] != null) ...[
          SwitchListTile(
            title: Text('Voice & video calls'),
            subtitle: Text('Turning off ends current calls.'),
            value: (data['config'] as Json)['callsEnabled'] == true,
            onChanged: busy ? null : (v) => settings('callsEnabled', v),
          ),
          SwitchListTile(
            title: Text('Live broadcasts'),
            subtitle: Text('Turning off ends current broadcasts.'),
            value: (data['config'] as Json)['liveEnabled'] == true,
            onChanged: busy ? null : (v) => settings('liveEnabled', v),
          ),
        ],
        ...rows(data, 'rooms').map(
          (r) => Card(
            child: ListTile(
              title: Text(
                r['kind'] == 'live'
                    ? r['title'].toString()
                    : '${r['kind']} call',
              ),
              subtitle: Text('@${r['username']} · ${r['state']}'),
              trailing:
                  r['state'] == 'ended'
                      ? Icon(Icons.check_circle_outline)
                      : IconButton(
                        tooltip: 'Stop session',
                        icon: Icon(
                          Icons.stop_circle_outlined,
                          color: Colors.redAccent,
                        ),
                        onPressed: () async {
                          final reason = await reasonDialog(
                            context,
                            'Why are you stopping this session?',
                          );
                          if (reason == null) return;
                          try {
                            await widget.api.call(
                              'rtc/office/${r['id']}/end',
                              method: 'POST',
                              data: {'reason': reason},
                            );
                            await load();
                          } catch (e) {
                            if (context.mounted) notice(context, e);
                          }
                        },
                      ),
            ),
          ),
        ),
      ],
    ),
  );
}
