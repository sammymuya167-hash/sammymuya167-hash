# Authentication Log Triage

An offline defensive analysis tool for authorized JSONL authentication logs. It finds repeated failed sign-ins within a configurable rolling window and highlights subsequent successful authentication for the same user and source.

```bash
python3 -m security_triage.triage sample_data/auth_events.jsonl --output triage.json --html triage.html
```

Each input line must include `timestamp` (timezone-aware ISO 8601), `source_ip` (IPv4 or IPv6), `user` and `outcome` (`failure` or `success`). Rejected records are reported with their line number; valid records continue processing. Inputs are sorted chronologically. Every finding links to evidence line numbers.

Default policy is five failures in 300 seconds, inclusive at the window boundary. Sources are grouped by normalized IP; shared addresses may combine different users. A successful sign-in clears failure evidence for that account at that source. Burst alerts are suppressed for one window to reduce repetition.

There is no scanning, credential collection, blocking, SIEM integration or claim that a flagged sign-in is malicious. Production use would require input-size limits, privacy controls, rotation, streaming storage and tuning against a known environment.
