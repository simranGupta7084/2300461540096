const axios = require('axios');
const { Log } = require('../logging_middleware/index');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJndXB0YXlhc2hpNzA1QGdtYWlsLmNvbSIsImV4cCI6MTc4MTE2NjI0OCwiaWF0IjoxNzgxMTY1MzQ4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODZkMzQ4ODMtODc5OS00ZGQzLWEyOWEtYTIzNmFkYTU0OGVhIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwic3ViIjoiOWI1M2I4YTgtNWRlNi00MDA3LWIyODMtNTFlNTJhYzFjM2Q4In0sImVtYWlsIjoiZ3VwdGF5YXNoaTcwNUBnbWFpbC5jb20iLCJuYW1lIjoic2ltcmFuIGd1cHRhIiwicm9sbE5vIjoiMjMwMDQ2MTU0MDA5NiIsImFjY2Vzc0NvZGUiOiJCQVZEU2giLCJjbGllbnRJRCI6IjliNTNiOGE4LTVkZTYtNDAwNy1iMjgzLTUxZTUyYWMxYzNkOCIsImNsaWVudFNlY3JldCI6Ik1HZ3VXSHpXQXdkdXhQaGoifQ.NS_fwsmws3ozrTgORBwuDStUMeCtL0sLkuixPPTlZts";

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getPriorityScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] || 1;
  const recency = new Date(notification.Timestamp).getTime();
  return weight * 1e12 + recency;
}

// Max Heap implementation
class MaxHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() { return this.heap[0]; }
  size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (getPriorityScore(this.heap[parent]) >= getPriorityScore(this.heap[i])) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && getPriorityScore(this.heap[left]) > getPriorityScore(this.heap[largest])) largest = left;
      if (right < n && getPriorityScore(this.heap[right]) > getPriorityScore(this.heap[largest])) largest = right;
      if (largest === i) break;
      [this.heap[largest], this.heap[i]] = [this.heap[i], this.heap[largest]];
      i = largest;
    }
  }
}

function getTopN(notifications, n = 10) {
  const heap = new MaxHeap();
  for (const notif of notifications) heap.push(notif);
  const result = [];
  for (let i = 0; i < n && heap.size() > 0; i++) result.push(heap.pop());
  return result;
}

async function main() {
  await Log("backend", "info", "service", "Priority inbox service starting");

  try {
    await Log("backend", "info", "handler", "Fetching notifications from API");
    const res = await axios.get(
      "http://4.224.186.213/evaluation-service/notifications",
      { headers: { "Authorization": `Bearer ${TOKEN}` } }
    );

    const notifications = res.data.notifications;
    await Log("backend", "info", "handler", `Fetched ${notifications.length} notifications`);

    const top10 = getTopN(notifications, 10);

    console.log("\n=== TOP 10 PRIORITY NOTIFICATIONS ===\n");
    top10.forEach((n, i) => {
      console.log(`${i + 1}. [${n.Type}] ${n.Message}`);
      console.log(`   Timestamp: ${n.Timestamp}`);
      console.log(`   Priority Score: ${getPriorityScore(n)}`);
      console.log(`   ID: ${n.ID}`);
      console.log();
    });

    await Log("backend", "info", "service", `Priority inbox computed top 10 from ${notifications.length} notifications`);

  } catch (err) {
    await Log("backend", "error", "handler", `Priority inbox failed: ${err.message}`);
    console.error("Error:", err.message);
  }
}

main();