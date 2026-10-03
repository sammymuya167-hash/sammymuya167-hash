"""Generate the three reproducible portfolio reports from synthetic data."""
import argparse
import json
from pathlib import Path
from common import page, write_json
from support_desk.desk import Desk
from security_triage.triage import analyze, load_events, report as triage_report
from network_audit.audit import audit, report as network_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="demo-output")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    database = output / "support.db"
    if database.exists():
        parser.error("Demo database already exists. Choose a new output folder to preserve existing data.")
    desk = Desk(database)
    try:
        desk.asset("DEMO-LAP-001", "Synthetic staff laptop", "Demo reception")
        ticket = desk.create("Staff laptop cannot connect to Wi-Fi", "Demo reception", "P2", "2026-10-03T07:00:00Z", "Demo operator", "DEMO-LAP-001")
        desk.transition(ticket, "in_progress", "2026-10-03T07:15:00Z", "Demo operator", "Checked adapter status and approved network settings.")
        desk.transition(ticket, "resolved", "2026-10-03T08:00:00Z", "Demo operator", "Restored configured connection and confirmed access with the requester.")
        ticket = desk.create("Conference display signal drops", "Demo events team", "P1", "2026-10-03T09:00:00Z", "Demo operator")
        desk.transition(ticket, "in_progress", "2026-10-03T09:10:00Z", "Demo operator", "Testing cable and source output.")
        desk.transition(ticket, "waiting", "2026-10-03T10:00:00Z", "Demo operator", "Replacement cable required; escalation recorded.")
        (output / "support.html").write_text(desk.report("2026-10-03T15:00:00Z"), encoding="utf-8")
        write_json(output / "support.json", desk.snapshot("2026-10-03T15:00:00Z"))
    finally:
        desk.close()
    samples = Path(__file__).parent / "sample_data"
    events, errors = load_events(samples / "auth_events.jsonl")
    triage = {"valid_events": len(events), "errors": errors, "findings": analyze(events)}
    write_json(output / "security.json", triage)
    (output / "security.html").write_text(triage_report(triage), encoding="utf-8")
    network = audit(json.loads((samples / "network_inventory.json").read_text(encoding="utf-8")))
    write_json(output / "network.json", network)
    (output / "network.html").write_text(network_report(network), encoding="utf-8")
    links = '<section><h2>Inspect the demonstrations</h2><ul><li><a href="support.html">Support desk handover</a></li><li><a href="security.html">Authentication investigation queue</a></li><li><a href="network.html">Network inventory findings</a></li></ul></section>'
    (output / "index.html").write_text(page("IT operations and security portfolio", "Three local demonstrations with reproducible, synthetic examples. Explore the reports and inspect the source on GitHub.", links), encoding="utf-8")
    print(json.dumps({"support_tickets": 2, "security_findings": len(triage["findings"]), "network_findings": len(network["findings"]), "output": str(output)}))


if __name__ == "__main__":
    main()
