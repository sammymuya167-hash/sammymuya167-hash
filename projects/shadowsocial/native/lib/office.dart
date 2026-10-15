import 'package:flutter/material.dart';
import 'api.dart';
import 'main.dart';
import 'social.dart';

class OfficeScreen extends StatefulWidget {
  final Api api;
  const OfficeScreen({super.key, required this.api});
  @override
  State<OfficeScreen> createState() => _OfficeScreenState();
}

class _OfficeScreenState extends State<OfficeScreen> {
  int tab = 0, page = 0;
  Json data = {};
  bool loading = true, busy = false;
  String? error;
  String status = 'pending';
  final search = TextEditingController();
  final tabs = ['Overview', 'People', 'Content', 'Reports', 'Appeals', 'Rules'];
  Api get api => widget.api;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final path =
          [
            'overview',
            'users?q=${Uri.encodeQueryComponent(search.text)}&page=$page',
            'posts?status=$status&page=$page',
            'reports?page=$page',
            'appeals?page=$page',
            'overview',
          ][tab];
      final b = await api.call('office/$path');
      if (mounted) setState(() => data = b);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> action(
    String path,
    Json fields, {
    String title = 'Record a moderation reason',
  }) async {
    final reason = await reasonDialog(context, title);
    if (reason == null) return;
    setState(() => busy = true);
    try {
      await api.call(
        'office/$path',
        method: 'POST',
        data: {...fields, 'reason': reason},
      );
      await load();
      if (mounted) notice(context, 'Action saved in the audit log.');
    } catch (e) {
      if (mounted) notice(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> inspect(String kind, String target) async {
    try {
      final b = await api.call('office/context/$kind/$target');
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder:
            (ctx) => DraggableScrollableSheet(
              expand: false,
              initialChildSize: .72,
              minChildSize: .4,
              maxChildSize: .95,
              builder: (ctx, controller) {
                final item = b['item'] as Json, author = b['author'] as Json?;
                return ListView(
                  controller: controller,
                  padding: EdgeInsets.all(24),
                  children: [
                    Text(
                      'Reported $kind',
                      style: TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                        color: ink,
                      ),
                    ),
                    SizedBox(height: 18),
                    if (author != null)
                      ListTile(
                        leading: Avatar(api: api, person: author),
                        title: Text('@${author['username']}'),
                        subtitle: Text(
                          '${author['role']} · ${author['status']}',
                        ),
                      ),
                    if (item['media_id'] != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: Image.network(
                          api.image(item['media_id']),
                          headers: api.headers,
                          height: 280,
                          fit: BoxFit.contain,
                        ),
                      ),
                    SizedBox(height: 16),
                    SelectableText(
                      (item['caption'] ?? item['body'] ?? item['bio'] ?? '')
                          .toString(),
                    ),
                    SizedBox(height: 15),
                    Text('Status: ${item['status'] ?? 'active'}'),
                    if (kind != 'user') ...[
                      SizedBox(height: 20),
                      FilledButton(
                        onPressed:
                            busy
                                ? null
                                : () {
                                  Navigator.pop(ctx);
                                  action(
                                    '${kind == 'post' ? 'posts' : 'comments'}/$target',
                                    {'action': 'remove'},
                                  );
                                },
                        child: Text('Remove content'),
                      ),
                      TextButton(
                        onPressed:
                            busy
                                ? null
                                : () {
                                  Navigator.pop(ctx);
                                  action(
                                    '${kind == 'post' ? 'posts' : 'comments'}/$target',
                                    {'action': 'restore'},
                                  );
                                },
                        child: Text('Approve / restore content'),
                      ),
                    ],
                    if (author != null && author['role'] != 'owner')
                      TextButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          manageUser(author);
                        },
                        child: Text('Manage this account'),
                      ),
                  ],
                );
              },
            ),
      );
    } catch (e) {
      if (mounted) notice(context, e);
    }
  }

  Future<void> manageUser(Json u) async {
    if (u['role'] == 'owner' || u['id'] == api.profile?['id']) {
      notice(context, 'The owner and your own account are protected.');
      return;
    }
    final options = <String, String>{
      'warn': 'Send warning',
      'suspend': 'Suspend for 7 days',
      if (api.profile?['role'] != 'moderator') 'ban': 'Ban account',
      if (api.profile?['role'] != 'moderator') 'restore': 'Restore account',
    };
    // Role choices are added individually to keep permission labels explicit.
    if (api.profile?['role'] == 'owner') {
      options['role:member'] = 'Set role: member';
      options['role:moderator'] = 'Set role: moderator';
      options['role:admin'] = 'Set role: administrator';
    }
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder:
          (ctx) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  title: Text(
                    '@${u['username']}',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text('${u['role']} · ${u['status']}'),
                ),
                ...options.entries.map(
                  (e) => ListTile(
                    title: Text(e.value),
                    trailing: Icon(Icons.chevron_right),
                    onTap: () => Navigator.pop(ctx, e.key),
                  ),
                ),
              ],
            ),
          ),
    );
    if (choice == null) return;
    await action(
      'users/${u['id']}',
      choice.startsWith('role:')
          ? {'action': 'role', 'role': choice.split(':')[1]}
          : {'action': choice, 'days': 7},
      title: '${options[choice]}: reason',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text('Your office', style: TextStyle(fontWeight: FontWeight.w800)),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: loading ? null : load,
          icon: Icon(Icons.refresh_rounded),
        ),
      ],
    ),
    body: Column(
      children: [
        Container(
          margin: EdgeInsets.fromLTRB(20, 0, 20, 17),
          padding: EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: ink,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              Icon(Icons.admin_panel_settings_outlined, color: mint, size: 31),
              SizedBox(width: 15),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'A good community starts here.',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      '${api.profile?['role']} access · actions are audited',
                      style: TextStyle(color: Colors.white60, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            padding: EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: tabs.length,
            separatorBuilder: (_, i) => SizedBox(width: 8),
            itemBuilder:
                (ctx, i) => ChoiceChip(
                  label: Text(tabs[i]),
                  selected: tab == i,
                  onSelected: (_) {
                    setState(() {
                      tab = i;
                      page = 0;
                    });
                    load();
                  },
                ),
          ),
        ),
        Expanded(
          child:
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
                        ] else ...[
                          if (tab == 0) ...[
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: NeverScrollableScrollPhysics(),
                              childAspectRatio: 1.7,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                              children:
                                  {
                                        'users': 'People',
                                        'posts': 'Live moments',
                                        'reports': 'Open reports',
                                        'restricted': 'Restricted',
                                        'pending': 'Awaiting review',
                                        'appeals': 'Open appeals',
                                      }.entries
                                      .map(
                                        (e) => Container(
                                          padding: EdgeInsets.all(18),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(
                                              20,
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                '${data['stats']?[e.key] ?? 0}',
                                                style: TextStyle(
                                                  fontSize: 29,
                                                  color: ink,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                              Text(
                                                e.value,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.black54,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      )
                                      .toList(),
                            ),
                            SizedBox(height: 23),
                            Text(
                              'Recent decisions',
                              style: TextStyle(
                                fontSize: 20,
                                color: ink,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            SizedBox(height: 10),
                            ...rows(data, 'audit').map(
                              (a) => Card(
                                child: ListTile(
                                  title: Text(
                                    a['action'],
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${a['reason']}\n@${a['username'] ?? 'system'} · ${age(a['created_at'])}',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                ),
                              ),
                            ),
                          ] else if (tab == 1) ...[
                            TextField(
                              controller: search,
                              decoration: InputDecoration(
                                hintText: 'Search people',
                                prefixIcon: Icon(Icons.search),
                                suffixIcon: IconButton(
                                  onPressed: () {
                                    page = 0;
                                    load();
                                  },
                                  icon: Icon(Icons.arrow_forward),
                                ),
                              ),
                              onSubmitted: (_) {
                                page = 0;
                                load();
                              },
                            ),
                            SizedBox(height: 15),
                            ...rows(data, 'users').map(
                              (u) => Card(
                                child: ListTile(
                                  leading: Avatar(api: api, person: u),
                                  title: Text(
                                    '@${u['username']}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${u['name']} · ${u['role']}\n${u['status']}${u['reason'] == '' ? '' : ' · ${u['reason']}'}',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                  isThreeLine: true,
                                  trailing: Icon(Icons.more_horiz),
                                  onTap: busy ? null : () => manageUser(u),
                                ),
                              ),
                            ),
                          ] else if (tab == 2) ...[
                            DropdownButtonFormField<String>(
                              value: status,
                              decoration: InputDecoration(
                                labelText: 'Content status',
                              ),
                              items:
                                  ['pending', 'live', 'removed', 'deleted', '']
                                      .map(
                                        (s) => DropdownMenuItem(
                                          value: s,
                                          child: Text(s.isEmpty ? 'All' : s),
                                        ),
                                      )
                                      .toList(),
                              onChanged: (v) {
                                status = v ?? '';
                                page = 0;
                                load();
                              },
                            ),
                            SizedBox(height: 16),
                            if (rows(data, 'posts').isEmpty)
                              EmptyCard(
                                icon: Icons.task_alt_rounded,
                                title: 'All caught up.',
                                body: 'There are no moments in this queue.',
                              ),
                            ...rows(data, 'posts').map(
                              (p) => Card(
                                child: ListTile(
                                  leading: Icon(Icons.photo_outlined),
                                  title: Text(
                                    '@${p['username']} · ${p['status']}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                  subtitle: Text(
                                    p['caption'],
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  trailing: Icon(Icons.chevron_right),
                                  onTap: () => inspect('post', p['id']),
                                ),
                              ),
                            ),
                          ] else if (tab == 3) ...[
                            if (rows(data, 'reports').isEmpty)
                              EmptyCard(
                                icon: Icons.shield_outlined,
                                title: 'No reports yet.',
                                body:
                                    'Community concerns will appear here for review.',
                              ),
                            ...rows(data, 'reports').map(
                              (r) => Card(
                                child: Padding(
                                  padding: EdgeInsets.all(18),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${r['kind']} · ${r['state']}',
                                        style: TextStyle(
                                          color: ink,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      SizedBox(height: 8),
                                      Text(r['reason']),
                                      Text(
                                        r['details'] ?? '',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.black54,
                                        ),
                                      ),
                                      Text(
                                        'From @${r['reporter_name']}',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Colors.black38,
                                        ),
                                      ),
                                      TextButton(
                                        onPressed:
                                            () =>
                                                inspect(r['kind'], r['target']),
                                        child: Text('Inspect reported item'),
                                      ),
                                      if (r['state'] == 'open')
                                        Wrap(
                                          spacing: 9,
                                          children: [
                                            OutlinedButton(
                                              onPressed:
                                                  busy
                                                      ? null
                                                      : () => action(
                                                        'reports/${r['id']}',
                                                        {'state': 'resolved'},
                                                        title:
                                                            'Resolution note',
                                                      ),
                                              child: Text('Resolve'),
                                            ),
                                            TextButton(
                                              onPressed:
                                                  busy
                                                      ? null
                                                      : () => action(
                                                        'reports/${r['id']}',
                                                        {'state': 'dismissed'},
                                                        title: 'Dismissal note',
                                                      ),
                                              child: Text('Dismiss'),
                                            ),
                                          ],
                                        ),
                                      if ((r['note'] ?? '').isNotEmpty)
                                        Text(
                                          r['note'],
                                          style: TextStyle(fontSize: 11),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ] else if (tab == 4) ...[
                            if (rows(data, 'appeals').isEmpty)
                              EmptyCard(
                                icon: Icons.fact_check_outlined,
                                title: 'No appeals awaiting review.',
                                body:
                                    'Listen, review the context, and record a fair decision.',
                              ),
                            ...rows(data, 'appeals').map(
                              (a) => Card(
                                child: Padding(
                                  padding: EdgeInsets.all(19),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '@${a['username']} · ${a['state']}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      SizedBox(height: 10),
                                      Text(a['body']),
                                      Text(
                                        'Account: ${a['status']}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.black45,
                                        ),
                                      ),
                                      if (a['state'] == 'open')
                                        TextButton(
                                          onPressed:
                                              busy
                                                  ? null
                                                  : () => action(
                                                    'appeals/${a['id']}',
                                                    {},
                                                    title:
                                                        'Appeal decision note',
                                                  ),
                                          child: Text('Record review'),
                                        ),
                                      TextButton(
                                        onPressed:
                                            () => inspect('user', a['user']),
                                        child: Text('Inspect account'),
                                      ),
                                      if ((a['note'] ?? '').isNotEmpty)
                                        Text(a['note']),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ] else if (tab == 5) ...[
                            if (api.profile?['role'] == 'owner')
                              RulesForm(
                                api: api,
                                config: Map<String, dynamic>.from(
                                  data['config'] as Map,
                                ),
                                saved: load,
                              )
                            else
                              EmptyCard(
                                icon: Icons.lock_outline,
                                title: 'Owner controls.',
                                body:
                                    'Only the owner can change the platform rules.',
                              ),
                          ],
                          if ([1, 2, 3, 4].contains(tab))
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton(
                                  onPressed:
                                      page == 0
                                          ? null
                                          : () {
                                            page--;
                                            load();
                                          },
                                  child: Text('Previous'),
                                ),
                                Text(
                                  'Page ${page + 1}',
                                  style: TextStyle(fontSize: 11),
                                ),
                                TextButton(
                                  onPressed: () {
                                    page++;
                                    load();
                                  },
                                  child: Text('Next'),
                                ),
                              ],
                            ),
                        ],
                      ],
                    ),
                  ),
        ),
      ],
    ),
  );
}

class RulesForm extends StatefulWidget {
  final Api api;
  final Json config;
  final VoidCallback saved;
  const RulesForm({
    super.key,
    required this.api,
    required this.config,
    required this.saved,
  });
  @override
  State<RulesForm> createState() => _RulesFormState();
}

class _RulesFormState extends State<RulesForm> {
  late Json c;
  late TextEditingController announcement, rules, words, maximum;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    c = {...widget.config};
    announcement = TextEditingController(text: c['announcement']);
    rules = TextEditingController(text: c['rules']);
    words = TextEditingController(text: c['blockedWords']);
    maximum = TextEditingController(text: '${c['maxPostsPerDay']}');
  }

  @override
  void dispose() {
    for (final t in [announcement, rules, words, maximum]) {
      t.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Shape your community.',
        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: ink),
      ),
      SizedBox(height: 15),
      ...{
        'registrationOpen': 'Accept new members',
        'postingOpen': 'Allow sharing and comments',
        'reviewNewPosts': 'Review member posts before publishing',
      }.entries.map(
        (e) => SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(e.value, style: TextStyle(fontSize: 13)),
          value: c[e.key] == true,
          onChanged: busy ? null : (v) => setState(() => c[e.key] = v),
        ),
      ),
      SizedBox(height: 15),
      TextField(
        controller: announcement,
        maxLength: 300,
        maxLines: 3,
        decoration: InputDecoration(labelText: 'Community announcement'),
      ),
      SizedBox(height: 13),
      TextField(
        controller: maximum,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          labelText: 'Daily posts per member · 1–100',
        ),
      ),
      SizedBox(height: 18),
      TextField(
        controller: words,
        maxLength: 2000,
        maxLines: 3,
        decoration: InputDecoration(
          labelText: 'Blocked phrases · comma separated',
        ),
      ),
      SizedBox(height: 13),
      TextField(
        controller: rules,
        maxLength: 5000,
        maxLines: 10,
        decoration: InputDecoration(labelText: 'Community rules'),
      ),
      SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed:
              busy
                  ? null
                  : () async {
                    final reason = await reasonDialog(
                      context,
                      'Why are you changing these rules?',
                    );
                    if (reason == null) return;
                    setState(() => busy = true);
                    try {
                      await widget.api.call(
                        'office/settings',
                        method: 'POST',
                        data: {
                          ...c,
                          'announcement': announcement.text,
                          'blockedWords': words.text,
                          'rules': rules.text,
                          'maxPostsPerDay': int.tryParse(maximum.text) ?? 0,
                          'reason': reason,
                        },
                      );
                      widget.saved();
                      if (mounted)
                        notice(context, 'Your community rules are updated.');
                    } catch (e) {
                      if (mounted) notice(context, e);
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  },
          child: Text(busy ? 'Saving…' : 'Save platform rules'),
        ),
      ),
    ],
  );
}
