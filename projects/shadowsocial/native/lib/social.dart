import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'main.dart';
import 'office.dart';

String age(dynamic n) {
  final d = DateTime.now().difference(
    DateTime.fromMillisecondsSinceEpoch((n as num?)?.toInt() ?? 0),
  );
  return d.inDays > 0
      ? '${d.inDays}d'
      : d.inHours > 0
      ? '${d.inHours}h'
      : d.inMinutes > 0
      ? '${d.inMinutes}m'
      : 'now';
}

Future<String?> reasonDialog(
  BuildContext context,
  String title, {
  String label = 'Reason',
  int min = 5,
}) async {
  final c = TextEditingController();
  final key = GlobalKey<FormState>();
  final value = await showDialog<String>(
    context: context,
    builder:
        (ctx) => AlertDialog(
          title: Text(title),
          content: Form(
            key: key,
            child: TextFormField(
              controller: c,
              autofocus: true,
              maxLines: 4,
              maxLength: 500,
              decoration: InputDecoration(labelText: label),
              validator:
                  (v) =>
                      (v?.trim().length ?? 0) < min
                          ? 'Enter at least $min characters.'
                          : null,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (key.currentState!.validate())
                  Navigator.pop(ctx, c.text.trim());
              },
              child: Text('Continue'),
            ),
          ],
        ),
  );
  c.dispose();
  return value;
}

Future<bool> confirm(BuildContext context, String title, String body) async =>
    await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(title),
            content: Text(body),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text('Confirm'),
              ),
            ],
          ),
    ) ??
    false;
Future<void> report(
  BuildContext context,
  Api api,
  String kind,
  String id,
) async {
  final reason = await reasonDialog(
    context,
    'Report $kind',
    label: 'What happened?',
  );
  if (reason == null) return;
  try {
    await api.call(
      'reports',
      method: 'POST',
      data: {
        'kind': kind,
        'target': id,
        'reason': 'Community concern',
        'details': reason,
      },
    );
    if (context.mounted) notice(context, 'Report sent to the moderation team.');
  } catch (e) {
    if (context.mounted) notice(context, e);
  }
}

class Avatar extends StatelessWidget {
  final Api api;
  final Json person;
  final double radius;
  const Avatar({
    super.key,
    required this.api,
    required this.person,
    this.radius = 23,
  });
  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: radius,
    backgroundColor: mint,
    child:
        person['avatar'] != null
            ? ClipOval(
              child: Image.network(
                api.image(person['avatar']),
                headers: api.headers,
                width: radius * 2,
                height: radius * 2,
                fit: BoxFit.cover,
                errorBuilder:
                    (_, e, s) => Text(
                      (person['name'] ?? person['username'] ?? '?')
                          .toString()
                          .characters
                          .first
                          .toUpperCase(),
                      style: TextStyle(color: ink),
                    ),
              ),
            )
            : Text(
              (person['name'] ?? person['username'] ?? '?').toString().isEmpty
                  ? '?'
                  : (person['name'] ?? person['username'] ?? '?')
                      .toString()
                      .characters
                      .first
                      .toUpperCase(),
              style: TextStyle(
                color: ink,
                fontSize: radius * .7,
                fontWeight: FontWeight.w800,
              ),
            ),
  );
}

class EmptyCard extends StatelessWidget {
  final IconData icon;
  final String title, body;
  const EmptyCard({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 35, horizontal: 24),
    child: Column(
      children: [
        Container(
          padding: EdgeInsets.all(23),
          decoration: BoxDecoration(
            color: mint.withValues(alpha: .45),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 35, color: ink),
        ),
        SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        SizedBox(height: 10),
        Text(
          body,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black54, height: 1.5),
        ),
      ],
    ),
  );
}

class PersonTile extends StatefulWidget {
  final Api api;
  final Json person;
  final VoidCallback? changed;
  const PersonTile({
    super.key,
    required this.api,
    required this.person,
    this.changed,
  });
  @override
  State<PersonTile> createState() => _PersonTileState();
}

class _PersonTileState extends State<PersonTile> {
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final p = widget.person;
    return ListTile(
      contentPadding: EdgeInsets.symmetric(horizontal: 7, vertical: 5),
      leading: Avatar(api: widget.api, person: p),
      title: Text(
        p['name'] ?? p['username'],
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text('@${p['username']}', style: TextStyle(fontSize: 12)),
      onTap:
          () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder:
                  (_) =>
                      ProfileScreen(api: widget.api, username: p['username']),
            ),
          ),
      trailing: FilledButton.tonal(
        onPressed:
            busy
                ? null
                : () async {
                  setState(() => busy = true);
                  try {
                    final r = await widget.api.call(
                      'people/${p['id']}/follow',
                      method: 'POST',
                      data: {'enabled': p['relationship'] == null},
                    );
                    setState(() => p['relationship'] = r['state']);
                    widget.changed?.call();
                  } catch (e) {
                    if (mounted) notice(context, e);
                  } finally {
                    if (mounted) setState(() => busy = false);
                  }
                },
        style: FilledButton.styleFrom(
          minimumSize: Size(76, 36),
          padding: EdgeInsets.symmetric(horizontal: 15),
        ),
        child: Text(
          p['relationship'] == 'accepted'
              ? 'Following'
              : p['relationship'] == 'requested'
              ? 'Requested'
              : 'Follow',
          style: TextStyle(fontSize: 11),
        ),
      ),
    );
  }
}

class SocialHome extends StatefulWidget {
  final Api api;
  const SocialHome({super.key, required this.api});
  @override
  State<SocialHome> createState() => _SocialHomeState();
}

