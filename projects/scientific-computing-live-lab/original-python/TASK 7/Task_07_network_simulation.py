import numpy as np
from scipy.linalg import lu_factor, lu_solve

print("NETWORK LOAD SIMULATION")
print("========================")

# Coefficients describing relationships between three components
A = np.array([
    [4.0, -1.0, 0.0],
    [-1.0, 4.0, -1.0],
    [0.0, -1.0, 3.0]
])

# Initial measured values
measurement_sets = [
    np.array([15.0, 10.0, 10.0]),
    np.array([16.0, 11.0, 9.0]),
    np.array([14.0, 12.0, 11.0])
]

# Factor the coefficient matrix once
lu, piv = lu_factor(A)

for i, b in enumerate(measurement_sets, start=1):
    solution = lu_solve((lu, piv), b)

    residual = b - A @ solution

    print(f"\nMeasurement set {i}")
    print("Measured values:", b)
    print("Estimated component values:", np.round(solution, 4))
    print("Residual norm:", f"{np.linalg.norm(residual):.10f}")

# Change the input measurement values
new_measurements = np.array([18.0, 12.0, 10.0])

new_solution = lu_solve((lu, piv), new_measurements)

print("\nAFTER CHANGING THE INPUT")
print("------------------------")
print("New measurements:", new_measurements)
print("New estimated values:", np.round(new_solution, 4))
print(
    "Verification:",
    np.round(A @ new_solution, 4)
)