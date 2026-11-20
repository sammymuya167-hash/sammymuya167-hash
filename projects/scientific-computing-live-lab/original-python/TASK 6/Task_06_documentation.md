# Task 6: Solution of Systems of Linear Equations

## 1. Mathematical Concept

A system of linear equations contains two or more equations
with unknown variables.

The equations can be represented in matrix form as:

Ax = b

A contains the coefficients, x contains the unknown values,
and b contains the known results.

The program uses NumPy's `np.linalg.solve()` function to
calculate the unknowns.

## 2. Inputs

The main program uses the equations:

2x + 3y = 8
4x + y = 6

The coefficient matrix is:

A = [[2, 3],
     [4, 1]]

The result vector is:

b = [8, 6]

The server allocation program uses a coefficient matrix
representing CPU and memory usage for two types of servers.

## 3. Mathematical Operations

The program solves:

Ax = b

It then calculates A @ x to verify the solution.

The residual is calculated as:

Residual = b - A @ x

The residual norm measures the size of the difference
between the calculated and original results.

## 4. Main Program Output

The solution is:

x = 1
y = 2

Substituting these values into the equations:

2(1) + 3(2) = 8
4(1) + 2 = 6

Both equations are satisfied.

The residual is zero, indicating that the calculated
solution reproduces the original results.

## 5. Modified Real-World Application

The modified application estimates the numbers of two
types of servers from their CPU and memory requirements.

Type A uses 4 CPU units and 8 GB of memory.
Type B uses 2 CPU units and 12 GB of memory.

Initially, the total usage is 20 CPU units and 72 GB
of memory.

The calculated allocation is:

Type A servers = 3
Type B servers = 4

## 6. Changed Input and Result

The total resource vector was changed from:

b = [20, 72]

to:

b = [24, 80]

The new calculated allocation is:

Type A servers = 4
Type B servers = 4

The results change because the total resource requirements
have changed.

## 7. Interpretation

Systems of linear equations can be used to estimate unknown
quantities from known relationships.

In this example, the equations represent the CPU and memory
requirements of two server types.

The verification step confirms whether the calculated values
satisfy the specified equations.

In practical deployment, server counts must be non-negative
whole numbers, and the resource assumptions must be realistic.

## 8. Conclusion

NumPy's `np.linalg.solve()` provides a direct way to solve
systems of linear equations.

The residual and verification steps help confirm the accuracy
of the calculated solution.
