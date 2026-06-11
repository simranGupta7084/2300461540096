const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Log } = require('../logging_middleware/index');

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJndXB0YXlhc2hpNzA1QGdtYWlsLmNvbSIsImV4cCI6MTc4MTE2OTY0MSwiaWF0IjoxNzgxMTY4NzQxLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiZDc1ZjkwY2EtNDUyZi00YTFjLTk2MTgtNjJjMGQ2M2IzZmYxIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwic3ViIjoiOWI1M2I4YTgtNWRlNi00MDA3LWIyODMtNTFlNTJhYzFjM2Q4In0sImVtYWlsIjoiZ3VwdGF5YXNoaTcwNUBnbWFpbC5jb20iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwicm9sbE5vIjoiMjMwMDQ2MTU0MDA5NiIsImFjY2Vzc0NvZGUiOiJCQVZEU2giLCJjbGllbnRJRCI6IjliNTNiOGE4LTVkZTYtNDAwNy1iMjgzLTUxZTUyYWMxYzNkOCIsImNsaWVudFNlY3JldCI6Ik1HZ3VXSHpXQXdkdXhQaGoifQ.91U1okv-B-30lbTFtZNxRXxnGM696b5TlWcVPMx4n4A";

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getPriorityScore(n) {
  const weight = TYPE_WEIGHT[n.Type] || 1;
  const recency = new Date(n.Timestamp).getTime();
  return weight * 1e12 + recency;
}

// GET /api/notifications - fetch all notifications
app.get('/api/notifications', async (req, res) => {
  await Log("backend", "info", "handler", "GET /api/notifications called");
  try {
    const response = await axios.get(
      "http://4.224.186.213/evaluation-service/notifications",
      { headers: { "Authorization": `Bearer ${TOKEN}` } }
    );
    const notifications = response.data.notifications;
    await Log("backend", "info", "handler", `Fetched ${notifications.length} notifications successfully`);
    res.status(200).json({
      notifications,
      total: notifications.length,
      unreadCount: notifications.length
    });
  } catch (err) {
    await Log("backend", "error", "handler", `Failed to fetch notifications: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET /api/notifications/priority - top N priority notifications
app.get('/api/notifications/priority', async (req, res) => {
  const n = parseInt(req.query.n) || 10;
  await Log("backend", "info", "handler", `GET /api/notifications/priority called with n=${n}`);
  try {
    const response = await axios.get(
      "http://4.224.186.213/evaluation-service/notifications",
      { headers: { "Authorization": `Bearer ${TOKEN}` } }
    );
    const notifications = response.data.notifications;
    const sorted = notifications
      .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
      .slice(0, n);
    await Log("backend", "info", "service", `Returning top ${n} priority notifications`);
    res.status(200).json({ notifications: sorted, count: sorted.length });
  } catch (err) {
    await Log("backend", "error", "handler", `Priority fetch failed: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch priority notifications" });
  }
});

// GET /api/notifications/type/:type - filter by type
app.get('/api/notifications/type/:type', async (req, res) => {
  const { type } = req.params;
  await Log("backend", "info", "handler", `GET /api/notifications/type/${type} called`);
  try {
    const response = await axios.get(
      "http://4.224.186.213/evaluation-service/notifications",
      { headers: { "Authorization": `Bearer ${TOKEN}` } }
    );
    const filtered = response.data.notifications.filter(
      n => n.Type.toLowerCase() === type.toLowerCase()
    );
    await Log("backend", "info", "handler", `Filtered ${filtered.length} notifications of type ${type}`);
    res.status(200).json({ notifications: filtered, count: filtered.length });
  } catch (err) {
    await Log("backend", "error", "handler", `Filter by type failed: ${err.message}`);
    res.status(500).json({ error: "Failed to filter notifications" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  await Log("backend", "info", "service", `Notification server started on port ${PORT}`);
  console.log(`Notification server running on port ${PORT}`);
});