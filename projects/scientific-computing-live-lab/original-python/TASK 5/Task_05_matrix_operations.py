import numpy as np

# Define matrix A and vector x
A = np.array([
    [1, 2],
    [3, 4]
])

x = np.array([5, 6])

print("MATRIX ALGEBRA AND MATRIX OPERATIONS")
print("------------------------------------")

print("\nMatrix A:")
print(A)

print("\nVector x:")
print(x)

# Matrix-vector multiplication
result = A @ x

print("\nMatrix-vector product Ax:")
print(result)

# Matrix addition
B = np.array([
    [2, 1],
    [1, 2]
])

print("\nMatrix B:")
print(B)

print("\nMatrix addition A + B:")
print(A + B)

# Matrix multiplication
print("\nMatrix multiplication A @ B:")
print(A @ B)

# Determinant of A
det_A = np.linalg.det(A)

print("\nDeterminant of A:")
print(f"{det_A:.2f}")

# Inverse of A
inverse_A = np.linalg.inv(A)

print("\nInverse of A:")
print(inverse_A)

# Verify the inverse
print("\nProduct of A and its inverse:")
print(A @ inverse_A)