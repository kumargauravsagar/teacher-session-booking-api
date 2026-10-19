# Teacher Session Booking API

REST API backend where users register, teachers publish sessions, and users book and complete them.
No frontend, no authentication (not required by the assignment).

## Tech stack

Node.js 20+, TypeScript (strict), Express 5, MongoDB, Mongoose 9, Zod (validation), dotenv, tsx (dev runner),
Vitest + Supertest (tests).

## Prerequisites

- Node.js 20 or newer and npm
- A running MongoDB 6+ instance (local `mongod`, Docker, or MongoDB Atlas)

Quick local MongoDB with Docker:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

## Setup

```bash
npm install
cp .env.example .env        # then edit if needed
```

`.env`:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/teacher_session_booking
```

### Seed a teacher

There is no teacher registration API (by design). Create one with the seed script:

```bash
npm run seed
```

It prints the teacher's ObjectId; use it as `teacherId` when creating sessions. The script is idempotent
(re-running reuses the same teacher).

### Run

```bash
npm run dev                 # development, auto-restart (tsx watch)

npm run build               # compile to dist/
npm start                   # run compiled app
```

Health check: `GET /health`.

## Response format

```json
{ "success": true,  "message": "…", "data": {} }
{ "success": false, "message": "clear description of the error" }
```

Stack traces and internals are never returned to clients. Status codes: 200, 201, 400, 404, 409, 500.
Documents are returned with `id` (not `_id`) and ISO 8601 UTC dates.

## Endpoints

### 1. `POST /users` — create user

```json
{ "fullName": "Rahul Sharma", "email": "rahul@example.com", "phone": "9876543210" }
```

- `201` created user (`id`, `fullName`, `email`, `phone`, `createdAt`, `updatedAt`)
- `400` missing/empty name, invalid email, missing phone, malformed JSON
- `409` email already exists (email is trimmed + lowercased; unique index in MongoDB)

### 2. `POST /sessions` — create session

```json
{ "teacherId": "<teacher id>", "startTime": "2026-11-01T10:00:00.000Z", "endTime": "2026-11-01T11:00:00.000Z" }
```

- `201` session with `status: "AVAILABLE"`, `userId: null`, `completedAt: null`
- `400` invalid teacherId / dates, or `endTime <= startTime`
- `404` teacher does not exist
- Any `status`, `userId` or `completedAt` sent by the client is ignored.

### 3. `GET /sessions/available?dateTimestamp=<ms>` — available sessions for a UTC day

- `dateTimestamp` is **Unix time in milliseconds** (digits only). Any instant inside the day selects that day.
- The day is the UTC calendar day `[00:00:00.000Z, next 00:00:00.000Z)`.
- Implemented with an aggregation pipeline: `$match` (AVAILABLE + day range) → `$lookup` teachers → `$unwind` → `$project`
  (teacher `id`, `fullName`, `specialization`, `experience` only) → `$sort` by `startTime`.
- `200` array (empty array when nothing matches); `400` missing/invalid timestamp.

### 4. `POST /sessions/:id/book` — book a session

```json
{ "userId": "<user id>" }
```

- Atomic `findOneAndUpdate({ _id, status: "AVAILABLE" }, { status: "BOOKED", userId })`, so concurrent requests
  cannot double-book.
- `200` updated session; `400` invalid ids; `404` user or session not found; `409` session already BOOKED/COMPLETED.

### 5. `PATCH /sessions/:id/complete` — complete a session

- Atomic `findOneAndUpdate({ _id, status: "BOOKED" }, { status: "COMPLETED", completedAt: <server now> })`.
  `userId` and `teacherId` are retained; the body is ignored.
- `200` updated session; `400` invalid id; `404` not found; `409` session is not BOOKED.

### 6. `GET /users/:id/sessions` — a user's sessions

- Aggregation: `$match` (this user) → `$lookup` teachers → `$unwind` → `$project` → `$facet` into
  - `upcomingSessions`: `status = BOOKED` and `startTime >= server now`
  - `completedSessions`: `status = COMPLETED`
  each sorted by `startTime` ascending. Both arrays are always present.
- `200`; `400` invalid id; `404` user not found.

Example success body:

```json
{
  "success": true,
  "message": "User sessions retrieved successfully",
  "data": {
    "upcomingSessions": [
      {
        "id": "…", "teacherId": "…", "userId": "…", "status": "BOOKED",
        "startTime": "2026-11-01T10:00:00.000Z", "endTime": "2026-11-01T11:00:00.000Z", "completedAt": null,
        "teacher": { "id": "…", "fullName": "Anita Verma", "specialization": "Mathematics", "experience": 8 }
      }
    ],
    "completedSessions": []
  }
}
```

Example error body: `{ "success": false, "message": "Session is not available for booking" }`

## Session state transitions

```
AVAILABLE --book--> BOOKED --complete--> COMPLETED
```

No other transitions exist. `AVAILABLE` has no user; `BOOKED` has a user; `COMPLETED` keeps the user and has `completedAt`.
A Mongoose pre-validate hook additionally rejects inconsistent combinations on save.

## Postman

1. Import `postman/Backend-Developer-Assignment.postman_collection.json`.
2. Set the collection variable `teacherId` to the id printed by `npm run seed` (and `baseUrl` if not `http://localhost:5000`).
3. Run the requests in order (1 to 8). Scripts save `userId`, `sessionId` and `dateTimestamp` automatically,
   and request 2 always creates a session for tomorrow 10:00 UTC. No hardcoded database IDs are used.

## Tests

```bash
npm test
```

Tests use Vitest + Supertest. By default they start an in-memory MongoDB (`mongodb-memory-server`), which downloads a
`mongod` binary on first run (needs internet access). To use an existing MongoDB instead:

```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/tsb_test npm test
```

On Windows PowerShell: `$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/tsb_test"; npm test`
(CMD: `set MONGODB_TEST_URI=mongodb://127.0.0.1:27017/tsb_test && npm test`).

The test database is wiped between tests, so point it at a throwaway database.

Coverage: all scenarios listed in the assignment (validation, duplicates, UTC day filtering, aggregation usage,
double booking, 10-way concurrent booking, completion rules, user session categorisation, end-to-end flow).

## Assumptions

- Timestamps are Unix milliseconds; the UTC day boundary is `[start, next start)`.
- `startTime` of a new session may be in the past (no rule in the spec). No teacher schedule-conflict rule is implemented.
- A BOOKED session whose start has passed appears in neither `upcomingSessions` nor `completedSessions` (categories are exactly as specified).
- Teachers come from the seed script only.

## Project layout

```
src/config, controllers, models, routes, services, middlewares, validators, utils, app.ts, server.ts
scripts/seed.ts   tests/   postman/
```
