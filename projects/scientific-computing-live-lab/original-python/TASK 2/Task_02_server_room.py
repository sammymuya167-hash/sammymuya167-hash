import numpy as np

# Simulated hourly temperature readings from an IoT sensor
# installed in a computer server room, measured in Celsius.

server_temperatures_c = np.array([
    21.0, 21.5, 22.0, 22.5, 22.0, 23.0,
    23.5, 24.0, 24.5, 25.0, 25.5, 26.0,
    26.5, 27.0, 27.5, 27.0, 26.5, 26.0,
    25.5, 25.0, 24.5, 24.0, 23.5, 23.0
])

# Calculate temperature statistics
mean_temp = np.mean(server_temperatures_c)
min_temp = np.min(server_temperatures_c)
max_temp = np.max(server_temperatures_c)

# Convert all readings to Fahrenheit
server_temperatures_f = 1.8 * server_temperatures_c + 32

# Define an assumed monitoring threshold
threshold = 27.0

# Identify readings at or above the threshold
high_temperature_readings = server_temperatures_c[
    server_temperatures_c >= threshold
]

# Display results
print("SERVER ROOM TEMPERATURE MONITORING")
print("----------------------------------")
print(f"Mean temperature: {mean_temp:.2f} C")
print(f"Minimum temperature: {min_temp:.2f} C")
print(f"Maximum temperature: {max_temp:.2f} C")
print(f"Mean temperature in Fahrenheit: {1.8 * mean_temp + 32:.2f} F")
print(f"Monitoring threshold: {threshold:.2f} C")
print("Readings at or above threshold:",
      high_temperature_readings)
print("Number of high-temperature readings:",
      len(high_temperature_readings))