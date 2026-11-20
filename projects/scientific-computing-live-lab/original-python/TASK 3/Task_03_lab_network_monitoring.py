import numpy as np
import timeit

# Related real-world case: monitoring a computer lab network.
# Simulated latency measurements are in milliseconds.

rng = np.random.default_rng(42)
latency_ms = rng.uniform(5, 250, 100_000)


def loop_version():
    squared_seconds = []

    for value in latency_ms:
        seconds = value / 1000.0
        squared_seconds.append(seconds ** 2)

    return squared_seconds


def vectorized_version():
    seconds = latency_ms / 1000.0
    return seconds ** 2


# Compare execution times
loop_time = timeit.timeit(loop_version, number=1)
vector_time = timeit.timeit(vectorized_version, number=3) / 3

# Perform calculations
squared_latency = vectorized_version()
latency_seconds = latency_ms / 1000.0

# Display results
print("COMPUTER LAB NETWORK MONITORING")
print("--------------------------------")

print(f"Number of simulated readings: {len(latency_ms):,}")
print(f"Minimum latency: {np.min(latency_ms):.2f} ms")
print(f"Maximum latency: {np.max(latency_ms):.2f} ms")
print(f"Mean latency: {np.mean(latency_ms):.2f} ms")

print(
    f"Mean latency in seconds: "
    f"{np.mean(latency_seconds):.6f} s"
)

print("First five squared latency values:", squared_latency[:5])

print(f"Loop time: {loop_time:.4f} s")
print(f"Vectorized time: {vector_time:.4f} s")

print(
    f"Approximate speed-up: "
    f"{loop_time / vector_time:.1f}x"
)