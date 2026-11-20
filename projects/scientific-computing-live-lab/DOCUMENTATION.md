# Scientific Computing Lab — Project Documentation

**Project presenter:** Margaret Kamau  
**Project type:** Scientific computing and numerical methods learning application  
**Live demonstration:** https://scientific-computing-shadownet.vercel.app/

## Abstract

Scientific Computing Lab is a client-side interactive learning environment that applies numerical methods to engineering-oriented examples. It gives learners an accessible way to change input parameters, execute computational algorithms and evaluate numeric and graphical results. Eight interactive modules are provided. Sample data is generated or fixed locally in the browser, enabling repeatable exercises without external services.

## 1. Introduction

Scientific computing combines mathematical models, numerical algorithms and computer programming to study problems that would be difficult to address by manual calculation alone. The lab demonstrates methods applicable to network engineering, IT infrastructure, computer graphics, resource planning and probability.

The demonstration is educational. It does not connect to real network equipment, temperature sensors or organizational databases.

## 2. Problem statement

Numerical algorithms are often introduced through equations and source code without an intuitive visual connection to their outputs. Learners may find it difficult to observe how choices such as thresholds, coefficients, sample sizes and bandwidth capacity change an analysis. This project makes those relationships interactive.

## 3. Objectives

- Explain selected numerical methods using representative practical examples.
- Allow a user to alter inputs and compare calculations.
- Present results through numerical statistics, charts and contextual interpretations.
- Provide a lightweight responsive browser application with no installation requirement.
- Encourage understanding of assumptions, error sources and limitations.

## 4. Scope and supported modules

| Module | Numerical topic | Inputs | Outputs |
|---|---|---|---|
| 02 — Server Room | Arrays, averages, threshold filtering | Warning threshold, calibration offset | Average, peak, warnings and hourly line chart |
| 03 — Network Latency | Samples, transformed arrays, histograms | Sample count, latency warning | Mean latency, warnings, timing comparison and histogram |
| 04 — Numerical Precision | Floating-point and estimation errors | Price, item quantity, estimated amount | Calculated total, absolute and relative error |
| 05 — Graphics | Rotation and scaling matrices | Scale factor, angle | New triangle vertices, graph, determinant |
| 06 — Server Allocation | 2 × 2 simultaneous equations | CPU total, RAM total | Server counts, resource feasibility |
| 07 — Network Load | 3 × 3 linear system | Three input values | Component load estimates, residual norm |
| 08 — Temperature Grid | Jacobi iterative method | Upper-left source input | Four grid estimates, iteration count, convergence graph |
| 20 — Network Overload | Monte Carlo probability estimation | Capacity, mean demand, demand variation, run count | Overload frequency, risk percentage, histogram, convergence trend |

The browser exposes **eight experiments**; tasks not shown in the menu are not represented as completed browser modules.

## 5. Methods and core mathematics

### 5.1 Server room temperature analysis (Task 02)

For readings \(T_1,\ldots,T_n\), the mean is

\[\overline{T}=\frac{1}{n}\sum_{i=1}^{n}T_i\]

A calibrated reading is \(T'_i=T_i+c\), where \(c\) is the chosen offset. The warning count is the number of readings with \(T'_i\geq\tau\), where \(\tau\) is the warning threshold. The implemented example uses 24 hourly sample values.

### 5.2 Network latency (Task 03)

Synthetic millisecond values are generated in a repeatable sequence. The program calculates mean latency and the fraction above a user-defined threshold. It also compares a JavaScript for-loop and typed-array transformation for squared latency values. These are browser computation timings, **not** benchmarks of Python NumPy execution.

### 5.3 Numerical precision (Task 04)

The application compares binary floating-point arithmetic to a cents-based decimal expectation. It demonstrates that a decimal fraction such as 0.1 may not be exactly representable in IEEE-754 binary floating-point. For an estimate \(e\) of a reference value \(r\), absolute error is \(|r-e|\) and percentage relative error is \(100|r-e|/|r|\) for nonzero \(r\). In this module the reference is 100.

### 5.4 Graphics transformations (Task 05)

A 2D point \((x,y)\) is scaled by \(s\) and rotated by an angle \(\theta\):

