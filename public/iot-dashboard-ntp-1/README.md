# IoT Dashboard NTP

## Overview
The IoT Dashboard NTP project provides a comprehensive solution for managing and displaying time synchronization across IoT devices using Network Time Protocol (NTP). This project includes a server application that handles NTP requests and a client-side dashboard for visualizing the time data.

## Features
- Fetch current time from NTP servers.
- Display synchronized time on a user-friendly dashboard.
- Modular architecture for easy maintenance and scalability.

## Project Structure
```
iot-dashboard-ntp
├── server                # Server-side application
│   ├── src               # Source files
│   │   ├── index.ts      # Entry point of the server
│   │   ├── routes        # Route definitions
│   │   │   └── ntp.ts    # NTP-related routes
│   │   ├── services      # Business logic
│   │   │   └── ntpService.ts # NTP service logic
│   │   └── types         # Type definitions
│   │       └── index.ts  # TypeScript interfaces
│   ├── package.json      # NPM dependencies
│   └── tsconfig.json     # TypeScript configuration
├── public                # Client-side application
│   ├── index.html        # Main HTML file
│   ├── styles.css        # Styles for the dashboard
│   └── app.js            # Client-side JavaScript
├── firmware              # Firmware for ESP32
│   └── esp32
│       ├── main.ino      # Main Arduino sketch
│       └── ntp_module.cpp # NTP module implementation
├── docs                  # Documentation
│   └── README.md         # Project documentation
├── .gitignore            # Git ignore file
└── README.md             # Project overview
```

## Getting Started

### Prerequisites
- Node.js and npm installed on your machine.
- Arduino IDE for firmware development.

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd iot-dashboard-ntp
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Upload the firmware to your ESP32 device using the Arduino IDE.

### Running the Server
To start the server, navigate to the `server` directory and run:
```
npm start
```

### Accessing the Dashboard
Open your web browser and navigate to `http://localhost:3000` to access the IoT Dashboard.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.