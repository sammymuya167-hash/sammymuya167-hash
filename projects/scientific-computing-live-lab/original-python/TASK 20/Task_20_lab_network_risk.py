import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(42)

# University laboratory network settings
capacity = 800.0
mean_demand = 650.0
std_demand = 100.0
N = 100_000

# Generate random network demand
demand = rng.normal(mean_demand, std_demand, N)

# Check when demand exceeds capacity
overloaded = demand > capacity

overload_probability = overloaded.mean()

print("UNIVERSITY LAB NETWORK RISK ANALYSIS")
print(f"Network capacity: {capacity} Mbps")
print(f"Average demand: {mean_demand} Mbps")
print(f"Estimated overload probability: {overload_probability:.4%}")
print(f"Overload cases: {overloaded.sum()} out of {N}")

# Calculate running probability
running_probability = np.cumsum(overloaded) / np.arange(1, N + 1)

indices = np.unique(
    np.logspace(1, np.log10(N), 200).astype(int)
) - 1

plt.semilogx(
    indices + 1,
    running_probability[indices]
)

plt.xlabel("Number of simulations")
plt.ylabel("Estimated overload probability")
plt.title("Monte Carlo Simulation of University Lab Network Risk")
plt.grid(True)
plt.show()