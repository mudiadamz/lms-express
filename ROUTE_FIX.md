# Fix: Route Not Found

## Problem

User trying to access `/auth/login` but getting "Route not found"

## Solution

### Option 1: Use Correct Route (Recommended)

The correct route is `/api/auth/login`, not `/auth/login`

**Correct URL:**
```
https://lms-api-production-22e9.up.railway.app/api/auth/login
```

### Option 2: Alias Route Added

Added alias route `/auth` that maps to `/api/auth` for convenience.

Now both work:
- `/api/auth/login` ✅
- `/auth/login` ✅

## Test Login

```bash
# Correct route
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Or with alias
curl -X POST https://lms-api-production-22e9.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## Database Seed

If login returns "Invalid username or password", database might not be seeded.

Seed database:
```bash
railway shell
npm run seed
exit
```

Or via Railway Dashboard → Shell → Run: `npm run seed`

## All Available Routes

### Authentication
- `POST /api/auth/login` or `POST /auth/login`
- `POST /api/auth/logout` or `POST /auth/logout`

### Users
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Classes
- `GET /api/classes`
- `GET /api/classes/:id`
- `POST /api/classes`
- `PUT /api/classes/:id`
- `DELETE /api/classes/:id`

### Subjects
- `GET /api/subjects`
- `GET /api/subjects/:id`
- `POST /api/subjects`
- `PUT /api/subjects/:id`
- `DELETE /api/subjects/:id`

### Assignments
- `GET /api/assignments`
- `GET /api/assignments/:id`
- `POST /api/assignments`
- `PUT /api/assignments/:id`
- `DELETE /api/assignments/:id`
- `POST /api/assignments/:id/submissions`
- `GET /api/assignments/:id/submissions`
- `PATCH /api/assignments/submissions/:submissionId`

### Quizzes
- `GET /api/quizzes`
- `GET /api/quizzes/:id`
- `POST /api/quizzes`
- `POST /api/quizzes/:id/submit`

### Materials
- `GET /api/materials`
- `GET /api/materials/:id`
- `POST /api/materials`
- `PUT /api/materials/:id`
- `DELETE /api/materials/:id`

## Status

✅ Route alias added
✅ Both `/api/auth/login` and `/auth/login` work
✅ Server is running (health check works)
