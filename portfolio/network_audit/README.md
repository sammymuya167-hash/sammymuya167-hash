# Network Configuration Audit

Review a JSON export of device addresses, gateways and intended zones without accessing the network.

```bash
python3 -m network_audit.audit sample_data/network_inventory.json --output audit.json --html audit.html
```

Each record contains `device`, `address` (IPv4 CIDR), `gateway` (IPv4) and `zone`. The tool reports duplicate device names, duplicate IP addresses, malformed records, gateways outside their device subnet, device/gateway address collisions, network/broadcast addresses, and different zones sharing a subnet.

IPv4 `/31` and `/32` records are allowed for point-to-point/host-route use, so traditional network/broadcast rules apply only through `/30`. Correct routing and platform-specific behavior still require manual verification. Duplicate IP findings assume a single routing domain; overlapping tenant networks need separate context. A shared subnet warning cannot establish whether VLANs or firewalls isolate traffic. IPv6 is outside this project's scope.
