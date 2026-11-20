import numpy as np

# Computer graphics: scaling and rotating a 2D object

print("2D COMPUTER GRAPHICS TRANSFORMATIONS")
print("------------------------------------")

# Coordinates of a triangle
points = np.array([
    [1, 1],
    [3, 1],
    [2, 3]
], dtype=float)

print("\nOriginal triangle coordinates:")
print(points)

# Scaling matrix: double the size in both directions
scaling_matrix = np.array([
    [2, 0],
    [0, 2]
])

scaled_points = points @ scaling_matrix.T

print("\nScaled triangle coordinates:")
print(scaled_points)

# Rotation matrix for 90 degrees counterclockwise
angle = np.radians(90)

rotation_matrix = np.array([
    [np.cos(angle), -np.sin(angle)],
    [np.sin(angle),  np.cos(angle)]
])

rotated_points = scaled_points @ rotation_matrix.T

print("\nRotated triangle coordinates:")
print(np.round(rotated_points, 2))

# Calculate the determinant of the scaling matrix
det_scaling = np.linalg.det(scaling_matrix)

print("\nDeterminant of scaling matrix:")
print(f"{det_scaling:.2f}")