# Task 7: Gaussian Elimination and LU Decomposition

## 1. Mathematical Concept

Gaussian elimination transforms a system of linear equations
into an equivalent upper-triangular system by eliminating
unknowns one row at a time.

Back-substitution is then used to calculate the unknown values.

LU decomposition expresses a coefficient matrix as a product
of lower-triangular and upper-triangular matrices.

The program uses SciPy's `lu_factor()` and `lu_solve()`
functions to factor a matrix and solve linear systems.

## 2. Inputs

The coefficient matrix is:

A = [[4, -1, 0],
     [-1, 4, -1],
     [0, -1, 3]]

The program uses three measurement vectors:

b1 = [15, 10, 10]
b2 = [16, 11, 9]
b3 = [14, 12, 11]

The same coefficient matrix is used for every measurement set.

## 3. Mathematical Operations

First, the program factors the coefficient matrix using:

lu, piv = lu_factor(A)

It then calculates each solution using:

x = lu_solve((lu, piv), b)

The residual is calculated using:

Residual = b - A @ x

The residual norm measures the size of the remaining difference.

## 4. Original Program Output

The program calculates a solution for each measurement vector.

The residual norms should be close to zero, allowing for
small floating-point rounding errors.

The program also calculates the first solution using
NumPy's `np.linalg.solve()` for comparison.

## 5. Modified Real-World Application

The modified program represents a simplified network simulation
with three connected components.

The coefficient matrix describes the assumed relationships
between the components.

The measurement vectors represent assumed observed values.

The program estimates the unknown component values by solving
the corresponding system of linear equations.

## 6. Changed Input and Result

The original measurement vectors are used first.

The input is then changed to:

new_measurements = [18, 12, 10]

The program calculates a new solution using the same LU factors.

The estimated values change because the measurement values
have changed.

## 7. Interpretation

LU decomposition is useful when several systems share the
same coefficient matrix but have different measurement vectors.

Factoring the matrix once and reusing the factors avoids
repeating the factorization for every new measurement vector.

The residual norm helps verify the numerical solution.

The network example is an illustrative model and does not
represent actual network measurements.

## 8. Conclusion

Gaussian elimination and LU decomposition are techniques
for solving systems of linear equations.

LU decomposition is particularly useful when the same
coefficient matrix must be reused for multiple systems.