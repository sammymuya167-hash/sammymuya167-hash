# Scientific Computing Lab — Verification and Regression Checklist

**Project presentation:** Margaret Kamau  
**Live URL:** https://scientific-computing-shadownet.vercel.app/

## Test objectives

Verify that the live site opens without authentication, every interactive module displays results, parameter changes are recognized, and numerical outputs update consistently.

## Core functional checks

| ID | Scenario | Expected result |
|---|---|---|
| T01 | Open the live URL | Lab title, navigation and Task 02 appear without login |
| T02 | Select each of Tasks 02, 03, 04, 05, 06, 07, 08, 20 | Correct title, controls and calculated results |
| T03 | Change a slider value | Status reads SETTINGS CHANGED |
| T04 | Change a dropdown value | New value is accepted; refresh is indicated |
| T05 | Click Run updated experiment | Status reads RUN #n COMPLETE; results refresh |
| T06 | Change Task 02 threshold from 27 to 26 °C at offset 0 | High readings change from 3/24 to 7/24 |
| T07 | Change Task 06 RAM from 72 to 88 GB at CPU 20 | Server counts change from A=3, B=4 to A=2, B=6 |
| T08 | Change Task 05 rotation from 90 to 180 degrees | Transformed triangle and vertices change |
| T09 | Change Task 20 demand variability | Estimated overload risk and graphs update |
| T10 | Use a narrow/mobile screen | Navigation remains usable and calculations can be run |
| T11 | Inspect browser console | No uncaught JavaScript exceptions |
| T12 | Reload the application | Initial experiment reloads and produces results |

## Regression notes

In prior browser checks, all eight tasks opened with calculated outputs. Input and run-button behavior was checked, including the Task 02 and Task 06 reference examples. Those checks are not a substitute for repeating tests after every deployment.

## Interpretation and scope

All measurements and simulated loads are illustrative. Do not describe the results as live sensor readings or real network metrics. The site is a teaching tool, not a validated operations-monitoring product.
