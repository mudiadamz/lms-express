# LMS Backend Server

Backend server untuk Learning Management System menggunakan Express.js dan SQLite.

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` ke `.env` dan sesuaikan nilai-nilainya:

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
DB_PATH=./database/lms.db
NODE_ENV=development
```

### 3. Initialize Database

Jalankan migration untuk membuat tabel-tabel database:

```bash
npm run migrate
```

### 4. Seed Database (Optional)

Untuk mengisi database dengan data awal:

```bash
npm run seed
```

Default credentials setelah seeding:
- Student: username=`student`, password=`password`
- Teacher: username=`teacher`, password=`password`
- Admin: username=`admin`, password=`password`
- Parent: username=`parent`, password=`password`

### 5. Run Server

Development mode (dengan hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

Server akan berjalan di `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

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

## Database Schema

Database menggunakan SQLite dengan schema lengkap untuk:
- Users (students, teachers, admins, parents)
- Classes
- Subjects
- Assignments & Submissions
- Quizzes & Submissions
- Materials
- Grades
- Attendance
- Schedules
- Forum Posts & Comments
- Messages
- Notifications
- Announcements
- Academic Years

## Authentication

API menggunakan JWT (JSON Web Tokens) untuk authentication. Setelah login, sertakan token di header:

```
Authorization: Bearer <token>
```

## Error Handling

Semua API responses mengikuti format:

```json
{
  "success": true/false,
  "data": {...},
  "error": "error message"
}
```

## Development Notes

- Database file akan dibuat otomatis di `./database/lms.db`
- Foreign keys diaktifkan untuk menjaga integritas data
- WAL mode diaktifkan untuk better concurrency
- Password di-hash menggunakan bcryptjs
