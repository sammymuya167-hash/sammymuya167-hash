import numpy as np

# Type A uses 4 CPU units and 8 GB memory.
# Type B uses 2 CPU units and 12 GB memory.
# Total usage: 20 CPU units and 72 GB memory.

# x = number of Type A servers
# y = number of Type B servers

A = np.array([
    [4.0, 2.0],
    [8.0, 12.0]
])

b = np.array([20.0, 72.0])

solution = np.linalg.solve(A, b)

residual = b - A @ solution

print("SERVER RESOURCE ALLOCATION")
print("--------------------------")

print(f"Type A servers: {solution[0]:.0f}")
print(f"Type B servers: {solution[1]:.0f}")

print("\nVerification A @ solution:")
print(A @ solution)

print("\nResidual:")
print(residual)

print("\nResidual norm:")
print(np.linalg.norm(residual))