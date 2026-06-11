const axios = require('axios');
const { Log } = require('../logging_middleware/index');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJndXB0YXlhc2hpNzA1QGdtYWlsLmNvbSIsImV4cCI6MTc4MTE2NDA2NywiaWF0IjoxNzgxMTYzMTY3LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNDU2OGQzMTUtYWQxYS00NTE5LWExYzgtZjQ0YWY4ZjQ0MzRkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwic3ViIjoiOWI1M2I4YTgtNWRlNi00MDA3LWIyODMtNTFlNTJhYzFjM2Q4In0sImVtYWlsIjoiZ3VwdGF5YXNoaTcwNUBnbWFpbC5jb20iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwicm9sbE5vIjoiMjMwMDQ2MTU0MDA5NiIsImFjY2Vzc0NvZGUiOiJCQVZEU2giLCJjbGllbnRJRCI6IjliNTNiOGE4LTVkZTYtNDAwNy1iMjgzLTUxZTUyYWMxYzNkOCIsImNsaWVudFNlY3JldCI6Ik1HZ3VXSHpXQXdkdXhQaGoifQ.5cBd25F27wvw6ARG6T8Ia4JfSRHbRfEZAs7mS-ixVFw";

const HEADERS = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

// Knapsack algorithm — maximize impact within mechanic hours budget
function knapsack(vehicles, budget) {
  const n = vehicles.length;
  // dp[i][w] = max impact using first i vehicles with w hours budget
  const dp = Array.from({ length: n + 1 }, () => Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= budget; w++) {
      dp[i][w] = dp[i - 1][w]; // don't take this vehicle
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  // Backtrack to find which vehicles were selected
  const selected = [];
  let w = budget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  return {
    maxImpact: dp[n][budget],
    selectedVehicles: selected,
    totalDuration: selected.reduce((sum, v) => sum + v.Duration, 0)
  };
}

async function main() {
  await Log("backend", "info", "service", "Vehicle maintenance scheduler starting");

  try {
    // Fetch depots
    await Log("backend", "info", "handler", "Fetching depots from API");
    const depotsRes = await axios.get(
      "http://4.224.186.213/evaluation-service/depots",
      { headers: HEADERS }
    );
    const depots = depotsRes.data.depots;
    await Log("backend", "info", "handler", `Fetched ${depots.length} depots successfully`);

    // Fetch vehicles
    await Log("backend", "info", "handler", "Fetching vehicles from API");
    const vehiclesRes = await axios.get(
      "http://4.224.186.213/evaluation-service/vehicles",
      { headers: HEADERS }
    );
    const vehicles = vehiclesRes.data.vehicles;
    await Log("backend", "info", "handler", `Fetched ${vehicles.length} vehicles successfully`);

    console.log(`\nTotal Vehicles: ${vehicles.length}`);
    console.log(`Total Depots: ${depots.length}\n`);

    // Run knapsack for each depot
    for (const depot of depots) {
      await Log("backend", "info", "service", `Running scheduler for depot ${depot.ID} with budget ${depot.MechanicHours} hours`);

      const result = knapsack(vehicles, depot.MechanicHours);

      console.log(`Depot ID: ${depot.ID}`);
      console.log(`Mechanic Hours Budget: ${depot.MechanicHours}`);
      console.log(`Max Impact Score: ${result.maxImpact}`);
      console.log(`Total Hours Used: ${result.totalDuration}`);
      console.log(`Selected Vehicles (${result.selectedVehicles.length}):`);
      result.selectedVehicles.forEach(v => {
        console.log(`  - TaskID: ${v.TaskID} | Duration: ${v.Duration}h | Impact: ${v.Impact}`);
      });
      console.log('---');

      await Log("backend", "info", "service", `Depot ${depot.ID}: max impact ${result.maxImpact} using ${result.totalDuration} of ${depot.MechanicHours} hours`);
    }

    await Log("backend", "info", "service", "Vehicle maintenance scheduler completed successfully");

  } catch (err) {
    await Log("backend", "error", "handler", `Scheduler failed: ${err.message}`);
    console.error("Error:", err.message);
  }
}

main();