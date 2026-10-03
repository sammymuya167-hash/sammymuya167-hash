"""Review an exported inventory without contacting any devices."""
import argparse
from collections import defaultdict
import ipaddress
import json
from pathlib import Path
from common import page, table, write_json


def audit(records):
    if not isinstance(records, list):
        raise ValueError("Inventory must be an array")
    findings, parsed = [], []
    names = set()

    def add(device, rule, severity, detail):
        findings.append({"device": device, "rule": rule, "severity": severity, "detail": detail})

    for position, item in enumerate(records, 1):
        name = f"record-{position}"
        try:
            if not isinstance(item, dict):
                raise ValueError("Record must be an object")
            name = item["device"]
            if not isinstance(name, str) or not name.strip():
                raise ValueError("Device must be a nonempty string")
            if name in names:
                add(name, "duplicate_device", "medium", "Device name appears more than once.")
            names.add(name)
            interface = ipaddress.IPv4Interface(item["address"])
            gateway = ipaddress.IPv4Address(item["gateway"])
            zone = item["zone"]
            if not isinstance(zone, str) or not zone.strip():
                raise ValueError("Zone must be a nonempty string")
            network = interface.network
            parsed.append((name, interface, zone))
            if gateway not in network:
                add(name, "gateway_outside_subnet", "high", f"Gateway {gateway} is outside {network}.")
            if gateway == interface.ip:
                add(name, "gateway_is_device", "high", "The gateway and device share the same IP address.")
            if network.prefixlen <= 30:
                if interface.ip in (network.network_address, network.broadcast_address):
                    add(name, "unusable_host_address", "high", f"Device uses a network or broadcast address in {network}.")
                if gateway in (network.network_address, network.broadcast_address):
                    add(name, "unusable_gateway", "high", f"Gateway uses a network or broadcast address in {network}.")
        except (KeyError, ValueError, TypeError, AttributeError) as error:
            add(str(name), "invalid_record", "high", str(error))

    by_ip, by_network = defaultdict(list), defaultdict(list)
    for name, interface, zone in parsed:
        by_ip[str(interface.ip)].append(name)
        by_network[str(interface.network)].append((name, zone))
    for address, devices in by_ip.items():
        if len(devices) > 1:
            add(", ".join(devices), "duplicate_ip", "high", f"Address {address} appears on multiple inventory records.")
    for network, members in by_network.items():
        zones = sorted({zone for _, zone in members})
        if len(zones) > 1:
            add(", ".join(name for name, _ in members), "shared_subnet_zones", "medium",
                f"Zones {', '.join(zones)} share {network}. Review the intended VLAN/routing design; an inventory alone cannot verify isolation.")
    return {"records": len(records), "valid_records": len(parsed), "findings": findings}


def report(result):
    rows = table(["Device", "Severity", "Check", "Explanation"],
                 [[x["device"], x["severity"], x["rule"], x["detail"]] for x in result["findings"]])
    return page("Network configuration audit", f"Reviewed {result['records']} exported records; {result['valid_records']} parsed successfully. Offline configuration checks only.",
                f"<section><h2>Findings</h2>{rows}</section><section><h2>Interpretation</h2><p>Validate findings against approved diagrams and device configurations before changing anything. No live connectivity or segmentation test was performed.</p></section>")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("--output", required=True)
    parser.add_argument("--html", required=True)
    args = parser.parse_args()
    result = audit(json.loads(Path(args.input).read_text(encoding="utf-8")))
    write_json(args.output, result)
    Path(args.html).write_text(report(result), encoding="utf-8")
    print(json.dumps({"records": result["records"], "findings": len(result["findings"])}))


if __name__ == "__main__":
    main()
