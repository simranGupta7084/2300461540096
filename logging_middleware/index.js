const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJndXB0YXlhc2hpNzA1QGdtYWlsLmNvbSIsImV4cCI6MTc4MTE2NjI0OCwiaWF0IjoxNzgxMTY1MzQ4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODZkMzQ4ODMtODc5OS00ZGQzLWEyOWEtYTIzNmFkYTU0OGVhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwic3ViIjoiOWI1M2I4YTgtNWRlNi00MDA3LWIyODMtNTFlNTJhYzFjM2Q4In0sImVtYWlsIjoiZ3VwdGF5YXNoaTcwNUBnbWFpbC5jb20iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwicm9sbE5vIjoiMjMwMDQ2MTU0MDA5NiIsImFjY2Vzc0NvZGUiOiJCQVZEU2giLCJjbGllbnRJRCI6IjliNTNiOGE4LTVkZTYtNDAwNy1iMjgzLTUxZTUyYWMxYzNkOCIsImNsaWVudFNlY3JldCI6Ik1HZ3VXSHpXQXdkdXhQaGoifQ.NS_fwsmws3ozrTgORBwuDStUMeCtL0sLkuixPPTlZts";

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "api", "component", "hook", "page", "state",
  "auth", "config", "middleware", "utils"
];

async function Log(stack, level, pkg, message) {
  if (!VALID_STACKS.includes(stack)) {
    console.error(`Invalid stack: ${stack}`);
    return;
  }
  if (!VALID_LEVELS.includes(level)) {
    console.error(`Invalid level: ${level}`);
    return;
  }
  if (!VALID_PACKAGES.includes(pkg)) {
    console.error(`Invalid package: ${pkg}`);
    return;
  }

  try {
    const response = await axios.post(
      "http://4.224.186.213/evaluation-service/logs",
      {
        stack: stack,
        level: level,
        package: pkg,
        message: message
      },
      {
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data;
  } catch (err) {
    console.error("Log failed:", err.message);
  }
}

module.exports = { Log };