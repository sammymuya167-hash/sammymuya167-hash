import numpy as np
from scipy.linalg import lu_factor, lu_solve

# The same coefficient matrix is reused for several measurement vectors.
A = np.array([
    [4.0, -1.0, 0.0],
    [-1.0, 4.0, -1.0],
    [0.0, -1.0, 3.0]
])

measurement_sets = [
    np.array([15.0, 10.0, 10.0]),
    np.array([16.0, 11.0, 9.0]),
    np.array([14.0, 12.0, 11.0])
]

# Factor A only once
lu, piv = lu_factor(A)

for i, b in enumerate(measurement_sets, start=1):
    x = lu_solve((lu, piv), b)
    residual = b - A @ x

    print(f"Measurement set {i}")
    print("Solution:", x)
    print("Residual norm:", np.linalg.norm(residual))
    print()

# Direct solution for comparison
print(
    "Direct solution for first set:",
    np.linalg.solve(A, measurement_sets[0])
)