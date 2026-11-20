# Task 8: Iterative Methods for Linear Systems

## 1. Mathematical Concept

Iterative methods solve systems of linear equations by
starting with an initial guess and repeatedly improving
the estimates of the unknown variables.

The Jacobi method calculates new estimates using the values
from the previous iteration.

The process continues until the change between successive
estimates is smaller than a specified tolerance or the
maximum number of iterations is reached.

## 2. Inputs

The original program uses the coefficient matrix:

A = [[4, 1, 1],
     [1, 5, 1],
     [1, 1, 6]]

The result vector is:

b = [7, -8, 6]

The initial guess is:

x = [0, 0, 0]

The tolerance is 0.000001, and the maximum number of
iterations is 100.

## 3. Mathematical Operations

The program repeatedly calculates improved estimates
of the unknown variables.

The error is calculated using the norm of the difference
between successive estimates.

The program stops when the error becomes smaller than
the tolerance or the maximum iteration count is reached.

The residual is calculated using:

Residual = b - A @ x

The residual norm measures the remaining difference
between the calculated and original values.

## 4. Original Program Output

The estimates gradually approach the solution:

x = 1
y = -2
z = 1

The verification step checks whether the calculated
solution satisfies the original system of equations.

The residual norm should be close to zero.

## 5. Modified Real-World Application

The modified application represents a simplified temperature
grid with four unknown grid values.

The coefficient matrix represents assumed relationships
between neighboring grid points.

The measurement vector contains the assumed values used
to calculate the grid estimates.

The Jacobi method repeatedly updates the estimates until
the stopping condition is met.

## 6. Changed Input and Result

The first measurement was changed from 100 to 110.

The program calculates a new set of grid estimates using
the updated measurement vector.

The estimates change because one of the input values has
changed.

## 7. Interpretation

Iterative methods can be useful for large systems of
equations, particularly when direct methods require
substantial computation.

The tolerance determines how small the change between
successive estimates must become before stopping.

A small residual norm indicates that the calculated
solution closely satisfies the equations.

The temperature grid is a simplified mathematical example
and is not a complete physical heat-transfer model.

## 8. Conclusion

The Jacobi method solves linear systems through repeated
updates of the unknown values.

The program demonstrates initial estimates, convergence,
a stopping tolerance, and verification of the final result.