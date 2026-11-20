# Task 5: Matrix Algebra and Matrix Operations

## 1. Original Problem

The original program demonstrates matrix-vector multiplication,
matrix addition, matrix multiplication, determinants, and matrix
inversion using NumPy.

Matrices organize numerical values into rows and columns.
They are useful in computer graphics, machine learning,
robotics, cryptography, and engineering calculations.

## 2. Inputs

The program uses the following matrices and vector:

Matrix A:

[[1, 2],
 [3, 4]]

Vector x:

[5, 6]

Matrix B:

[[2, 1],
 [1, 2]]

## 3. Mathematical Operations

### A. Matrix-vector multiplication

The operation is:

Ax

For the given values:

Ax = [17, 39]

Each row of matrix A is multiplied by the vector x,
and the results are added.

### B. Matrix addition

The program calculates A + B by adding corresponding elements.

The result is:

[[3, 3],
 [4, 6]]

### C. Matrix multiplication

The program calculates A @ B.

Matrix multiplication combines rows of the first matrix
with columns of the second matrix.

### D. Determinant

For a 2-by-2 matrix:

det(A) = ad - bc

For matrix A:

det(A) = (1 * 4) - (2 * 3) = -2

Since the determinant is nonzero, A is invertible.

### E. Matrix inverse

The inverse satisfies:

A @ inverse(A) = I

where I is the identity matrix.

The result should be approximately the identity matrix.

## 4. Output and Interpretation

The program displays:

- Matrix A.
- Vector x.
- Matrix-vector product Ax.
- Matrix B.
- Matrix addition.
- Matrix multiplication.
- Determinant of A.
- Inverse of A.
- Product of A and its inverse.

The matrix-vector product is [17, 39].

The determinant is approximately -2.

The product of A and its inverse should be approximately
the identity matrix.

## 5. Change One Input and Explain the Effect

Change vector x from:

x = [5, 6]

to:

x = [5, 7]

The new matrix-vector product becomes:

A @ x = [19, 43]

The result changes because the second vector element
increases from 6 to 7.

The matrices A and B remain unchanged, so their addition,
multiplication, determinant, and inverse remain unchanged.

## 6. Related Real-World Application:
## 2D Computer Graphics Transformations

The modified program represents a triangle using three
two-dimensional coordinate points.

It uses matrix multiplication to scale and rotate the triangle.

### New Assumptions

- The object is a triangle with three vertices.
- Each vertex has an x-coordinate and a y-coordinate.
- Scaling doubles both coordinates.
- Rotation is 90 degrees counterclockwise.
- Transformations occur around the origin.

### Input Data

Original triangle coordinates:

[[1, 1],
 [3, 1],
 [2, 3]]

Scaling factor: 2.

Rotation angle: 90 degrees.

### Outputs

The program displays:

- Original triangle coordinates.
- Scaled coordinates.
- Rotated coordinates.
- Determinant of the scaling matrix.

### Interpretation

Scaling doubles the distance of each point from the origin.

Rotation changes the orientation of the triangle without
changing its size after scaling.

The determinant of the scaling matrix is 4, indicating
that the transformation multiplies the triangle's area
by a factor of 4.

