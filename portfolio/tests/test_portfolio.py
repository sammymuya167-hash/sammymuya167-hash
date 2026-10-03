import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from common import utc
from support_desk.desk import Desk
from security_triage.triage import analyze, load_events, report as triage_report
from network_audit.audit import audit, report as network_report


class SupportDeskTests(unittest.TestCase):
    def setUp(self):
        self.desk = Desk(":memory:")

    def tearDown(self):
        self.desk.close()

    def ticket(self, title="Connection issue", priority="P2"):
        return self.desk.create(title, "Demo user", priority, "2026-10-03T07:00:00Z", "Operator")

    def test_targets_and_waiting_time(self):
        ticket = self.ticket()
        self.desk.transition(ticket, "in_progress", "2026-10-03T07:10:00Z", "Operator", "Investigating")
        self.desk.transition(ticket, "waiting", "2026-10-03T08:00:00Z", "Operator", "Replacement required")
        self.assertFalse(self.desk.snapshot("2026-10-03T15:00:00Z")[0]["overdue"])
        self.assertTrue(self.desk.snapshot("2026-10-03T15:00:01Z")[0]["overdue"])

    def test_invalid_transition_is_atomic(self):
        ticket = self.ticket()
        with self.assertRaises(ValueError):
            self.desk.transition(ticket, "resolved", "2026-10-03T08:00:00Z", "Operator", "No direct close")
        self.assertEqual(self.desk.snapshot("2026-10-03T09:00:00Z")[0]["status"], "open")
        self.assertEqual(self.desk.db.execute("SELECT count(*) FROM events").fetchone()[0], 1)

    def test_asset_foreign_key_rolls_back(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.desk.create("Missing equipment", "Demo", "P2", "2026-10-03T07:00:00Z", "Operator", "unknown")
        self.assertEqual(self.desk.db.execute("SELECT count(*) FROM tickets").fetchone()[0], 0)

    def test_resolved_and_reopened_target(self):
        ticket = self.ticket()
        self.desk.transition(ticket, "in_progress", "2026-10-03T07:01:00Z", "Operator", "Assigned")
        self.desk.transition(ticket, "resolved", "2026-10-03T08:00:00Z", "Operator", "Confirmed")
        self.assertTrue(self.desk.snapshot("2026-10-04T09:00:00Z")[0]["resolution_within_target"])
        self.desk.transition(ticket, "in_progress", "2026-10-04T09:00:00Z", "Operator", "Problem recurred")
        row = self.desk.snapshot("2026-10-04T09:00:00Z")[0]
        self.assertIsNone(row["resolved_at"])
        self.assertTrue(row["overdue"])
        self.assertEqual(row["due_at"], "2026-10-03T15:00:00Z")

    def test_backdated_event_is_rejected(self):
        ticket = self.ticket()
        with self.assertRaises(ValueError):
            self.desk.transition(ticket, "in_progress", "2026-10-03T06:59:00Z", "Operator", "Backdated")

    def test_report_escapes_text_and_sql_is_data(self):
        self.ticket("<script>alert(1)</script>'; DROP TABLE tickets; --")
        report = self.desk.report("2026-10-03T10:00:00Z")
        self.assertNotIn("<script>", report)
        self.assertIn("&lt;script&gt;", report)
        self.assertEqual(len(self.desk.snapshot("2026-10-03T10:00:00Z")), 1)

    def test_unknown_priority_and_naive_time(self):
        with self.assertRaises(ValueError):
            self.ticket(priority="P9")
        with self.assertRaises(ValueError):
            utc("2026-10-03T10:00:00")


class SecurityTriageTests(unittest.TestCase):
    def events(self, offsets, user="demo", outcome="failure"):
        return [{"timestamp": f"2026-10-03T09:{seconds // 60:02}:{seconds % 60:02}Z", "source_ip": "192.0.2.1", "user": user, "outcome": outcome, "line": index + 1} for index, seconds in enumerate(offsets)]

    def test_boundary_is_inclusive(self):
        self.assertEqual(len(analyze(self.events([0, 60, 120, 180, 300]))), 1)
        self.assertEqual(len(analyze(self.events([0, 60, 120, 180, 301]))), 0)

    def test_out_of_order_and_alert_suppression(self):
        findings = analyze(list(reversed(self.events([0, 20, 40, 60, 80, 100, 120]))))
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["failure_count"], 5)

    def test_success_requires_same_user_and_clears_evidence(self):
        failures = self.events([0, 20, 40, 60, 80])
        other_success = self.events([90], user="other", outcome="success")[0]
        other_success["line"] = 6
        self.assertEqual(len(analyze(failures + [other_success])), 1)
        success = self.events([100], outcome="success")[0]
        success["line"] = 7
        second = self.events([110], outcome="success")[0]
        second["line"] = 8
        self.assertEqual([x["rule"] for x in analyze(failures + [other_success, success, second])], ["failure_burst", "success_after_failures"])

    def test_expired_failures_do_not_raise_success_alert(self):
        failures = self.events([0, 20, 40, 60, 80])
        success = self.events([500], outcome="success")[0]
        self.assertEqual(len(analyze(failures + [success])), 1)

    def test_bad_records_and_ip_normalization(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "logs.jsonl"
            valid = {"timestamp": "2026-10-03T12:00:00+03:00", "source_ip": "2001:0db8:0:0:0:0:0:1", "user": "demo", "outcome": "failure"}
            path.write_text(json.dumps(valid) + "\nnot json\n" + json.dumps({**valid, "outcome": "unknown"}) + "\n", encoding="utf-8")
            events, errors = load_events(path)
            self.assertEqual(len(events), 1)
            self.assertEqual(len(errors), 2)
            self.assertEqual(events[0]["source_ip"], "2001:db8::1")
            self.assertEqual(events[0]["timestamp"], "2026-10-03T09:00:00Z")

    def test_security_report_escapes_account_names(self):
        result = {"valid_events": 5, "errors": [], "findings": analyze(self.events([0, 20, 40, 60, 80], user="<img src=x onerror=alert(1)>"))}
        rendered = triage_report(result)
        self.assertNotIn("<img", rendered)
        self.assertIn("&lt;img", rendered)


class NetworkAuditTests(unittest.TestCase):
    def record(self, **updates):
        return {"device": "demo-device", "address": "10.0.0.20/24", "gateway": "10.0.0.1", "zone": "staff", **updates}

    def rules(self, records):
        return {x["rule"] for x in audit(records)["findings"]}

    def test_valid_inventory_is_clean(self):
        self.assertEqual(audit([self.record()])["findings"], [])

    def test_duplicates_and_zone_warning(self):
        rules = self.rules([self.record(), self.record(device="guest-device", zone="guest")])
        self.assertEqual(rules, {"duplicate_ip", "shared_subnet_zones"})

    def test_gateway_and_host_validation(self):
        self.assertIn("gateway_outside_subnet", self.rules([self.record(gateway="10.1.0.1")]))
        self.assertIn("gateway_is_device", self.rules([self.record(gateway="10.0.0.20")]))
        self.assertIn("unusable_host_address", self.rules([self.record(address="10.0.0.255/24")]))
        self.assertIn("unusable_gateway", self.rules([self.record(gateway="10.0.0.0")]))

    def test_point_to_point_has_no_broadcast_false_positive(self):
        self.assertEqual(audit([self.record(address="10.0.0.0/31", gateway="10.0.0.1")])["findings"], [])

    def test_invalid_record_does_not_stop_other_records(self):
        result = audit([self.record(address="bad"), self.record(device="valid-device")])
        self.assertEqual(result["valid_records"], 1)
        self.assertEqual(result["findings"][0]["rule"], "invalid_record")

    def test_network_report_escapes_device_names(self):
        rendered = network_report(audit([self.record(device="<script>bad</script>", address="bad")]))
        self.assertNotIn("<script>", rendered)
        self.assertIn("&lt;script&gt;", rendered)


if __name__ == "__main__":
    unittest.main()