class _SocialHomeState extends State<SocialHome> with WidgetsBindingObserver {
  int tab = 0;
  String mode = 'discover';
  bool loading = true, moreBusy = false;
  String? error, next;
  List<Json> posts = [], people = [], activity = [], requests = [];
  final search = TextEditingController();
  Timer? refreshTimer;
  int generation = 0;
  Api get api => widget.api;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    refreshTimer = Timer.periodic(
      Duration(seconds: 60),
      (_) => api.refresh().catchError((_) {}),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    refreshTimer?.cancel();
    search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      api.refresh().catchError((_) {});
      load();
    }
  }

  Future<void> load() async {
    final g = ++generation;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (tab == 0) {
        final data = await Future.wait([
          api.call('posts?mode=$mode'),
          api.call('people'),
        ]);
        if (!mounted || g != generation) return;
        posts = rows(data[0], 'posts');
        next = data[0]['next'];
        people = rows(data[1], 'people');
      } else if (tab == 1) {
        final b = await api.call(
          'people?q=${Uri.encodeQueryComponent(search.text)}',
        );
        if (!mounted || g != generation) return;
        people = rows(b, 'people');
      } else if (tab == 3) {
        final b = await Future.wait([
          api.call('notifications'),
          api.call('requests'),
        ]);
        if (!mounted || g != generation) return;
        activity = rows(b[0], 'notifications');
        requests = rows(b[1], 'requests');
        await api.call('notifications', method: 'POST', data: {});
      }
    } catch (e) {
      if (mounted && g == generation) error = e.toString();
    } finally {
      if (mounted && g == generation) setState(() => loading = false);
    }
  }

  Future<void> more() async {
    if (next == null || moreBusy) return;
    final g = generation;
    setState(() => moreBusy = true);
    try {
      final b = await api.call(
        'posts?mode=$mode&before=${Uri.encodeQueryComponent(next!)}',
      );
      if (mounted && g == generation)
        setState(() {
          posts.addAll(rows(b, 'posts'));
          next = b['next'];
        });
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => moreBusy = false);
    }
  }

  Future<void> compose() async {
    final done = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ComposerScreen(api: api)),
    );
    if (done == true) {
      setState(() => tab = 0);
      await load();
    }
  }

  void select(int i) {
    if (i == 2) {
      compose();
      return;
    }
    if (i == 4) {
      Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder:
              (_) => ProfileScreen(
                api: api,
                username: api.profile!['username'],
                own: true,
              ),
        ),
      );
      return;
    }
    setState(() => tab = i);
    load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(
        children: [
          BrandMark(size: 33),
          SizedBox(width: 9),
          Text(
            'ShadowSocial',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: ink,
              letterSpacing: -1,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Messages',
          onPressed:
              () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => InboxScreen(api: api)),
              ),
          icon: Icon(Icons.chat_bubble_outline_rounded),
        ),
        IconButton(
          tooltip: 'Settings',
          onPressed:
              () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => SettingsScreen(api: api),
                ),
              ),
          icon: Icon(Icons.tune_rounded),
        ),
        SizedBox(width: 5),
      ],
    ),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(18, 8, 18, 30),
        physics: AlwaysScrollableScrollPhysics(),
        children: [
          if (tab == 0) ...[
            Container(
              padding: EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: ink,
                borderRadius: BorderRadius.circular(26),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'YOUR DAILY DOSE OF CONNECTION',
                          style: TextStyle(
                            color: mint,
                            fontSize: 8,
                            letterSpacing: 1.7,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Life happens.\nShare a little.',
                          style: TextStyle(
                            fontSize: 28,
                            height: 1.06,
                            letterSpacing: -1,
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 14),
                        Text(
                          (api.me['config']?['announcement'] ??
                                  'Make your first connection.')
                              .toString(),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white60,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 15),
                  Transform.rotate(
                    angle: .12,
                    child: Container(
                      width: 70,
                      height: 86,
                      decoration: BoxDecoration(
                        color: mint,
                        borderRadius: BorderRadius.circular(23),
                      ),
                      child: Icon(
                        Icons.auto_awesome_rounded,
                        color: ink,
                        size: 38,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (people.isNotEmpty) ...[
              SizedBox(height: 22),
              Row(
                children: [
                  Text(
                    'People to know',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: ink,
                      fontSize: 16,
                    ),
                  ),
                  Spacer(),
                  TextButton(
                    onPressed: () => select(1),
                    child: Text('Explore all', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
              SizedBox(
                height: 93,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: people.length > 12 ? 12 : people.length,
                  separatorBuilder: (_, i) => SizedBox(width: 19),
                  itemBuilder:
                      (ctx, i) => GestureDetector(
                        onTap:
                            () => Navigator.push(
                              context,
                              MaterialPageRoute<void>(
                                builder:
                                    (_) => ProfileScreen(
                                      api: api,
                                      username: people[i]['username'],
                                    ),
                              ),
                            ),
                        child: SizedBox(
                          width: 65,
                          child: Column(
                            children: [
                              Container(
                                padding: EdgeInsets.all(3),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Color(0xffc3dd98),
                                    width: 1.5,
                                  ),
                                ),
                                child: Avatar(
                                  api: api,
                                  person: people[i],
                                  radius: 25,
                                ),
                              ),
                              SizedBox(height: 7),
                              Text(
                                people[i]['username'],
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 10, color: ink),
                              ),
                            ],
                          ),
                        ),
                      ),
                ),
              ),
            ],
            SizedBox(height: 19),
            Row(
              children: [
                Text(
                  'Your feed',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: ink,
                    fontSize: 21,
                    letterSpacing: -.5,
                  ),
                ),
                Spacer(),
                SegmentedButton<String>(
                  style: ButtonStyle(
                    visualDensity: VisualDensity.compact,
                    textStyle: WidgetStatePropertyAll(TextStyle(fontSize: 10)),
                  ),
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(value: 'discover', label: Text('Discover')),
                    ButtonSegment(value: 'following', label: Text('Following')),
                  ],
                  selected: {mode},
                  onSelectionChanged: (v) {
                    setState(() => mode = v.first);
                    load();
                  },
                ),
              ],
            ),
            SizedBox(height: 16),
          ],
          if (tab == 1) ...[
            Text(
              'Find your people.',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: ink,
                letterSpacing: -1,
              ),
            ),
            SizedBox(height: 9),
            Text(
              'A new connection can start with a hello.',
              style: TextStyle(color: Colors.black54),
            ),
            SizedBox(height: 20),
            TextField(
              controller: search,
              decoration: InputDecoration(
                hintText: 'Search people',
                prefixIcon: Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: load,
                  icon: Icon(Icons.arrow_forward),
                ),
              ),
              onSubmitted: (_) => load(),
            ),
            SizedBox(height: 18),
          ],
          if (tab == 3) ...[
            Text(
              'A little love, lately.',
              style: TextStyle(
                fontSize: 27,
                fontWeight: FontWeight.w800,
                color: ink,
                letterSpacing: -1,
              ),
            ),
            SizedBox(height: 20),
            ...requests.map(
              (p) => Card(
                child: ListTile(
                  leading: Avatar(api: api, person: p),
                  title: Text(
                    '@${p['username']} wants to follow you',
                    style: TextStyle(fontSize: 13),
                  ),
                  subtitle: Row(
                    children: [
                      TextButton(
                        onPressed: () async {
                          try {
                            await api.call(
                              'requests/${p['id']}',
                              method: 'POST',
                              data: {'accept': true},
                            );
                            await load();
                          } catch (e) {
                            if (mounted) notice(context, e);
                          }
                        },
                        child: Text('Accept'),
                      ),
                      TextButton(
                        onPressed: () async {
                          try {
                            await api.call(
                              'requests/${p['id']}',
                              method: 'POST',
                              data: {'accept': false},
                            );
                            await load();
                          } catch (e) {
                            if (mounted) notice(context, e);
                          }
                        },
                        child: Text('Decline'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          if (loading)
            Padding(
              padding: EdgeInsets.all(35),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (error != null)
            Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(error!, textAlign: TextAlign.center),
                    TextButton(onPressed: load, child: Text('Try again')),
                  ],
                ),
              ),
            ),
          if (!loading && error == null) ...[
            if (tab == 0) ...[
              if (posts.isEmpty)
                EmptyCard(
                  icon: Icons.photo_camera_outlined,
                  title:
                      mode == 'following'
                          ? 'Your people will appear here.'
                          : 'The beginning of something good.',
                  body:
                      mode == 'following'
                          ? 'Follow people in Explore to fill your feed.'
                          : 'Share the first moment with your community.',
                ),
              ...posts.map(
                (p) => PostCard(
                  key: ValueKey(p['id']),
                  api: api,
                  post: p,
                  onChanged: load,
                ),
              ),
              if (next != null)
                TextButton(
                  onPressed: moreBusy ? null : more,
                  child: Text(moreBusy ? 'Loading…' : 'More moments'),
                ),
            ],
            if (tab == 1) ...[
              if (people.isEmpty)
                EmptyCard(
                  icon: Icons.people_outline_rounded,
                  title: 'No people found.',
                  body: 'Try another name, or invite a friend to join.',
                ),
              ...people.map((p) => PersonTile(api: api, person: p)),
            ],
            if (tab == 3) ...[
              if (activity.isEmpty && requests.isEmpty)
                EmptyCard(
                  icon: Icons.favorite_border_rounded,
                  title: 'Good things are on their way.',
                  body: 'New follows, likes and community updates appear here.',
                ),
              ...activity.map(
                (a) => Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: mint,
                      child: Icon(
                        a['kind'] == 'like'
                            ? Icons.favorite_outline
                            : Icons.notifications_none,
                        color: ink,
                      ),
                    ),
                    title: Text(a['body'], style: TextStyle(fontSize: 13)),
                    subtitle: Text(
                      age(a['created_at']),
                      style: TextStyle(fontSize: 11),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: select,
      height: 76,
      indicatorColor: mint,
      backgroundColor: Colors.white,
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.explore_outlined),
          selectedIcon: Icon(Icons.explore_rounded),
          label: 'Explore',
        ),
        NavigationDestination(
          icon: Container(
            padding: EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: ink,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.add_rounded, color: mint),
          ),
          label: 'Create',
        ),
        NavigationDestination(
          icon: Icon(Icons.favorite_border_rounded),
          selectedIcon: Icon(Icons.favorite_rounded),
          label: 'Activity',
        ),
        NavigationDestination(
          icon: Avatar(api: api, person: api.profile!, radius: 13),
          label: 'You',
        ),
      ],
    ),
  );
}

class PostCard extends StatefulWidget {
  final Api api;
  final Json post;
  final VoidCallback onChanged;
  const PostCard({
    super.key,
    required this.api,
    required this.post,
    required this.onChanged,
  });
  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  bool busy = false;
  Future<void> toggle(String action, String key) async {
    if (busy) return;
    setState(() => busy = true);
    final enabled = widget.post[key] != 1;
    try {
      await widget.api.call(
        'posts/${widget.post['id']}/$action',
        method: 'POST',
        data: {'enabled': enabled},
      );
      HapticFeedback.selectionClick();
      setState(() {
        widget.post[key] = enabled ? 1 : 0;
        if (key == 'liked')
          widget.post['likes'] =
              (widget.post['likes'] as num).toInt() + (enabled ? 1 : -1);
      });
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.post, api = widget.api;
    return Card(
      margin: EdgeInsets.only(bottom: 18),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            leading: Avatar(api: api, person: p, radius: 19),
            title: Text(
              p['name'] ?? p['username'],
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              '@${p['username']} · ${age(p['created_at'])}',
              style: TextStyle(fontSize: 10),
            ),
            onTap:
                () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder:
                        (_) => ProfileScreen(api: api, username: p['username']),
                  ),
                ),
            trailing: PopupMenuButton<String>(
              onSelected: (v) async {
                if (v == 'report') {
                  await report(context, api, 'post', p['id']);
                } else if (v == 'delete' &&
                    await confirm(
                      context,
                      'Delete this moment?',
                      'Your post will be removed from the community.',
                    )) {
                  try {
                    await api.call('posts/${p['id']}', method: 'DELETE');
                    widget.onChanged();
                  } catch (e) {
                    if (mounted) notice(context, e);
                  }
                }
              },
              itemBuilder:
                  (_) => [
                    PopupMenuItem(value: 'report', child: Text('Report post')),
                    if (p['owner'] == api.profile?['id'])
                      PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete my post'),
                      ),
                  ],
            ),
          ),
          if (p['media_id'] != null)
            GestureDetector(
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder:
                          (_) => Scaffold(
                            backgroundColor: Colors.black,
                            appBar: AppBar(
                              backgroundColor: Colors.black,
                              foregroundColor: Colors.white,
                            ),
                            body: Center(
                              child: InteractiveViewer(
                                child: Image.network(
                                  api.image(p['media_id']),
                                  headers: api.headers,
                                ),
                              ),
                            ),
                          ),
                    ),
                  ),
              child: AspectRatio(
                aspectRatio: 1,
                child: Image.network(
                  api.image(p['media_id']),
                  headers: api.headers,
                  fit: BoxFit.cover,
                  loadingBuilder:
                      (ctx, child, progress) =>
                          progress == null
                              ? child
                              : ColoredBox(
                                color: paper,
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                  errorBuilder:
                      (_, e, s) => ColoredBox(
                        color: paper,
                        child: Center(
                          child: Icon(Icons.broken_image_outlined, size: 40),
                        ),
                      ),
                ),
              ),
            ),
          Padding(
            padding: EdgeInsets.fromLTRB(7, 3, 7, 0),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Like',
                  onPressed: busy ? null : () => toggle('like', 'liked'),
                  icon: Icon(
                    p['liked'] == 1
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: p['liked'] == 1 ? Color(0xffd66361) : ink,
                  ),
                ),
                Text(
                  '${p['likes'] ?? 0}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                ),
                IconButton(
                  tooltip: 'Comments',
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => CommentsScreen(api: api, post: p),
                      ),
                    );
                    widget.onChanged();
                  },
                  icon: Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: ink,
                    size: 22,
                  ),
                ),
                Text('${p['comments'] ?? 0}', style: TextStyle(fontSize: 11)),
                Spacer(),
                IconButton(
                  tooltip: 'Save post',
                  onPressed: busy ? null : () => toggle('save', 'saved'),
                  icon: Icon(
                    p['saved'] == 1
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                    color: ink,
                  ),
                ),
              ],
            ),
          ),
          if ((p['caption'] ?? '').toString().isNotEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 19),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '@${p['username']}  ',
                      style: TextStyle(fontWeight: FontWeight.w800, color: ink),
                    ),
                    TextSpan(text: p['caption']),
                  ],
                ),
                style: TextStyle(fontSize: 13, height: 1.5),
              ),
            ),
        ],
      ),
    );
  }
}

