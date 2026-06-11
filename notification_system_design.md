# Notification System Design

## Stage 1: REST API Design

### Core Actions
The notification platform supports the following actions:
- Fetch all notifications for a student
- Fetch unread notifications
- Mark a notification as read
- Mark all notifications as read
- Delete a notification

### API Endpoints

#### 1. Get All Notifications
GET /api/notifications
Authorization: Bearer <token>
Response 200:
{
"notifications": [
{
"id": "uuid",
"type": "Placement" | "Event" | "Result",
"message": "string",
"isRead": false,
"createdAt": "2026-04-22T17:51:18Z"
}
],
"total": 100,
"unreadCount": 10
}

#### 2. Get Unread Notifications
GET /api/notifications?isRead=false
Authorization: Bearer <token>
Response 200:
{
"notifications": [...],
"unreadCount": 10
}

#### 3. Mark Notification as Read
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
Response 200:
{
"message": "Notification marked as read",
"id": "uuid"
}

#### 4. Mark All as Read
PATCH /api/notifications/read-all
Authorization: Bearer <token>
Response 200:
{
"message": "All notifications marked as read",
"updatedCount": 10
}

#### 5. Delete Notification
DELETE /api/notifications/:id
Authorization: Bearer <token>
Response 200:
{
"message": "Notification deleted successfully"
}

### Real-time Notification Mechanism
Use **WebSockets** (Socket.IO) for real-time delivery.
- When a new notification is created, server emits to the student's socket room
- Client listens on `notification:new` event
- Fallback to polling every 30 seconds if WebSocket fails

---

## Stage 2: Database Design

### Recommended Database: PostgreSQL

**Why PostgreSQL:**
- Structured notification data with consistent schema
- Strong support for indexes on multiple columns
- ACID compliance ensures no notification is lost
- JSON support for flexible metadata fields
- Excellent performance with proper indexing at scale

### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studentID INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_studentID ON notifications(studentID);
CREATE INDEX idx_notifications_isRead ON notifications(isRead);
CREATE INDEX idx_notifications_createdAt ON notifications(createdAt DESC);
CREATE INDEX idx_notifications_studentID_isRead ON notifications(studentID, isRead);
```

### Problems at Scale and Solutions

**Problem 1: Table size** — 50,000 students x 100 notifications = 5M rows
**Solution:** Table partitioning by createdAt (monthly partitions)

**Problem 2: Slow queries** — Full table scans without indexes
**Solution:** Composite indexes on (studentID, isRead, createdAt)

**Problem 3: Write bottleneck** — 50,000 simultaneous inserts
**Solution:** Message queue (Redis/RabbitMQ) to buffer writes

### SQL Queries

```sql
-- Fetch all notifications for a student
SELECT id, type, message, isRead, createdAt
FROM notifications
WHERE studentID = $1
ORDER BY createdAt DESC
LIMIT 50 OFFSET $2;

-- Fetch unread notifications
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = $1 AND isRead = FALSE
ORDER BY createdAt DESC;

-- Mark as read
UPDATE notifications
SET isRead = TRUE
WHERE id = $1 AND studentID = $2;

-- Mark all as read
UPDATE notifications
SET isRead = TRUE
WHERE studentID = $1 AND isRead = FALSE;

