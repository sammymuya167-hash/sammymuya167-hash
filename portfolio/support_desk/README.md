# Support Desk Operations

A local demonstration of request management, equipment traceability and service targets. It stores tickets and audit events in SQLite and exports a readable HTML handover report.

## Design

- Ticket priorities map to documented elapsed-hour resolution targets.
- Tickets move through open, in progress, waiting and resolved states. A reopened ticket keeps its original target; reopening does not silently reset the clock.
- Foreign keys enforce valid equipment references. Ticket changes and audit events share one transaction.
- Status updates require an actor, explanatory note and chronological timestamp.
- All report cells are escaped to keep text from becoming executable HTML.

Run the sample from the portfolio root:

```bash
python3 demo.py --output demo-output
python3 -m support_desk.desk --database demo-output/support.db --at 2026-10-03T15:00:00Z --report handover.html
```

The API also supports creating assets/tickets and recording transitions, as demonstrated in `demo.py` and the tests. This is a CLI/library demonstration, not a hosted multi-user help desk. It has no authentication or authorization boundary. An administrator with database access can alter the audit table; it is not cryptographically tamper-proof. Targets do not implement business calendars or paused SLA clocks.
