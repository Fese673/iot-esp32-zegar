// This file contains the JavaScript code for the client-side functionality of the dashboard.
// It includes logic for fetching NTP time from the server and updating the UI.

document.addEventListener('DOMContentLoaded', () => {
    const timeDisplay = document.getElementById('time-display');
    const fetchTimeButton = document.getElementById('fetch-time');

    fetchTimeButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/ntp/time');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            timeDisplay.textContent = `Current NTP Time: ${data.time}`;
        } catch (error) {
            console.error('Error fetching NTP time:', error);
            timeDisplay.textContent = 'Error fetching time';
        }
    });
});