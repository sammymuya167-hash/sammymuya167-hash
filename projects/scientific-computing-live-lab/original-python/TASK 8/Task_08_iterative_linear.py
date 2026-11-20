import numpy as np

# System of linear equations:
# 4x + y + z = 7
# x + 5y + z = -8
# x + y + 6z = 6

A = np.array([
    [4.0, 1.0, 1.0],
    [1.0, 5.0, 1.0],
    [1.0, 1.0, 6.0]
])

b = np.array([7.0, -8.0, 6.0])

# Initial guess
x = np.zeros(3)

tolerance = 1e-6
max_iterations = 100

print("JACOBI ITERATIVE METHOD")
print("-----------------------")

for iteration in range(1, max_iterations + 1):
    new_x = np.zeros(3)

    for i in range(len(b)):
        sum_other = np.dot(A[i], x) - A[i, i] * x[i]
        new_x[i] = (b[i] - sum_other) / A[i, i]

    error = np.linalg.norm(new_x - x)

    x = new_x

    print(
        f"Iteration {iteration}: "
        f"x = {x}, error = {error:.8f}"
    )

    if error < tolerance:
        print("\nConvergence achieved.")
        break

print("\nFinal solution:")
print(np.round(x, 6))

print("\nVerification A @ x:")
print(A @ x)

print("\nResidual norm:")
print(np.linalg.norm(b - A @ x))