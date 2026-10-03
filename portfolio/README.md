# Felix K. Ndegwa — IT operations and security portfolio

Three runnable demonstrations connect practical support work with repeatable technical processes. The projects use Python 3.11+ and its standard library, run locally, and include synthetic sample data, tests and inspectable reports.

These are **portfolio demonstrations created in October 2026 with AI-assisted development**. They are not previous employer deployments, independently audited security products, or evidence of commercial cybersecurity work. The author must be able to explain and maintain them before presenting them in a technical interview.

## Projects

| Project | Operational problem | Working features |
| --- | --- | --- |
| [Support Desk Operations](support_desk/) | Requests and equipment changes become hard to trace | SQLite tickets, priority targets, controlled status changes, asset links, append-only application audit events, escaped HTML report |
| [Authentication Log Triage](security_triage/) | Repeated sign-in failures are difficult to investigate by hand | Validated JSONL input, rolling-window detection, success-after-failure flag, evidence records, JSON and HTML output |
| [Network Configuration Audit](network_audit/) | Small inventory mistakes cause avoidable connectivity faults | IPv4 subnet and gateway checks, duplicate address detection, network/broadcast checks, shared-subnet zone warning, JSON and HTML output |

## Run the complete demonstration

```bash
python3 --version                         # Python 3.11 or later
python3 -m unittest discover -s tests -v
python3 demo.py --output demo-output
```

Open `demo-output/index.html` in a browser. No internet access, credentials, API keys or third-party packages are required. Each project can also run separately using its documented command.

## Evidence and interview preparation

- [Project case studies and design decisions](CASE_STUDIES.md)
- [Interview walkthrough and practice tasks](INTERVIEW_GUIDE.md)
- [Security boundaries](SECURITY.md)
- [Example reports](examples/)

## Background

Felix's career record includes IT support at Sarova Hotel, contract support assignments at Ritz-Carlton and JW Marriott, fiber installations with Faiba Mtaani / All Tech Solutions, and technical support at PCEA Marmanet Church. Portfolio code does not imply that these employers used these applications.

## Licence

The code in this directory is provided under the [MIT licence](LICENSE). Sample records are fictional. Do not commit production logs, customer data, internal network diagrams or employer credentials.
