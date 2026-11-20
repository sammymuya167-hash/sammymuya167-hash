import numpy as np

# Solve the simultaneous equations:
# 2x + 3y = 8
# 4x + y = 6

A = np.array([
    [2.0, 3.0],
    [4.0, 1.0]
])

b = np.array([8.0, 6.0])

solution = np.linalg.solve(A, b)

print("SOLUTION OF SYSTEMS OF LINEAR EQUATIONS")
print("---------------------------------------")

print(f"x = {solution[0]:.2f}")
print(f"y = {solution[1]:.2f}")

print("\nVerification A @ solution:")
print(A @ solution)

print("\nOriginal values b:")
print(b)

residual = b - A @ solution

print("\nResidual:")
print(residual)

print("\nResidual norm:")
print(np.linalg.norm(residual))