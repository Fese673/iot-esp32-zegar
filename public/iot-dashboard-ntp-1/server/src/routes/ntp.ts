import { Router } from 'express';
import { NTPService } from '../services/ntpService';

const router = Router();
const ntpService = new NTPService();

// Endpoint to fetch the current NTP time
router.get('/time', async (req, res) => {
  try {
    const time = await ntpService.getCurrentTime();
    res.json({ time });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch NTP time' });
  }
});

// Additional NTP-related endpoints can be defined here

export default router;