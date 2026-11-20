import numpy as np

# Financial calculations and floating-point errors

print("FINANCIAL CALCULATIONS")
print("----------------------")

# Calculate a total using floating-point arithmetic
price = 0.10
quantity = 3

calculated_total = price * quantity
expected_total = 0.30

print(f"Price per item: {price:.2f}")
print(f"Quantity: {quantity}")
print(f"Calculated total: {calculated_total:.17f}")
print(f"Expected total: {expected_total:.17f}")

# Compare the calculated and expected totals
print(
    "Exact comparison:",
    calculated_total == expected_total
)

print(
    "Tolerance-based comparison:",
    np.isclose(calculated_total, expected_total)
)

# Demonstrate absolute and relative error
true_amount = 100.00
approximate_amount = 99.95

absolute_error = abs(true_amount - approximate_amount)
relative_error = absolute_error / abs(true_amount)

print(f"True amount: {true_amount:.2f}")
print(f"Approximate amount: {approximate_amount:.2f}")
print(f"Absolute error: {absolute_error:.2f}")
print(f"Relative error: {relative_error:.6f}")
print(f"Percentage error: {relative_error:.2%}")