\[
\begin{bmatrix}x'\\y'\end{bmatrix}
=s\begin{bmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{bmatrix}
\begin{bmatrix}x\\y\end{bmatrix}
\]

The determinant of this combined transformation is \(s^2\), corresponding to its area scale factor.

### 5.5 Server allocation (Task 06)

The model uses two server types. If \(A\) and \(B\) are their counts, the constraints are

\[4A+2B=C,\qquad 8A+12B=R\]

where \(C\) is available CPU units and \(R\) is RAM in GB. The result is checked for nonnegative, whole-number server counts. This is a simple resource exercise, not a complete production scheduler.

### 5.6 Network load system (Task 07)

The model solves the system

\[
\begin{bmatrix}4&-1&0\\-1&4&-1\\0&-1&3\end{bmatrix}
\begin{bmatrix}a\\b\\c\end{bmatrix}
=\begin{bmatrix}m_1\\m_2\\m_3\end{bmatrix}
\]

The browser implementation uses Gaussian elimination with partial pivoting and calculates a residual norm to assess how closely the solution satisfies the equations.

### 5.7 Temperature grid iteration (Task 08)

The Jacobi method updates each unknown using values from the previous iteration:

\[
x_i^{(k+1)}=\frac{1}{a_{ii}}\left(b_i-\sum_{j\neq i}a_{ij}x_j^{(k)}\right)
\]

The implementation models four cells, begins with zero estimates and ends when the Euclidean norm of the iteration change drops below \(10^{-6}\), or after the maximum number of iterations.

### 5.8 Network overload simulation (Task 20)

Demand is sampled from a synthetic normal distribution:

\[D\sim\mathcal{N}(\mu,\sigma^2)\]

For capacity \(C\), a simulated overload occurs when \(D>C\). If \(N_\mathrm{over}\) of \(N\) runs exceed capacity, estimated overload probability is

\[\widehat{P}(D>C)=\frac{N_\mathrm{over}}{N}\]

A deterministic pseudorandom seed makes results reproducible for fixed parameters; outputs are **not forecasts from measured traffic**.

## 6. Technical architecture

The implementation is deliberately lightweight:

1. **Presentation:** HTML and responsive CSS define a sidebar, control panel, metrics cards and plots.
2. **Interaction:** JavaScript event handlers process navigation, slider and select changes, and Run button clicks.
3. **Numerical layer:** Pure JavaScript algorithms compute solutions, simulations and statistics in the client browser.
4. **Visualization:** SVG line plots, bar charts and a four-cell heatmap represent calculated results.
5. **Deployment:** Static files are hosted by Vercel. There is no user sign-in, server-side storage or device telemetry.

The existing application is packaged in a single `index.html` file. This is suitable for a demonstration, although a larger application would benefit from separate modules, automated unit tests and versioned release builds.

## 7. User guide

**Step 1:** Visit https://scientific-computing-shadownet.vercel.app/ in a modern browser.  
**Step 2:** Select one of the eight experiments from the navigation menu.  
**Step 3:** Change a slider or dropdown. The status indicator changes to **SETTINGS CHANGED**.  
**Step 4:** Click **Run updated experiment** to recalculate the outputs.  
**Step 5:** Compare the updated metrics, chart and interpretation to the previous run.

On small screens, the experiment navigation adapts to a horizontal scrolling list.

## 8. Verification examples

- **Task 02:** With threshold 27 °C and offset 0, the sample readings report 3 warnings. Lowering the threshold to 26 °C yields 7 warnings.
- **Task 06:** With CPU 20 and RAM 72, the solution is A=3 and B=4. Changing RAM to 88 changes the result to A=2 and B=6.
- **Task 05:** Rotating by 180° changes the triangle's transformed coordinates.
- **Task 20:** Changing demand variability alters the estimated overload frequency.

Use `TESTING.md` for a systematic interaction and regression checklist.

## 9. Limitations

- Values are simulated, derived from predefined datasets, or generated in the browser.
- No real sensors, networks, server inventories or payment systems are accessed.
- Numerical outputs are illustrative, and practical engineering use would require model calibration and further validation.
- The website implements selected examples in JavaScript, not a Python interpreter.
- Several other exercise files in the accompanying reference materials are placeholders and are not runnable examples.
- No persistent results storage, account system or automated report generation is present.

## 10. Conclusion and possible future improvements

The project demonstrates how interactive tools can make numerical methods easier to learn and evaluate. Possible improvements include validated sample datasets, reproducible test suites, CSV import, exportable experiment reports, richer explanatory plots and optional connection to real monitoring data with appropriate permissions.

## 11. Acknowledgments

**Project presentation:** Margaret Kamau.

The included Python coursework reference materials originate from the public repository [SCIENTIFIC-FOR-COMPUTING2](https://github.com/omondijurgen58-cloud/SCIENTIFIC-FOR-COMPUTING2). Details about the source relationship and the browser implementation are preserved in [ATTRIBUTION.md](./ATTRIBUTION.md). This presentation credit does not assign authorship of the reference materials.
