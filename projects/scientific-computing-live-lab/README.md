# Scientific Computing Lab — Interactive Numerical Experiments

**Project presenter:** Margaret Kamau  
**Application:** [Scientific Computing Lab](https://scientific-computing-shadownet.vercel.app/)  
**Platform:** Browser-based scientific computing demonstration  
**Technology:** HTML, CSS, JavaScript, SVG and numerical algorithms

## Project overview

Scientific Computing Lab is an interactive educational application for experimenting with mathematical techniques used in scientific and engineering problem solving. It helps a learner modify model parameters, run calculations and interpret the results using charts, numerical summaries and explanatory notes.

The application includes eight implemented experiments covering array processing, network latency, numerical precision, matrix transformations, simultaneous equations, coupled systems, iterative computation and probability simulation.

## Objectives

1. Demonstrate numerical methods with clear, repeatable computational examples.
2. Visualize the effect of parameter changes on calculated results.
3. Introduce applications of mathematics to networks, infrastructure, graphics and monitoring.
4. Make technical concepts accessible through an interactive browser interface.
5. Distinguish simulated outputs from measurements taken from real devices.

## Implemented experiments

| Task | Topic | What the learner can investigate |
|---|---|---|
| 02 | Server room monitoring | Temperature readings, calibration and alert thresholds |
| 03 | Network latency analysis | Synthetic latency samples, distributions and computation timing |
| 04 | Numerical precision | Floating-point rounding, monetary calculation and estimation errors |
| 05 | Graphics transformations | Scaling and rotating geometry using transformation matrices |
| 06 | Server allocation | Resource planning through simultaneous linear equations |
| 07 | Network load model | Solving three connected linear equations |
| 08 | Temperature grid | Iterative Jacobi method and convergence |
| 20 | Network overload risk | Monte Carlo simulation and estimated overload probability |

The application implements **these eight tasks**. Other numbered tasks present in the accompanying reference materials are not part of the working browser demonstrations.

## How to run

**Online:** Open [the published application](https://scientific-computing-shadownet.vercel.app/).

**Offline:** Download the project directory and open `index.html` in a modern desktop or mobile browser. No package installation, login, database or API key is needed.

1. Choose an experiment from the navigation menu.
2. Adjust the relevant sliders or dropdown selections.
3. Click **Run updated experiment**.
4. Examine the statistics, chart, equations and explanation.
5. Repeat with different values to compare outcomes.

The status indicator shows when parameters have been changed and confirms when a calculation completes.

## System design

The frontend is implemented with semantic HTML, responsive CSS and vanilla JavaScript. Numerical calculations execute in the browser; graphs are rendered with SVG. No external data collection or backend service is involved.

- `index.html`: full interactive application and numerical routines.
- `DOCUMENTATION.md`: detailed methodology, mathematical concepts and usage.
- `TESTING.md`: functional verification and acceptance checklist.
- `ATTRIBUTION.md`: source acknowledgments and provenance information.
- `original-python/`: reference Python exercise files, some of which are placeholders rather than completed implementations.

## Testing and limitations

The eight experiment screens have been browser-tested for navigation, slider changes, calculation buttons and updated results. Task 02 and Task 06 have known-value regression checks; further checks are listed in `TESTING.md`.

**Important:** All network, sensor and capacity datasets are artificial or illustrative. The site is a teaching demonstration, not a live monitoring service or a production engineering decision tool. The browser implementation uses JavaScript rather than executing Python/NumPy directly.

## Documentation and acknowledgments

Read [DOCUMENTATION.md](./DOCUMENTATION.md) for an expanded project explanation, and [ATTRIBUTION.md](./ATTRIBUTION.md) for acknowledgment of the Python coursework reference material. Project presentation is credited to **Margaret Kamau**; this does not imply sole authorship of the original reference code.