-- Delete notification
DELETE FROM notifications
WHERE id = $1 AND studentID = $2;
```

---

## Stage 3: Query Optimization

### Original Query
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

### Why This Is Slow
- `SELECT *` fetches all columns including large text fields unnecessarily
- No composite index on (studentID, isRead, createdAt) — causes full table scan
- At 5,000,000 rows this scan is extremely expensive
- ORDER BY createdAt without index causes filesort operation

### Optimized Query
```sql
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = FALSE
ORDER BY createdAt DESC
LIMIT 50;
```

### Index to Add
```sql
CREATE INDEX idx_student_unread_recent
ON notifications(studentID, isRead, createdAt DESC);
```

### Cost Improvement
- Before: O(n) full table scan — scans all 5M rows
- After: O(log n) index lookup — scans only matching rows
- Estimated improvement: 100x faster query execution

### Adding Indexes on Every Column — Bad Advice
The suggestion to index every column is harmful because:
- Every INSERT and UPDATE must update all indexes — write performance degrades severely
- Indexes consume significant disk space
- Query planner may choose wrong index
- Only index columns used in WHERE, ORDER BY, and JOIN clauses

### Placement Notifications Last 7 Days
```sql
SELECT s.id, s.name, s.email, n.message, n.createdAt
FROM notifications n
JOIN students s ON n.studentID = s.id
WHERE n.type = 'Placement'
AND n.createdAt >= NOW() - INTERVAL '7 days'
ORDER BY n.createdAt DESC;
```

---

## Stage 4: Caching Strategy

### Problem
Notifications fetched on every page load — database gets overwhelmed.

### Solutions

**Strategy 1: Redis Cache**
- Cache unread notifications per student with key `notifications:studentID`
- TTL of 60 seconds
- Invalidate cache when new notification arrives or read status changes
- Tradeoff: Slightly stale data (max 60s), but 95% reduction in DB queries

**Strategy 2: Client-Side Caching**
- Store notifications in localStorage/sessionStorage
- Refresh only when WebSocket event received
- Tradeoff: Data may be stale if user opens multiple tabs

**Strategy 3: Pagination + Infinite Scroll**
- Fetch only 20 notifications at a time
- Load more on scroll
- Tradeoff: Better performance but worse UX for users who need older notifications

**Recommended Approach:** Redis cache + WebSocket invalidation
- On page load: serve from Redis if cache exists
- On new notification: push via WebSocket + invalidate Redis cache
- On mark as read: update DB + invalidate Redis cache

---

## Stage 5: Bulk Notification Redesign

### Problems with Original Implementation
function notify_all(student_ids, message):
for student_id in student_ids:
send_email(student_id, message)   # synchronous — blocks
save_to_db(student_id, message)   # if email fails, DB still written
push_to_app(student_id, message)  # if DB fails, app push still happens

**Problems:**
- Synchronous loop — 50,000 students x 3 operations = 150,000 sequential calls
- Estimated time: 50,000 x ~200ms = 2.7 hours — completely unacceptable
- If send_email fails for student 200, students 201-50000 are never notified
- No retry mechanism for failed emails
- Email and DB are not atomic — inconsistent state possible
- Single point of failure — one crash loses all remaining notifications

### Should Email and DB Save Happen Together?
No. They should be independent operations:
- DB save should happen first and always succeed — it is the source of truth
- Email is a side effect — it can fail and be retried without affecting DB state
- Coupling them means a failed email prevents the notification from being saved

### Redesigned Implementation
function notify_all(student_ids, message):
Step 1: Save all to DB in batch — fast single query
batch_save_to_db(student_ids, message)
Step 2: Push all jobs to message queue
for student_id in student_ids:
queue.push({ type: "email", student_id, message })
queue.push({ type: "push", student_id, message })
Workers process queue independently with retry logic
function email_worker():
while true:
job = queue.pop("email")
try:
send_email(job.student_id, job.message)
mark_email_sent(job.student_id)
except:
if job.retries < 3:
queue.push(job with retries+1, delay=exponential_backoff)
else:
log_failed_email(job.student_id)

### Handling 200 Failed Emails
- Failed jobs remain in dead letter queue
- Retry with exponential backoff (1s, 2s, 4s)
- After 3 retries: log to failed_notifications table
- Admin dashboard shows failed count
- Manual retry trigger available

---

## Stage 6: Priority Inbox Implementation

### Approach
Priority is determined by:
1. **Type weight**: Placement=3, Result=2, Event=1
2. **Recency**: More recent = higher priority
3. **Combined score**: `weight * 1000 + recency_score`

Use a **Max Heap** to efficiently maintain top N notifications.
- Insert: O(log n)
- Extract top N: O(n log n)
- New notification arrives: compare with heap minimum, replace if higher priority

### Why Max Heap?
- Efficient for maintaining top N from a large stream
- New notifications can be compared and inserted in O(log n)
- Better than sorting entire list on each update O(n log n)

See `notification_app_be/priority_inbox.js` for implementation.