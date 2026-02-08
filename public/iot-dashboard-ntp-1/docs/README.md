# IoT Dashboard NTP Module

## Overview
The IoT Dashboard NTP Module is designed to provide accurate time synchronization for IoT devices using the Network Time Protocol (NTP). This module allows devices to connect to NTP servers and retrieve the current time, ensuring that all connected devices maintain consistent time settings.

## Features
- Fetch current time from NTP servers.
- Support for multiple NTP server configurations.
- Easy integration with IoT devices, particularly those using ESP32.
- RESTful API for accessing NTP functionalities.

## Setup Instructions

### Prerequisites
- Node.js and npm installed on your machine.
- An ESP32 development board for firmware deployment.

### Server Setup
1. Navigate to the `server` directory:
   ```
   cd iot-dashboard-ntp/server
   ```
2. Install the required dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```

### Firmware Setup
1. Open the `firmware/esp32/main.ino` file in the Arduino IDE.
2. Ensure that the Wi-Fi credentials are set correctly.
3. Upload the sketch to your ESP32 device.

## Usage
- The server exposes endpoints for fetching the current time and managing NTP configurations. Refer to the API documentation in the `server/src/routes/ntp.ts` file for detailed endpoint information.
- The ESP32 firmware includes logic to connect to the server and retrieve the current time using the NTP module.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.