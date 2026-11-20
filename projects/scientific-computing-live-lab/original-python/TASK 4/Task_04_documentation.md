# Task 4: Floating-Point Arithmetic and Numerical Errors

## 1. Original Problem

The original program demonstrates floating-point representation
errors, absolute error, relative error, and numerical stability.

Computers store floating-point numbers using a finite number of
binary digits. Consequently, some decimal numbers cannot be
represented exactly.

The program demonstrates why numerical comparisons and
mathematical formulas require care.

## 2. Inputs

The original program uses the following values:

- 0.1 and 0.2 for floating-point addition.
- 0.3 as the expected result.
- The square root of 2 as the true value.
- 1.414 as an approximate value for the square root of 2.
- 1e-4, 1e-8, and 1e-12 as small positive values of x.

The modified financial program uses:

- Price per item: 0.10.
- Quantity: 3.
- Expected total: 0.30.
- True amount: 100.00.
- Approximate amount: 99.95.

## 3. Mathematical Operations

### A. Floating-Point Addition

The program calculates:

0.1 + 0.2

It then compares the result with 0.3.

Because floating-point representation is approximate, exact
equality comparisons may not behave as expected.

The function np.isclose() checks whether two values are
sufficiently close within a numerical tolerance.

### B. Absolute Error

Absolute error is calculated using:

Absolute Error = |True Value - Approximate Value|

It measures the magnitude of the difference between the
true and approximate values.

### C. Relative Error

Relative error is calculated using:

Relative Error = Absolute Error / |True Value|

Percentage relative error is calculated using:

Percentage Error = Relative Error * 100%

Relative error expresses the absolute error in relation to the
magnitude of the true value.

### D. Numerical Stability

The program compares two equivalent mathematical expressions:

Direct = (sqrt(1 + x) - 1) / x

Stable = 1 / (sqrt(1 + x) + 1)

For very small positive x, the direct expression may lose
accuracy because of subtraction between nearly equal numbers.

The stable expression reduces this cancellation problem.

## 4. Expected Output and Interpretation

The original program should show that:

- The result of 0.1 + 0.2 may not be represented exactly.
- Exact comparison with 0.3 can return False.
- The tolerance-based comparison should return True.
- The absolute and relative errors are small but nonzero.
- The direct and stable expressions may differ in their final
  digits when x is extremely small.

The exact numerical values depend on floating-point calculations
and the Python environment.

## 5. Change One Input and Explain the Effect

In the original program, change:

approx_value = 1.414

to:

approx_value = 1.4142

The approximate value is now closer to the true value of sqrt(2).

Expected effect:

1. The absolute error decreases.
2. The relative error decreases.
3. The percentage relative error decreases.

This demonstrates that a more accurate approximation generally
produces a smaller numerical error.

## 6. Related Real-World Application:
## Financial Calculations

The modified program demonstrates floating-point arithmetic
using the total price of three items costing 0.10 each.

It compares the calculated total with an expected total and
calculates absolute and relative error for an example amount.

### New Assumptions

- The item price is 0.10 monetary units.
- Three items are purchased.
- The expected total is 0.30 monetary units.
- The example uses floating-point values to demonstrate
  numerical representation.
- The program is an educational example, not a production
  financial accounting system.

### Input Data

- Price per item: 0.10.
- Quantity: 3.
- Expected total: 0.30.
- True amount: 100.00.
- Approximate amount: 99.95.

### Outputs

The program displays:

- Price per item.
- Quantity.
- Calculated total.
- Expected total.
- Exact comparison result.
- Tolerance-based comparison result.
- Absolute error.
- Relative error.
- Percentage error.

### Interpretation

The calculated total demonstrates how decimal values are
handled in floating-point arithmetic.

The tolerance-based comparison checks whether the calculated
total is sufficiently close to the expected total.

Absolute error shows the magnitude of the difference between
the true and approximate amounts.

Relative error shows the size of that difference in relation
to the true amount.

Financial applications requiring exact monetary values should
consider decimal arithmetic or integer minor units.

