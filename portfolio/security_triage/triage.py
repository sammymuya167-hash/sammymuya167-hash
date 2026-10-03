"""Flag authentication patterns in authorized, locally supplied JSONL logs."""
import argparse
from collections import defaultdict, deque
from html import escape
import ipaddress
import json
from pathlib import Path
from common import iso, page, table, utc, write_json


def load_events(path):
    events, errors = [], []
    with Path(path).open(encoding="utf-8") as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
                if not isinstance(item, dict):
                    raise ValueError("Record must be an object")
                stamp = utc(item["timestamp"])
                address = str(ipaddress.ip_address(item["source_ip"]))
                outcome = item["outcome"]
                if outcome not in {"failure", "success"}:
                    raise ValueError("Outcome must be failure or success")
                user = item["user"]
                if not isinstance(user, str) or not user.strip():
                    raise ValueError("User must be a nonempty string")
                events.append({"timestamp": iso(stamp), "source_ip": address, "user": user, "outcome": outcome, "line": number})
            except (KeyError, ValueError, TypeError, AttributeError, OverflowError) as error:
                errors.append({"line": number, "error": str(error)})
    return events, errors


def analyze(events, threshold=5, window_seconds=300):
    if threshold < 2 or window_seconds <= 0:
        raise ValueError("Threshold must be at least two and the window must be positive")
    windows = defaultdict(deque)
    last_alert = {}
    findings = []
    for event in sorted(events, key=lambda x: (utc(x["timestamp"]), x["line"])):
        stamp = utc(event["timestamp"])
        address = event["source_ip"]
        queue = windows[address]
        while queue and (stamp - utc(queue[0]["timestamp"])).total_seconds() > window_seconds:
            queue.popleft()
        if event["outcome"] == "failure":
            queue.append(event)
            # Suppress repeated burst alerts for this source during the same window.
            if len(queue) >= threshold and (address not in last_alert or (stamp - last_alert[address]).total_seconds() > window_seconds):
                findings.append({"rule": "failure_burst", "severity": "medium", "source_ip": address,
                                 "timestamp": iso(stamp), "failure_count": len(queue),
                                 "users": sorted({x["user"] for x in queue}), "evidence_lines": [x["line"] for x in queue],
                                 "explanation": f"At least {threshold} failed sign-ins from one source within {window_seconds} seconds. Investigate; shared addresses and user mistakes can produce this pattern."})
                last_alert[address] = stamp
        elif event["outcome"] == "success":
            matching = [x for x in queue if x["user"] == event["user"]]
            if len(matching) >= threshold:
                findings.append({"rule": "success_after_failures", "severity": "high", "source_ip": address,
                                 "timestamp": iso(stamp), "failure_count": len(matching), "users": [event["user"]],
                                 "evidence_lines": [x["line"] for x in matching] + [event["line"]],
                                 "explanation": "Successful authentication followed repeated failures for the same account and source. Verify the account owner and surrounding activity; this is not proof of compromise."})
            # Successful use clears only this account's failed events.
            windows[address] = deque(x for x in queue if x["user"] != event["user"])
    return findings


def report(result):
    findings = table(["Rule", "Severity", "Source", "UTC", "Accounts", "Evidence lines"],
                     [[x["rule"], x["severity"], x["source_ip"], x["timestamp"], ", ".join(x["users"]), str(x["evidence_lines"])] for x in result["findings"]])
    errors = table(["Line", "Validation error"], [[x["line"], x["error"]] for x in result["errors"]])
    notes = "".join(f"<p>{escape(x['explanation'])}</p>" for x in result["findings"])
    return page("Authentication log triage", f"Validated {result['valid_events']} events. Rules flag patterns for review, not confirmed intrusions.",
                f"<section><h2>Investigation queue</h2>{findings}{notes}</section><section><h2>Rejected records</h2>{errors}</section>")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("--threshold", type=int, default=5)
    parser.add_argument("--window-seconds", type=int, default=300)
    parser.add_argument("--output", required=True)
    parser.add_argument("--html", required=True)
    args = parser.parse_args()
    events, errors = load_events(args.input)
    result = {"valid_events": len(events), "errors": errors, "findings": analyze(events, args.threshold, args.window_seconds)}
    write_json(args.output, result)
    Path(args.html).write_text(report(result), encoding="utf-8")
    print(json.dumps({"valid_events": len(events), "rejected_records": len(errors), "findings": len(result["findings"])}))


if __name__ == "__main__":
    main()
