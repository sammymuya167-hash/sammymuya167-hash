Task 2: NumPy Arrays and Numerical Computation
1. Original problem

A weather station records 24 hourly temperatures. NumPy is used to store the readings in an array, calculate the mean, minimum and maximum temperatures, and convert the Celsius readings to Fahrenheit.

2. Inputs

The original program uses:

24 hourly temperature readings in Celsius.
A conversion multiplier of 1.8.
A conversion offset of 32.
3. Mathematical operations

The program calculates the arithmetic mean, identifies the minimum and maximum values, and converts Celsius to Fahrenheit using:

$$ F=1.8C+32 $$
4. Input modification and its effect

The first temperature was changed from 18.5°C to 20.5°C. This increased the mean temperature by approximately 0.0833°C. The minimum and maximum remained unchanged, while the first Fahrenheit reading increased by 3.6°F.

5. Modified real-world application

The modified program monitors simulated hourly temperatures in a computer server room. It calculates the mean, minimum and maximum temperatures, converts the readings to Fahrenheit, and identifies readings at or above an assumed monitoring threshold of 27°C.

6. New assumptions
The temperature readings are simulated values from an IoT temperature sensor.
There are 24 readings, representing one reading per hour.
All temperature measurements are recorded in Celsius.
The monitoring threshold is assumed to be 27°C for demonstration purposes.
The program analyses recorded values; it does not connect to a physical sensor or automatically control cooling equipment.
7. Input data

The modified program uses 24 simulated hourly server-room temperatures, ranging from 21°C to 27.5°C.

8. Expected output

The program displays the mean, minimum and maximum temperatures, the mean in Fahrenheit, the monitoring threshold, the readings at or above the threshold, and the number of such readings.

9. Interpretation

The output summarises the server room's temperature conditions over the simulated 24-hour period. Readings at or above the assumed threshold are flagged for attention. This demonstrates how NumPy can help analyse sensor data and identify potentially concerning temperature readings.