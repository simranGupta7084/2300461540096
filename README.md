# Backend Track Submission

This repository contains my submission for the campus hiring evaluation backend track.

## What I Built

### Logging Middleware
A reusable logging package that sends structured logs to the evaluation server. I integrated this throughout every module from the first function written. It validates stack, level, and package values before making the API call.

### Vehicle Maintenance Scheduler
A microservice that solves the vehicle scheduling problem using dynamic programming. It fetches depot budgets and vehicle tasks from the evaluation API, then runs a 0/1 knapsack algorithm for each depot to find the combination of vehicles that maximises operational impact within the available mechanic hours.

### Notification System Design
A markdown document covering the full design of a campus notification platform across 6 stages — REST API design, database schema, query optimisation, caching strategy, bulk notification handling, and priority inbox implementation.

### Notification Backend
An Express server with REST endpoints to fetch, filter, and prioritise notifications. Also includes a standalone priority inbox implementation using a Max Heap to find the top N most important unread notifications based on type weight and recency.

## How to Run

Each module has its own folder. Navigate into the folder and run:

```bash
npm install
node index.js  # or node server.js for the notification backend
```

## Tech Stack
Node.js, Express, Axios
