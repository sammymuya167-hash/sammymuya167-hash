# Project case studies

## 1. Support Desk Operations

**Problem.** A support team needs to see what is open, which equipment is affected and what changed during a handover.

**Implementation.** SQLite holds linked asset, ticket and event records. A controlled status workflow requires an operator and note for every change. Service targets are based on ticket priority, and an HTML report exposes open requests, overdue work and the audit history.

**Demonstration.** A laptop connectivity request is resolved within its target. An event-display fault moves to waiting while its target continues to run. The snapshot shows the second request as overdue rather than hiding waiting time. These records are fictional examples, not employer performance figures.

**Tradeoffs.** Elapsed-hour targets make the policy easy to verify. Real teams may need business calendars, paused clocks, permissions and escalation schedules. This implementation deliberately remains local and has no authenticated users.

**Next engineering step.** Add an authenticated API, role-based permissions and SLA calendars while preserving atomic audit writes.

## 2. Authentication Log Triage

**Problem.** Failed and successful sign-ins must be examined together, and findings need evidence that another person can check.

**Implementation.** A JSONL parser validates timestamp, account, outcome and source IP. UTC normalization and chronological sorting support consistent rolling windows. Rules identify a failure burst and a later success for the same account/source. Findings retain original line numbers. Invalid input is reported separately.

**Demonstration.** Five synthetic failures from a documentation-range IP generate a medium-priority investigation; a later successful authentication for the same account produces a high-priority review item. An invalid IP is rejected. This does not prove a compromise or simulate a penetration test.

**Tradeoffs.** Shared IP addresses can aggregate unrelated accounts. This is an explainable rule engine, not machine learning or a SIEM. Sorting loads data into memory, so production ingestion would require stream processing and retention controls.

**Next engineering step.** Add environment-specific thresholds, allowlist governance and documented case-management decisions.

## 3. Network Configuration Audit

**Problem.** Address conflicts and incorrect gateways can be found in an inventory before technicians change live equipment.

**Implementation.** Python's `ipaddress` validates IPv4/CIDR values and subnet membership. Checks flag duplicate IPs/device names, invalid host/gateway values and intended zones sharing a subnet. The JSON report supports downstream processing; the HTML report supports a human review.

**Demonstration.** The fictional sample exposes a duplicate address, an out-of-subnet gateway, a broadcast host address and a shared-subnet zone warning. No host is scanned and no configuration is changed.

**Tradeoffs.** A configuration export cannot prove reachability, VLAN isolation or firewall effectiveness. Multiple routing domains require scope metadata to distinguish legitimate overlapping addresses.

**Next engineering step.** Add routing-domain identifiers and an approved read-only configuration importer.

## Evidence standards

Run the test suite and demo commands from the README. The committed example reports are generated from the supplied fictional records. Test totals refer to this repository's verification, not years of experience, client counts or security incidents handled.

Primary technical references: [Python sqlite3](https://docs.python.org/3/library/sqlite3.html), [Python ipaddress](https://docs.python.org/3/library/ipaddress.html), [datetime](https://docs.python.org/3/library/datetime.html), [html.escape](https://docs.python.org/3/library/html.html#html.escape).