class ComposerScreen extends StatefulWidget {
  final Api api;
  const ComposerScreen({super.key, required this.api});
  @override
  State<ComposerScreen> createState() => _ComposerScreenState();
}

class _ComposerScreenState extends State<ComposerScreen> {
  final caption = TextEditingController();
  XFile? photo;
  bool busy = false;
  String? error;
  @override
  void dispose() {
    caption.dispose();
    super.dispose();
  }

  Future<void> pick(ImageSource source) async {
    try {
      final p = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1800,
        maxHeight: 2400,
        imageQuality: 87,
      );
      if (p != null && mounted) setState(() => photo = p);
    } catch (e) {
      if (mounted)
        notice(
          context,
          'Could not open the photo picker. Check app permissions.',
        );
    }
  }

  Future<void> publish() async {
    FocusScope.of(context).unfocus();
    if (caption.text.trim().isEmpty && photo == null) {
      setState(() => error = 'Add a photo or write a caption.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final media =
          photo == null
              ? null
              : await widget.api.upload(await photo!.readAsBytes());
      final r = await widget.api.call(
        'posts',
        method: 'POST',
        data: {'caption': caption.text, 'mediaId': media},
      );
      if (mounted) {
        notice(
          context,
          r['status'] == 'pending'
              ? 'Your moment is waiting for team approval.'
              : 'Your moment is live.',
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          'Share a moment',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          TextButton(
            onPressed: busy ? null : publish,
            child: Text(busy ? 'Sharing…' : 'Publish'),
          ),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.all(22),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(api: widget.api, person: widget.api.profile!),
            title: Text(
              widget.api.profile!['name'],
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              widget.api.profile!['private'] == 1
                  ? 'Visible to approved followers'
                  : 'Shared with the community',
            ),
          ),
          SizedBox(height: 18),
          TextField(
            key: Key('post-caption'),
            controller: caption,
            maxLength: 2200,
            maxLines: 5,
            decoration: InputDecoration(
              hintText: 'What is your world looking like today?',
            ),
          ),
          SizedBox(height: 18),
          if (photo != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.file(
                File(photo!.path),
                height: 300,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              height: 230,
              decoration: BoxDecoration(
                color: mint.withValues(alpha: .4),
                borderRadius: BorderRadius.circular(25),
                border: Border.all(color: Color(0xffd3dfc5)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.add_photo_alternate_outlined,
                    size: 50,
                    color: ink,
                  ),
                  SizedBox(height: 14),
                  Text(
                    'A picture says a little more.',
                    style: TextStyle(color: ink, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 7),
                  Text(
                    'JPEG, PNG or WebP · up to 6 MB',
                    style: TextStyle(fontSize: 11, color: Colors.black45),
                  ),
                ],
              ),
            ),
          SizedBox(height: 17),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => pick(ImageSource.gallery),
                  icon: Icon(Icons.photo_outlined),
                  label: Text('Gallery'),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => pick(ImageSource.camera),
                  icon: Icon(Icons.camera_alt_outlined),
                  label: Text('Camera'),
                ),
              ),
            ],
          ),
          if (photo != null)
            TextButton(
              onPressed: busy ? null : () => setState(() => photo = null),
              child: Text('Remove photo'),
            ),
          if (error != null)
            Padding(
              padding: EdgeInsets.all(14),
              child: Text(error!, style: TextStyle(color: Colors.red)),
            ),
          SizedBox(height: 18),
          FilledButton(
            onPressed: busy ? null : publish,
            child: Text(
              busy ? 'Sharing your moment…' : 'Share with your people',
            ),
          ),
          SizedBox(height: 13),
          Text(
            'Share content you own. Respect privacy and community rules.',
            style: TextStyle(fontSize: 11, color: Colors.black45),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

class CommentsScreen extends StatefulWidget {
  final Api api;
  final Json post;
  const CommentsScreen({super.key, required this.api, required this.post});
  @override
  State<CommentsScreen> createState() => _CommentsScreenState();
}

class _CommentsScreenState extends State<CommentsScreen> {
  List<Json> comments = [];
  bool loading = true, busy = false;
  String? error;
  final text = TextEditingController();
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call('posts/${widget.post['id']}/comments');
      if (mounted) setState(() => comments = rows(b, 'comments'));
    } catch (e) {
      error = e.toString();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Conversation')),
    body: Column(
      children: [
        Expanded(
          child:
              loading
                  ? Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: EdgeInsets.all(18),
                      children: [
                        if (error != null) Text(error!),
                        if (comments.isEmpty && error == null)
                          EmptyCard(
                            icon: Icons.chat_bubble_outline,
                            title: 'Start the conversation.',
                            body: 'Leave a little kindness.',
                          ),
                        ...comments.map(
                          (c) => Card(
                            child: ListTile(
                              leading: Avatar(
                                api: widget.api,
                                person: c,
                                radius: 17,
                              ),
                              title: Text(
                                '@${c['username']}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              subtitle: Text(c['body']),
                              trailing: PopupMenuButton<String>(
                                onSelected: (v) async {
                                  if (v == 'report') {
                                    await report(
                                      context,
                                      widget.api,
                                      'comment',
                                      c['id'],
                                    );
                                  } else {
                                    try {
                                      await widget.api.call(
                                        'comments/${c['id']}',
                                        method: 'DELETE',
                                      );
                                      await load();
                                    } catch (e) {
                                      if (mounted) notice(context, e);
                                    }
                                  }
                                },
                                itemBuilder:
                                    (_) => [
                                      PopupMenuItem(
                                        value: 'report',
                                        child: Text('Report'),
                                      ),
                                      if (c['owner'] ==
                                              widget.api.profile?['id'] ||
                                          widget.post['owner'] ==
                                              widget.api.profile?['id'])
                                        PopupMenuItem(
                                          value: 'delete',
                                          child: Text('Delete'),
                                        ),
                                    ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.all(15),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: text,
                    maxLength: 500,
                    decoration: InputDecoration(
                      hintText: 'Say something kind…',
                      counterText: '',
                    ),
                  ),
                ),
                SizedBox(width: 10),
                IconButton.filled(
                  onPressed:
                      busy
                          ? null
                          : () async {
                            setState(() => busy = true);
                            try {
                              await widget.api.call(
                                'posts/${widget.post['id']}/comments',
                                method: 'POST',
                                data: {'body': text.text},
                              );
                              text.clear();
                              await load();
                            } catch (e) {
                              if (mounted) notice(context, e);
                            } finally {
                              if (mounted) setState(() => busy = false);
                            }
                          },
                  icon: Icon(Icons.arrow_upward_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class ProfileScreen extends StatefulWidget {
  final Api api;
  final String username;
  final bool own;
  const ProfileScreen({
    super.key,
    required this.api,
    required this.username,
    this.own = false,
  });
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Json data = {};
  List<Json> posts = [];
  bool loading = true, saved = false, busy = false;
  String? error;
  Json? get person => data['profile'] as Json?;
  bool get own => person?['id'] == widget.api.profile?['id'];
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call(
        'people/${Uri.encodeComponent(widget.username)}',
      );
      final feed = await widget.api.call(
        saved
            ? 'posts?mode=saved'
            : 'posts?user=${Uri.encodeQueryComponent(widget.username)}',
      );
      if (mounted)
        setState(() {
          data = b;
          posts = rows(feed, 'posts');
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        '@${widget.username}',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        if (own)
          IconButton(
            onPressed:
                () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => SettingsScreen(api: widget.api),
                  ),
                ),
            icon: Icon(Icons.tune_rounded),
          ),
      ],
    ),
    body:
        loading
            ? Center(child: CircularProgressIndicator())
            : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: EdgeInsets.all(20),
                children: [
                  if (error != null) ...[
                    Text(error!),
                    TextButton(onPressed: load, child: Text('Try again')),
                  ],
                  if (person != null) ...[
                    Container(
                      padding: EdgeInsets.all(25),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Column(
                        children: [
                          Avatar(api: widget.api, person: person!, radius: 47),
                          SizedBox(height: 15),
                          Text(
                            person!['name'],
                            style: TextStyle(
                              fontSize: 26,
                              color: ink,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -.7,
                            ),
                          ),
                          Text(
                            '@${person!['username']}',
                            style: TextStyle(color: Colors.black45),
                          ),
                          if ((person!['bio'] ?? '').isNotEmpty)
                            Padding(
                              padding: EdgeInsets.only(top: 14),
                              child: Text(
                                person!['bio'],
                                textAlign: TextAlign.center,
                              ),
                            ),
                          SizedBox(height: 22),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children:
                                ['posts', 'followers', 'following']
                                    .map(
                                      (k) => Column(
                                        children: [
                                          Text(
                                            '${data['counts']?[k] ?? 0}',
                                            style: TextStyle(
                                              fontSize: 21,
                                              fontWeight: FontWeight.w800,
                                              color: ink,
                                            ),
                                          ),
                                          Text(
                                            k,
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.black45,
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                    .toList(),
                          ),
                          SizedBox(height: 23),
                          if (own)
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.tonal(
                                onPressed: () async {
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute<void>(
                                      builder:
                                          (_) => EditProfileScreen(
                                            api: widget.api,
                                          ),
                                    ),
                                  );
                                  await load();
                                },
                                child: Text('Edit profile'),
                              ),
                            )
                          else
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton(
                                    onPressed:
                                        busy
                                            ? null
                                            : () async {
                                              setState(() => busy = true);
                                              try {
                                                await widget.api.call(
                                                  'people/${person!['id']}/follow',
                                                  method: 'POST',
                                                  data: {
                                                    'enabled':
                                                        data['relationship'] ==
                                                        null,
                                                  },
                                                );
                                                await load();
                                              } catch (e) {
                                                if (mounted) notice(context, e);
                                              } finally {
                                                if (mounted)
                                                  setState(() => busy = false);
                                              }
                                            },
                                    child: Text(
                                      data['relationship'] == 'accepted'
                                          ? 'Following'
                                          : data['relationship'] == 'requested'
                                          ? 'Requested'
                                          : 'Follow',
                                    ),
                                  ),
                                ),
                                SizedBox(width: 8),
                                IconButton.outlined(
                                  tooltip: 'Report user',
                                  onPressed:
                                      () => report(
                                        context,
                                        widget.api,
                                        'user',
                                        person!['id'],
                                      ),
                                  icon: Icon(Icons.flag_outlined),
                                ),
                                IconButton.outlined(
                                  tooltip: 'Block user',
                                  onPressed: () async {
                                    if (await confirm(
                                      context,
                                      'Block @${person!['username']}?',
                                      'You will stop seeing each other and following links will be removed.',
                                    )) {
                                      try {
                                        await widget.api.call(
                                          'people/${person!['id']}/block',
                                          method: 'POST',
                                          data: {'enabled': true},
                                        );
                                        if (mounted) Navigator.pop(context);
                                      } catch (e) {
                                        if (mounted) notice(context, e);
                                      }
                                    }
                                  },
                                  icon: Icon(Icons.block_outlined),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    SizedBox(height: 22),
                    if (own)
                      SegmentedButton<bool>(
                        segments: [
                          ButtonSegment(
                            value: false,
                            icon: Icon(Icons.grid_view),
                            label: Text('My moments'),
                          ),
                          ButtonSegment(
                            value: true,
                            icon: Icon(Icons.bookmark_border),
                            label: Text('Saved'),
                          ),
                        ],
                        selected: {saved},
                        onSelectionChanged: (v) {
                          setState(() => saved = v.first);
                          load();
                        },
                      ),
                    SizedBox(height: 17),
                    if (data['canView'] == false && !saved)
                      EmptyCard(
                        icon: Icons.lock_outline,
                        title: 'A little more private.',
                        body:
                            'Follow this account and wait for approval to see their moments.',
                      )
                    else if (posts.isEmpty)
                      EmptyCard(
                        icon: Icons.photo_outlined,
                        title:
                            saved
                                ? 'Keep a little inspiration.'
                                : 'A story waiting to be told.',
                        body:
                            saved
                                ? 'Tap the bookmark on a post to save it here.'
                                : 'Moments will appear here when they are shared.',
                      ),
                    ...posts.map(
                      (p) =>
                          PostCard(api: widget.api, post: p, onChanged: load),
                    ),
                  ],
                ],
              ),
            ),
  );
}

class EditProfileScreen extends StatefulWidget {
  final Api api;
  const EditProfileScreen({super.key, required this.api});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late TextEditingController name, bio;
  late bool private;
  bool busy = false;
  XFile? photo;
  @override
  void initState() {
    super.initState();
    name = TextEditingController(text: widget.api.profile!['name']);
    bio = TextEditingController(text: widget.api.profile!['bio']);
    private = widget.api.profile!['private'] == 1;
  }

  @override
  void dispose() {
    name.dispose();
    bio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Make it yours')),
    body: ListView(
      padding: EdgeInsets.all(23),
      children: [
        Center(
          child:
              photo == null
                  ? Avatar(
                    api: widget.api,
                    person: widget.api.profile!,
                    radius: 48,
                  )
                  : CircleAvatar(
                    radius: 48,
                    backgroundImage: FileImage(File(photo!.path)),
                  ),
        ),
        TextButton(
          onPressed:
              busy
                  ? null
                  : () async {
                    try {
                      final p = await ImagePicker().pickImage(
                        source: ImageSource.gallery,
                        maxWidth: 700,
                        maxHeight: 700,
                        imageQuality: 85,
                      );
                      if (p != null && mounted) setState(() => photo = p);
                    } catch (e) {
                      if (mounted) notice(context, 'Photo picker unavailable.');
                    }
                  },
          child: Text('Change photo'),
        ),
        SizedBox(height: 20),
        TextField(
          controller: name,
          maxLength: 60,
          decoration: InputDecoration(labelText: 'Display name'),
        ),
        SizedBox(height: 15),
        TextField(
          controller: bio,
          maxLength: 300,
          maxLines: 4,
          decoration: InputDecoration(labelText: 'A little about you'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Private account'),
          subtitle: Text('Approve followers before they can see your moments.'),
          value: private,
          onChanged: busy ? null : (v) => setState(() => private = v),
        ),
        SizedBox(height: 20),
        FilledButton(
          onPressed:
              busy
                  ? null
                  : () async {
                    setState(() => busy = true);
                    try {
                      final avatar =
                          photo == null
                              ? null
                              : await widget.api.upload(
                                await photo!.readAsBytes(),
                              );
                      await widget.api.call(
                        'profile',
                        method: 'PATCH',
                        data: {
                          'name': name.text,
                          'bio': bio.text,
                          'private': private,
                          if (avatar != null) 'avatar': avatar,
                        },
                      );
                      await widget.api.refresh();
                      if (mounted) Navigator.pop(context);
                    } catch (e) {
                      if (mounted) notice(context, e);
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
          child: Text(busy ? 'Saving…' : 'Save changes'),
        ),
      ],
    ),
  );
}

class SettingsScreen extends StatelessWidget {
  final Api api;
  const SettingsScreen({super.key, required this.api});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Your space')),
    body: ListView(
      padding: EdgeInsets.all(20),
      children: [
        ListTile(
          leading: BrandMark(size: 46),
          title: Text(
            'ShadowSocial',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 21,
              color: ink,
            ),
          ),
          subtitle: Text('Version 0.2.1 · by SHADOWNET'),
        ),
        SizedBox(height: 22),
        if (api.staff)
          Card(
            child: ListTile(
              leading: Icon(Icons.admin_panel_settings_outlined),
              title: Text('Your office'),
              subtitle: Text('People, safety and community controls'),
              trailing: Icon(Icons.arrow_forward),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => OfficeScreen(api: api),
                    ),
                  ),
            ),
          ),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: Icon(Icons.lock_outline),
                title: Text('Change password'),
                onTap:
                    () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => PasswordScreen(api: api),
                      ),
                    ),
              ),
              ListTile(
                leading: Icon(Icons.block_outlined),
                title: Text('Blocked accounts'),
                onTap:
                    () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => BlockedScreen(api: api),
                      ),
                    ),
              ),
              ListTile(
                leading: Icon(Icons.shield_outlined),
                title: Text('Community rules & privacy'),
                onTap:
                    () => showDialog<void>(
                      context: context,
                      builder:
                          (ctx) => AlertDialog(
                            title: Text('Our community'),
                            content: SingleChildScrollView(
                              child: Text(
                                '${api.me['config']?['rules'] ?? ''}\n\nYour password is hashed. Sessions are kept in Android secure storage. Messages are available between mutual followers and are stored on the server; they are not end-to-end encrypted. We use the camera or photo picker only when you choose to share a photo.\n\nAccount recovery uses your saved private code. Staff can moderate public content and restrict accounts.',
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
              ),
            ],
          ),
        ),
        SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: () async {
            try {
              await api.logout();
              if (context.mounted)
                Navigator.popUntil(context, (r) => r.isFirst);
            } catch (e) {
              if (context.mounted) {
                Navigator.popUntil(context, (r) => r.isFirst);
                notice(context, e);
              }
            }
          },
          icon: Icon(Icons.logout_rounded),
          label: Text('Sign out'),
        ),
        SizedBox(height: 24),
        TextButton(
          onPressed: () async {
            final value = await reasonDialog(
              context,
              'Delete your account',
              label: 'Type your username to confirm',
              min: 3,
            );
            if (value == null) return;
            try {
              await api.call(
                'profile',
                method: 'DELETE',
                data: {'confirm': value},
              );
              await api.logout();
              if (context.mounted)
                Navigator.popUntil(context, (r) => r.isFirst);
            } catch (e) {
              if (context.mounted) notice(context, e);
            }
          },
          child: Text(
            'Delete account',
            style: TextStyle(color: Colors.red.shade700),
          ),
        ),
        SizedBox(height: 25),
        Text(
          'Made for real connection.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black38, fontSize: 11),
        ),
      ],
    ),
  );
}

class PasswordScreen extends StatefulWidget {
  final Api api;
  const PasswordScreen({super.key, required this.api});
  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  final current = TextEditingController(), password = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    current.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Change password')),
    body: ListView(
      padding: EdgeInsets.all(24),
      children: [
        Text(
          'A fresh start for your security.',
          style: TextStyle(
            color: ink,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        SizedBox(height: 12),
        Text(
          'Other sessions will be signed out. Save your new recovery code after changing your password.',
        ),
        SizedBox(height: 24),
        TextField(
          controller: current,
          obscureText: true,
          decoration: InputDecoration(labelText: 'Current password'),
        ),
        SizedBox(height: 16),
        TextField(
          controller: password,
          obscureText: true,
          decoration: InputDecoration(
            labelText: 'New password · at least 12 characters',
          ),
        ),
        SizedBox(height: 23),
        FilledButton(
          onPressed:
              busy
                  ? null
                  : () async {
                    setState(() => busy = true);
                    try {
                      final r = await widget.api.call(
                        'auth/change-password',
                        method: 'POST',
                        data: {
                          'currentPassword': current.text,
                          'password': password.text,
                        },
                      );
                      widget.api.token = r['token'];
                      await widget.api.vault.write(r['token']);
                      if (mounted) {
                        await recoveryDialog(context, r['recoveryCode']);
                        if (mounted) Navigator.pop(context);
                      }
                    } catch (e) {
                      if (mounted) notice(context, e);
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
          child: Text(busy ? 'Updating…' : 'Update password'),
        ),
      ],
    ),
  );
}

class BlockedScreen extends StatefulWidget {
  final Api api;
  const BlockedScreen({super.key, required this.api});
  @override
  State<BlockedScreen> createState() => _BlockedScreenState();
}

class _BlockedScreenState extends State<BlockedScreen> {
  List<Json> blocks = [];
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call('requests');
      if (mounted) setState(() => blocks = rows(b, 'blocks'));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Blocked accounts')),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: EdgeInsets.all(20),
        children: [
          if (error != null) Text(error!),
          if (blocks.isEmpty)
            EmptyCard(
              icon: Icons.shield_outlined,
              title: 'You are in control.',
              body: 'Accounts you block appear here.',
            ),
          ...blocks.map(
            (p) => ListTile(
              leading: Avatar(api: widget.api, person: p),
              title: Text('@${p['username']}'),
              trailing: TextButton(
                onPressed: () async {
                  try {
                    await widget.api.call(
                      'people/${p['id']}/block',
                      method: 'POST',
                      data: {'enabled': false},
                    );
                    await load();
                  } catch (e) {
                    if (mounted) notice(context, e);
                  }
                },
                child: Text('Unblock'),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class InboxScreen extends StatefulWidget {
  final Api api;
  const InboxScreen({super.key, required this.api});
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<Json> people = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final b = await widget.api.call('messages');
      if (mounted)
        setState(() {
          people = rows(b, 'people');
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        'Your conversations',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: EdgeInsets.all(20),
        children: [
          Text(
            'A hello goes a long way.',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: ink,
              letterSpacing: -.8,
            ),
          ),
          SizedBox(height: 10),
          Text(
            'Message people you follow who also follow you.',
            style: TextStyle(color: Colors.black54),
          ),
          SizedBox(height: 23),
          if (loading) Center(child: CircularProgressIndicator()),
          if (error != null) ...[
            Text(error!),
            TextButton(onPressed: load, child: Text('Try again')),
          ],
          if (!loading && people.isEmpty && error == null)
            EmptyCard(
              icon: Icons.forum_outlined,
              title: 'Make room for a hello.',
              body:
                  'When you and a friend follow each other, your conversation can start here.',
            ),
          ...people.map(
            (p) => Card(
              child: ListTile(
                leading: Avatar(api: widget.api, person: p),
                title: Text(
                  p['name'],
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  p['last_message'] ?? 'Say hello to @${p['username']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing:
                    (p['unread'] as num? ?? 0) > 0
                        ? Badge(label: Text('${p['unread']}'))
                        : Icon(Icons.chevron_right),
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => ChatScreen(api: widget.api, person: p),
                    ),
                  );
                  await load();
                },
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class ChatScreen extends StatefulWidget {
  final Api api;
  final Json person;
  const ChatScreen({super.key, required this.api, required this.person});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  List<Json> messages = [];
  final text = TextEditingController();
  final scroll = ScrollController();
  Timer? timer;
  bool busy = false, loading = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(Duration(seconds: 8), (_) => load());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    text.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    timer?.cancel();
    if (state == AppLifecycleState.resumed) {
      load();
      timer = Timer.periodic(Duration(seconds: 8), (_) => load());
    }
  }

  Future<void> load() async {
    if (loading) return;
    loading = true;
    try {
      final b = await widget.api.call('messages/${widget.person['id']}');
      if (mounted)
        setState(() {
          messages = rows(b, 'messages');
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      loading = false;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(
        children: [
          Avatar(api: widget.api, person: widget.person, radius: 18),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.person['name'],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Report account',
          onPressed:
              () => report(context, widget.api, 'user', widget.person['id']),
          icon: Icon(Icons.flag_outlined),
        ),
      ],
    ),
    body: Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Text(
            'Only mutual followers can message. Respect each other’s privacy.',
            style: TextStyle(fontSize: 10, color: Colors.black45),
            textAlign: TextAlign.center,
          ),
        ),
        if (error != null)
          Padding(
            padding: EdgeInsets.all(15),
            child: Text(error!, style: TextStyle(color: Colors.red)),
          ),
        Expanded(
          child:
              messages.isEmpty
                  ? EmptyCard(
                    icon: Icons.waving_hand_outlined,
                    title: 'Start with hello.',
                    body: 'A real conversation starts with a little kindness.',
                  )
                  : ListView.builder(
                    controller: scroll,
                    padding: EdgeInsets.all(18),
                    itemCount: messages.length,
                    itemBuilder: (ctx, i) {
                      final m = messages[i],
                          mine = m['sender'] == widget.api.profile!['id'];
                      return Align(
                        alignment:
                            mine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.sizeOf(context).width * .78,
                          ),
                          margin: EdgeInsets.only(bottom: 12),
                          padding: EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: mine ? ink : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                m['body'],
                                style: TextStyle(
                                  color: mine ? Colors.white : ink,
                                  height: 1.4,
                                ),
                              ),
                              SizedBox(height: 5),
                              Text(
                                age(m['created_at']),
                                style: TextStyle(
                                  color: mine ? Colors.white54 : Colors.black38,
                                  fontSize: 9,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: text,
                    maxLength: 2000,
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Your message…',
                      counterText: '',
                    ),
                  ),
                ),
                SizedBox(width: 10),
                IconButton.filled(
                  onPressed:
                      busy
                          ? null
                          : () async {
                            setState(() => busy = true);
                            try {
                              await widget.api.call(
                                'messages/${widget.person['id']}',
                                method: 'POST',
                                data: {'body': text.text},
                              );
                              text.clear();
                              await load();
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (scroll.hasClients)
                                  scroll.animateTo(
                                    scroll.position.maxScrollExtent,
                                    duration: Duration(milliseconds: 250),
                                    curve: Curves.easeOut,
                                  );
                              });
                            } catch (e) {
                              if (mounted) notice(context, e);
                            } finally {
                              if (mounted) setState(() => busy = false);
                            }
                          },
                  icon: Icon(Icons.arrow_upward_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
