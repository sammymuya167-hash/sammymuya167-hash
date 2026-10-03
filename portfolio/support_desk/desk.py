"""SQLite ticket tracking with explicit status transitions and an audit trail."""
import argparse
from datetime import timedelta
import json
from pathlib import Path
import sqlite3
from common import iso, page, table, utc

TARGET_HOURS = {"P1": 4, "P2": 8, "P3": 24, "P4": 72}
TRANSITIONS = {"open": {"in_progress"}, "in_progress": {"waiting", "resolved"},
               "waiting": {"in_progress", "resolved"}, "resolved": {"in_progress"}}


class Desk:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY, description TEXT NOT NULL, location TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY, title TEXT NOT NULL, requester TEXT NOT NULL,
            priority TEXT NOT NULL CHECK(priority IN ('P1','P2','P3','P4')),
            status TEXT NOT NULL CHECK(status IN ('open','in_progress','waiting','resolved')),
            created_at TEXT NOT NULL, due_at TEXT NOT NULL, resolved_at TEXT,
            asset_id TEXT REFERENCES assets(id));
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id),
            at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL);
        ''')

    def close(self):
        self.db.close()

    def asset(self, asset_id, description, location):
        if not all(str(x).strip() for x in (asset_id, description, location)):
            raise ValueError("Asset fields must not be blank")
        with self.db:
            self.db.execute("INSERT INTO assets VALUES (?,?,?)", (asset_id, description, location))

    def create(self, title, requester, priority, at, actor, asset_id=None):
        if priority not in TARGET_HOURS:
            raise ValueError("Unknown priority")
        if not all(str(x).strip() for x in (title, requester, actor)):
            raise ValueError("Title, requester and actor are required")
        stamp = utc(at)
        due = stamp + timedelta(hours=TARGET_HOURS[priority])
        with self.db:
            cursor = self.db.execute('''INSERT INTO tickets
            (title,requester,priority,status,created_at,due_at,asset_id)
            VALUES (?,?,?,'open',?,?,?)''', (title, requester, priority, iso(stamp), iso(due), asset_id))
            ticket_id = cursor.lastrowid
            self.db.execute("INSERT INTO events(ticket_id,at,actor,action,note) VALUES (?,?,?,?,?)",
                            (ticket_id, iso(stamp), actor, "created", title))
        return ticket_id

    def transition(self, ticket_id, status, at, actor, note):
        if not actor.strip() or not note.strip():
            raise ValueError("Actor and a meaningful note are required")
        stamp = utc(at)
        with self.db:
            current = self.db.execute("SELECT * FROM tickets WHERE id=?", (ticket_id,)).fetchone()
            if current is None:
                raise ValueError("Ticket does not exist")
            if status not in TRANSITIONS[current["status"]]:
                raise ValueError(f"Invalid transition: {current['status']} -> {status}")
            latest = self.db.execute("SELECT at FROM events WHERE ticket_id=? ORDER BY id DESC LIMIT 1", (ticket_id,)).fetchone()
            if stamp < utc(latest["at"]):
                raise ValueError("Events cannot precede the latest ticket event")
            self.db.execute("UPDATE tickets SET status=?,resolved_at=? WHERE id=?",
                            (status, iso(stamp) if status == "resolved" else None, ticket_id))
            self.db.execute("INSERT INTO events(ticket_id,at,actor,action,note) VALUES (?,?,?,?,?)",
                            (ticket_id, iso(stamp), actor, f"{current['status']} -> {status}", note))

    def snapshot(self, at):
        stamp = utc(at)
        result = []
        for row in self.db.execute("SELECT * FROM tickets ORDER BY due_at,id"):
            item = dict(row)
            item["overdue"] = item["status"] != "resolved" and stamp > utc(item["due_at"])
            item["resolution_within_target"] = (utc(item["resolved_at"]) <= utc(item["due_at"])) if item["resolved_at"] else None
            result.append(item)
        return result

    def report(self, at):
        rows = self.snapshot(at)
        events = [dict(row) for row in self.db.execute("SELECT * FROM events ORDER BY id")]
        tickets = table(["ID", "Request", "Priority", "Status", "Asset", "Due UTC", "Target"],
                        [[r["id"], r["title"], r["priority"], r["status"], r["asset_id"] or "-", r["due_at"],
                          "Overdue" if r["overdue"] else ("Met" if r["resolution_within_target"] else "Missed" if r["resolution_within_target"] is False else "Within target")]
                         for r in rows])
        audit = table(["Ticket", "UTC", "Actor", "Change", "Note"],
                      [[e["ticket_id"], e["at"], e["actor"], e["action"], e["note"]] for e in events])
        return page("Support desk operations", f"Snapshot at {iso(at)}. Targets are demonstration policy: P1 4h, P2 8h, P3 24h and P4 72h. Waiting time continues to count.",
                    f"<section><h2>Tickets and equipment</h2>{tickets}</section><section><h2>Audit history</h2>{audit}</section>")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--at", required=True, help="Timezone-aware ISO timestamp")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    desk = Desk(args.database)
    try:
        Path(args.report).write_text(desk.report(args.at), encoding="utf-8")
    finally:
        desk.close()


if __name__ == "__main__":
    main()
