export interface NTPRequest {
  deviceId: string;
  timestamp: number;
}

export interface NTPResponse {
  deviceId: string;
  currentTime: string;
  offset: number; // Offset from the NTP server time
}

export interface NTPConfig {
  server: string; // NTP server address
  port: number;   // NTP server port
  timeout: number; // Timeout for NTP requests in milliseconds
}