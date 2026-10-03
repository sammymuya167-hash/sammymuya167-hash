# Technical interview walkthrough

Use the projects to demonstrate understanding. Do not claim you independently wrote every line or deployed these tools for previous employers. They were developed with AI assistance for this portfolio.

## Prepare a five-minute demonstration

1. Explain a real support problem from your own experience without disclosing employer/customer information.
2. Run `python3 -m unittest discover -s tests -v`.
3. Generate a new sample output with `python3 demo.py --output interview-demo`.
4. Open each HTML report and explain one useful finding.
5. Read the corresponding function and explain its inputs, decision logic and limitations.

## Support desk questions

- Why must the ticket update and audit event be in one transaction?
- What happens if a technician closes a ticket directly from open?
- Does time waiting for equipment pause the target? Why is that policy explicit?
- How would permissions and a business-hours SLA change the design?
- Why can the audit trail still be edited by someone with database access?

Practice: add a new test for a late resolution, then explain why reopening keeps the original due time.

## Security questions

- What evidence makes the failure burst worth investigating?
- Why is a success after failures not proof that an account was compromised?
- How could shared NAT addresses produce a false positive?
- Why normalize timestamps and IP addresses before grouping?
- What happens to malformed lines, expired events and repeated alerts?

Practice: change the threshold, add a different user at the same source and predict the output before running it.

## Network questions

- What is the difference between a host IP, subnet mask and default gateway?
- Why are `/31` links treated differently from ordinary LAN subnets?
- Why can a shared subnet warning not prove a VLAN or firewall problem?
- When are repeated private IP addresses legitimate?
- What would you verify before touching a customer's router configuration?

Practice: fix the sample inventory and show that the findings disappear, then add an invalid gateway and explain the new result.

## Career details to prepare accurately

Know your cybersecurity training title, provider and completion date; the contracting company and exact properties for the Ritz-Carlton/JW Marriott work; the systems used at Sarova; and your genuine notice period. Use the actual facts in interviews and application forms.
