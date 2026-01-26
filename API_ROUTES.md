# API Routes Documentation

## Base URL

```
https://lms-api-production-22e9.up.railway.app
```

## Authentication Routes

### Login
```http
POST /api/auth/login
POST /auth/login  (alias)
```

**Request:**
```json
{
  "username": "student",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "student",
      "fullName": "Budi Santoso",
      "role": "student",
      ...
    },
    "token": "jwt-token-here"
  }
}
```

### Logout
```http
POST /api/auth/logout
POST /auth/logout  (alias)
```

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-23T20:50:27.106Z"
}
```

## Root Endpoint

```http
GET /
```

**Response:**
```json
{
  "success": true,
  "message": "LMS API Server",
  "database": "initialized",
  "timestamp": "..."
}
```

## All Routes

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Classes
- `GET /api/classes` - Get all classes
- `GET /api/classes/:id` - Get class by ID
- `POST /api/classes` - Create class (admin only)
- `PUT /api/classes/:id` - Update class (admin only)
- `DELETE /api/classes/:id` - Delete class (admin only)

### Subjects
- `GET /api/subjects` - Get all subjects
- `GET /api/subjects/:id` - Get subject by ID
- `POST /api/subjects` - Create subject (admin only)
- `PUT /api/subjects/:id` - Update subject (admin only)
- `DELETE /api/subjects/:id` - Delete subject (admin only)

### Assignments
- `GET /api/assignments` - Get assignments
- `GET /api/assignments/:id` - Get assignment by ID
- `POST /api/assignments` - Create assignment (teacher)
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment
- `POST /api/assignments/:id/submissions` - Submit assignment (student)
- `GET /api/assignments/:id/submissions` - Get submissions
- `PATCH /api/assignments/submissions/:submissionId` - Grade submission (teacher)

### Quizzes
- `GET /api/quizzes` - Get quizzes
- `GET /api/quizzes/:id` - Get quiz by ID
- `POST /api/quizzes` - Create quiz (teacher)
- `POST /api/quizzes/:id/submit` - Submit quiz (student)

### Materials
- `GET /api/materials` - Get materials
- `GET /api/materials/:id` - Get material by ID
- `POST /api/materials` - Create material (teacher)
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material

## Authentication

Most routes require authentication. Include token in header:

```http
Authorization: Bearer <token>
```

## Default Credentials (After Seed)

- **Student**: username=`student`, password=`password`
- **Teacher**: username=`teacher`, password=`password`
- **Admin**: username=`admin`, password=`password`
- **Parent**: username=`parent`, password=`password`

## Seed Database

If users don't exist, seed database:

```bash
railway shell
npm run seed
exit
```

Or via Railway Dashboard → Shell → Run: `npm run seed`
