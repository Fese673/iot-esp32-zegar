#include <WiFi.h>
#include <WiFiUdp.h>
#include <NTPClient.h>

// Replace with your network credentials
const char* ssid = "your_SSID";
const char* password = "your_PASSWORD";

// NTP server details
const char* ntpServer = "pool.ntp.org";
const long utcOffsetInSeconds = 3600; // Adjust for your timezone

// Create a WiFiUDP instance
WiFiUDP udp;

// Create an NTPClient instance
NTPClient timeClient(udp, ntpServer, utcOffsetInSeconds);

void setup() {
  // Start the Serial communication
  Serial.begin(115200);
  
  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  // Start the NTP client
  timeClient.begin();
}

void loop() {
  // Update the NTP client
  timeClient.update();

  // Print the current time
  Serial.println(timeClient.getFormattedTime());

  // Wait for a minute before fetching the time again
  delay(60000);
}