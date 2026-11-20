import numpy as np

print("TEMPERATURE GRID SIMULATION")
print("----------------------------")

# A simplified grid of four unknown temperatures.
# Each equation represents a relationship between
# a grid point and its neighboring points.

A = np.array([
    [4.0, -1.0, -1.0, 0.0],
    [-1.0, 4.0, 0.0, -1.0],
    [-1.0, 0.0, 4.0, -1.0],
    [0.0, -1.0, -1.0, 4.0]
])

b = np.array([100.0, 80.0, 90.0, 70.0])

# Initial temperature estimates
temperatures = np.zeros(4)

tolerance = 1e-6
max_iterations = 100

for iteration in range(1, max_iterations + 1):
    new_temperatures = np.zeros(4)

    for i in range(len(b)):
        sum_other = (
            np.dot(A[i], temperatures)
            - A[i, i] * temperatures[i]
        )

        new_temperatures[i] = (
            b[i] - sum_other
        ) / A[i, i]

    error = np.linalg.norm(
        new_temperatures - temperatures
    )

    temperatures = new_temperatures

    if error < tolerance:
        break

print(f"Iterations: {iteration}")
print("Estimated grid values:")
print(np.round(temperatures, 4))

print("\nResidual norm:")
print(np.linalg.norm(b - A @ temperatures))

# Change the input measurements
new_b = np.array([110.0, 80.0, 90.0, 70.0])

new_temperatures = np.zeros(4)

for iteration in range(1, max_iterations + 1):
    updated = np.zeros(4)

    for i in range(len(new_b)):
        sum_other = (
            np.dot(A[i], new_temperatures)
            - A[i, i] * new_temperatures[i]
        )

        updated[i] = (
            new_b[i] - sum_other
        ) / A[i, i]

    error = np.linalg.norm(
        updated - new_temperatures
    )

    new_temperatures = updated

    if error < tolerance:
        break

print("\nAfter changing the first measurement:")
print(np.round(new_temperatures, 4))

print("\nNew residual norm:")
print(np.linalg.norm(b * 0 + new_b - A @ new_temperatures))