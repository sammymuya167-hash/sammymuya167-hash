# Security boundaries

- All samples are synthetic; documentation-range source IPs are used for authentication examples.
- The tools operate on local data. They do not connect to hosts, exploit vulnerabilities, guess passwords or submit employer data anywhere.
- HTML output escapes data fields. SQL writes use bound parameters. These controls do not make the applications suitable for public hosting.
- SQLite has no application authentication, role-based authorization or tamper-resistant audit storage in this demonstration.
- Authentication input is loaded into memory. Use only trusted, reasonably sized exports; production pipelines need file-size limits and managed retention.
- Never publish real customer logs, secrets, private infrastructure details or personal data. Use redacted copies under the relevant owner's authorization.
- Report issues by opening a repository issue with a minimal, fictional reproducer. Do not place credentials or private logs in an issue.
