#include <WiFi.h>
#include <WiFiUdp.h>
#include <time.h>

class NTPClient {
public:
    NTPClient(const char* ssid, const char* password, const char* ntpServer = "pool.ntp.org", int timeZone = 0)
        : _ssid(ssid), _password(password), _ntpServer(ntpServer), _timeZone(timeZone) {
        _udp = new WiFiUDP();
    }

    void begin() {
        WiFi.begin(_ssid, _password);
        while (WiFi.status() != WL_CONNECTED) {
            delay(1000);
        }
        configTime(_timeZone * 3600, 0, _ntpServer);
    }

    time_t getCurrentTime() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 1000)) {
            return 0; // Return 0 if unable to get time
        }
        return mktime(&timeinfo);
    }

private:
    const char* _ssid;
    const char* _password;
    const char* _ntpServer;
    int _timeZone;
    WiFiUDP* _udp;
};