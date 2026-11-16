# CourseHub

CourseHub is a course discovery and student learning application built with
Node.js, Express, EJS, and MongoDB. Students can browse and compare courses,
create an account, enroll, and keep track of their learning.

## Features

- Browse active courses and filter by search term, subject category, or seat availability.
- View course details, including instructor, duration, enrollment, and capacity.
- Compare up to three courses from the catalog.
- Sign up, sign in, update a profile, and sign out.
- Sign up and sign in as a teacher to manage courses from the teaching dashboard.
- Upload a course photo when creating courses and update it later from the course editor.
- Build course curricula with ordered modules, reading lessons, HTTPS video links, and lesson durations.
- Upload downloadable learning materials to lessons and share them with enrolled students.
- Enroll in courses, track lesson completion, and continue from the last lesson.
- View course progress and learning totals on the student dashboard and filter courses by completion status.
- Save courses to an account-backed wishlist and manage saved courses across devices.
- Set a weekly lesson-completion goal and review weekly lesson minutes, completions, and current streak.
- Search, filter, sort, and page through the course catalog.
- Give teachers a dashboard to manage their own courses and review platform-wide totals.
- Give admins an overview of accounts, courses, and enrollments, with course-management controls.
- Automatically seed the catalog with starter courses when the server starts.
- Use responsive pages with reduced-motion support.

## Requirements

- Node.js and npm
- MongoDB, either a local server or a MongoDB Atlas database

## Getting started

1. Install the project dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root and set the MongoDB connection URI:

   ```dotenv
   MONGO_URI=mongodb://127.0.0.1:27017/coursehub
   PORT=8080
   ADMIN_ACCOUNT_IDS=
   TEACHER_ACCOUNT_IDS=
   APP_BASE_URL=http://localhost:8080
   SMTP_HOST=
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM=
   ```

   Replace the URI with your database connection string if you use MongoDB
   Atlas. `MONGO_URI` is required. `PORT` is optional and defaults to `8080`.
   Teacher signup is available at `/teacher/signup` and immediately grants the
   teacher role; anyone can register as a teacher. To grant admin access, first
   create the account, verify its identity, and add its MongoDB `_id` to
   `ADMIN_ACCOUNT_IDS`. Existing accounts can also be granted teacher access by
   adding their `_id` to `TEACHER_ACCOUNT_IDS`. Find an
   account ID in MongoDB with
   `db.studentaccounts.findOne({ email: "admin@example.com" }, { _id: 1 })`.
   Separate multiple IDs with commas. Admin takes precedence if an ID appears
   in both lists. The normal `/signup` route creates student accounts. Restart
   the app after changing role configuration. Password reset requires SMTP
   settings and the canonical app URL. For production, set `APP_BASE_URL` to
   the HTTPS site origin, `SMTP_HOST` and `SMTP_PORT` to your mail provider,
   `SMTP_SECURE=true` when using implicit TLS (commonly port 465), optional
   `SMTP_USER`/`SMTP_PASS` credentials, and a verified `SMTP_FROM` sender.
   Do not commit SMTP credentials to source control.

   For Resend on Render, open the service's **Environment** settings and add:

   ```text
   APP_BASE_URL=https://dbms-cp-hjnm.onrender.com
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASS=<your Resend API key>
   SMTP_FROM=CourseHub <no-reply@your-verified-domain>
   ```

   Create a Resend API key and verify the sender domain in Resend first. Replace
   the `SMTP_PASS` placeholder with the API key privately in Render, and use an
   address on the verified domain for `SMTP_FROM`. Save the environment settings
   and redeploy/restart the service. Port `587` with `SMTP_SECURE=false` is also
   supported. Do not paste the API key into source code, README, or chat.

3. Start the application:

   ```bash
   npm start
   ```

   For development with automatic restarts:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:8080](http://localhost:8080) (or the port configured
   in `PORT`) in your browser.

The app connects to MongoDB, initializes its indexes, and inserts the starter
courses if they are not already present. Existing course records are retained.

## Main pages and routes

| Route | Description |
| --- | --- |
| `GET /` | Home page and featured courses |
| `GET /courses` | Course catalog with search, category/availability filters, sorting, and pagination |
| `GET /courses/:courseId` | Course details |
| `GET /courses/:courseId/photo` | Course photo |
| `GET /my-learning` | Student dashboard and learning statistics |
| `GET /my-courses` | Enrolled courses filtered by progress status |
| `GET /saved-courses` | Signed-in student's saved-course wishlist |
| `POST /saved-courses/:courseId` | Save or remove a course (CSRF protected) |
| `POST /profile/learning-goal` | Update a student's weekly lesson-minute goal (CSRF protected) |
| `GET /learn/:courseId/:lessonId` | Open a lesson in an enrolled course |
| `POST /learn/:courseId/:lessonId/complete` | Mark an enrolled lesson complete (CSRF protected) |
| `GET /courses/:courseId/materials/:materialId` | Download a lesson material as an enrolled student or course manager |
| `GET /signup` and `POST /signup` | Create an account |
| `GET /login` and `POST /login` | Sign in |
| `GET /forgot-password` and `POST /forgot-password` | Request an email password-reset link |
| `GET /reset-password` and `POST /reset-password` | Validate a reset link and choose a new password |
| `GET /teacher/signup` and `POST /teacher/signup` | Create a teacher account |
| `GET /teacher/login` and `POST /teacher/login` | Sign in as a teacher |
| `POST /logout` | Sign out |
| `GET /dashboard` | Redirect to the signed-in user's role-specific dashboard |
| `GET /profile` and `POST /profile` | View and update the signed-in profile |
| `POST /enroll` | Enroll in an available course |
| `GET /teacher` | Teacher overview and management for the teacher's courses |
| `GET /admin` | Admin overview of accounts, courses, and enrollments |
| `/manage/courses/*` | Create, edit, publish, or archive courses (teacher/admin) |
| `POST /manage/courses/:courseId/lessons/:lessonId/materials` | Upload lesson material (teacher/admin, CSRF protected) |
| `POST /manage/courses/:courseId/materials/:materialId/delete` | Remove lesson material (teacher/admin, CSRF protected) |

Profile pages require a signed-in account. Enrollment, student dashboard,
course progress, and lesson pages require a signed-in student account.
Teacher
and administrator routes additionally require the matching configured role.
Teachers can edit and archive only courses they created; administrators can
manage any course. The course editor assigns course codes automatically and
requires a JPEG, PNG, or WebP photo up to 5 MB when creating a course. Photos
are stored with the course in MongoDB and shown in the catalog, course details,
and dashboards. Course lessons are stored as ordered modules embedded in the
course; lesson completion and the last visited lesson are stored per
enrollment. Course duration and student progress are calculated from lesson
durations and completed lesson IDs. Existing courses without a curriculum can
continue to be browsed; instructors can add modules and lessons in the course
editor. Existing courses without photos use a category placeholder until a
photo is uploaded. Archiving hides a course from the public catalog without
removing it from enrolled students' learning pages.

Teachers can add up to 20 learning materials per lesson and 50 per course from
the course detail page. PDF, DOCX, PPTX, XLSX, TXT, and CSV files are accepted
up to 10 MB each.
Files are stored in a separate MongoDB collection rather than embedded in the
course document. Only course owners and administrators can upload or remove
materials; downloads are limited to those managers and enrolled students.

Signed-in students' saved courses are stored as separate student/course records; guest catalog
favorites remain browser-local. Weekly goals default to 300 minutes and can be
set from 30 minutes to 1,680 minutes in 30-minute increments. Lesson activity
is recorded once per student/course/lesson when completion is submitted;
weekly minutes use the lesson's configured duration, not measured time-on-page.
Activity streaks and weekly summaries therefore begin accumulating from lesson
completions recorded after this feature is deployed. Activity dates use UTC.

Password-reset links are generated from `APP_BASE_URL`, expire after 30 minutes,
and contain a random token whose hash alone is stored in MongoDB. Requests do
not disclose whether an email address has an account. Reset requests and
submissions are rate-limited per server process; use a shared rate-limit store
if deploying multiple application instances.

The catalog accepts `q`, `category`, `availability=available`, `sort=title|newest|popular`,
and `page` query parameters and shows nine courses per page. Curricula support
up to 30 modules and 100 lessons per course; lesson durations must be from 1
to 600 minutes. Optional video links must be HTTPS URLs that point to playable
video files supported by the browser's native video player.

## Project structure

```text
.
├── components/     Shared EJS page components
├── models/         Mongoose models for courses, accounts, sessions, enrollments, wishlist entries, and learning activity
├── public/         Client-side JavaScript and CSS
├── views/          EJS pages and view components
├── index.js        Express application, routes, and startup logic
└── package.json    Dependencies and npm scripts
```

## Data models

- **Course** — internally generated course code, title, category, instructor,
  description, calculated duration, ordered modules and lessons, capacity,
  optional photo, creator reference, and active status.
- **CourseLearningMaterial** — bounded downloadable lesson file metadata and
  content, referenced by course and lesson.
- **StudentAccount** — name, unique email, password hash and salt, student/teacher role, and weekly learning goal.
- **StudentSession** — hashed session token, account reference, and expiration.
- **StudentSavedCourse** — a referenced student/course wishlist entry with a unique compound index.
- **Enrollment** — student and course references, completed lesson IDs, last
  lesson and activity time, enrollment date, and a unique course/email pair
  to prevent duplicate enrollments.
- **StudentLearningActivity** — one estimated-duration activity record per
  completed student/course/lesson, with a unique compound index.

## Database Management System (DBMS) Implementation

CourseHub is developed as a full-featured Course Project demonstrating practical DBMS concepts, data modeling patterns, indexing strategies, transactions/concurrency control, and complex aggregation pipelines using MongoDB and Mongoose.

### 1. Key DBMS Concepts Used in the Project

- **Document-Based Data Modeling**:
  - **Embedded Subdocuments**: Fast single-document reads without joins. Used for `Course.modules` and nested `lessons`.
  - **Normalized References (`ObjectId` links)**: Prevents document bloat and enables atomic independent updates. Used between `Enrollment -> Course`, `Enrollment -> StudentAccount`, and `CourseLearningMaterial -> Course`.
- **Integrity Constraints & Validation**:
  - **Unique Constraints**: Unique indexes on `studentaccounts.email` and `courses.code` to prevent duplicate identities and codes.
  - **Compound Unique Constraints**:
    - `enrollments`: `{ course: 1, email: 1 }` prevents duplicate student enrollments in the same course.
    - `studentsavedcourses`: `{ studentAccount: 1, course: 1 }` prevents duplicate wishlist entries.
    - `studentlearningactivities`: `{ studentAccount: 1, course: 1, lesson: 1 }` guarantees idempotent lesson completions.
- **Indexing Strategies**:
  - **Compound Filter & Sort Indexes**: `{ isActive: 1, title: 1 }`, `{ isActive: 1, category: 1, title: 1 }`, and `{ isActive: 1, createdAt: -1, title: 1 }` accelerate catalog queries, category filtering, and sorting.
  - **TTL (Time-To-Live) Indexes**: Automatic database-level cleanup for expired records:
    - `studentsessions.expiresAt` (expires automatically via TTL index).
    - `passwordresettokens.expiresAt` (cleared automatically after 30 minutes).
- **Binary Data Storage (BLOB / Grid-Style Storage)**:
  - Binary buffers are stored for course photo assets and lesson materials with strict MIME-type validation and size caps (5 MB photos, 10 MB materials).
- **Concurrency Control & Seat Capacity**:
  - Atomic count checks before enrollment creation ensuring `enrollmentCount < course.capacity`.

---

### 2. Database Queries and Operations Used in the System

#### A. Complex Aggregation Pipelines

**Catalog Course Browsing with Dynamic Lookup and Pagination (`GET /courses`):**
```javascript
// Aggregates courses with live enrollment counts, applies filtering, availability checks, and pagination
db.courses.aggregate([
    { $match: { isActive: true, category: "Computer Science" } },
    {
        $lookup: {
            from: "enrollments",
            let: { courseId: "$_id" },
            pipeline: [
                { $match: { $expr: { $eq: ["$course", "$$courseId"] } } },
                { $count: "count" }
            ],
            as: "enrollmentStats"
        }
    },
    {
        $addFields: {
            enrollmentCount: { $ifNull: [{ $arrayElemAt: ["$enrollmentStats.count", 0] }, 0] }
        }
    },
    { $match: { $expr: { $lt: ["$enrollmentCount", "$capacity"] } } }, // Seat availability filter
    {
        $facet: {
            metadata: [{ $count: "total" }],
            courses: [
                { $sort: { createdAt: -1, title: 1 } },
                { $skip: 0 },
                { $limit: 9 },
                { $project: { photoData: 0, modules: 0, enrollmentStats: 0 } }
            ]
        }
    }
]);
```

**Teacher Platform Stats Aggregation (`GET /teacher`):**
```javascript
// Computes distinct student count and total enrollments across teacher courses
db.enrollments.aggregate([
    { $match: { course: { $in: teacherCourseIds } } },
    {
        $group: {
            _id: null,
            totalEnrollments: { $sum: 1 },
            uniqueStudents: { $addToSet: "$studentAccount" }
        }
    },
    {
        $project: {
            totalEnrollments: 1,
            studentCount: { $size: "$uniqueStudents" }
        }
    }
]);
```

**Student Weekly Activity Aggregation (`GET /my-learning`):**
```javascript
// Groups completed lessons in the current week to calculate total learning minutes
db.studentlearningactivities.aggregate([
    {
        $match: {
            studentAccount: studentAccountId,
            completedAt: { $gte: startOfWeekUtc, $lt: endOfWeekUtc }
        }
    },
    {
        $group: {
            _id: null,
            totalMinutes: { $sum: "$durationMinutes" },
            completedLessonsCount: { $sum: 1 }
        }
    }
]);
```

#### B. CRUD Operations

**1. Create Operations (Insertions)**
- **User Signup**:
  ```javascript
  db.studentaccounts.insertOne({
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash: "<scrypt_derived_hash>",
      passwordSalt: "<random_salt>",
      role: "student",
      weeklyLearningGoalMinutes: 300,
      createdAt: new Date(),
      updatedAt: new Date()
  });
  ```
- **Course Creation with Photo (Teacher/Admin)**:
  ```javascript
  db.courses.insertOne({
      code: "OS-67890",
      title: "Operating System",
      category: "Computer Science",
      instructor: "Prof. Sharma",
      description: "Core Operating System concepts, processes, memory management.",
      duration: "6 hours 30 mins",
      capacity: 35,
      photoData: BinData(0, "<binary_image_data>"),
      photoContentType: "image/jpeg",
      createdBy: teacherAccountId,
      isActive: true,
      modules: [ /* modules & lessons */ ]
  });
  ```
- **Course Enrollment**:
  ```javascript
  db.enrollments.insertOne({
      studentAccount: studentAccountId,
      course: courseId,
      name: "Jane Doe",
      email: "jane@example.com",
      enrolledAt: new Date(),
      completedLessons: [],
      lastActivityAt: new Date()
  });
  ```

**2. Read Operations (Queries & Population)**
- **Course Retrieval with Optimized Projection**:
  ```javascript
  // Binary photoData and modules are excluded for high-speed listing
  db.courses.find({ isActive: true })
      .projection({ photoData: 0, modules: 0 })
      .sort({ title: 1 });
  ```
- **Photo Serving Query**:
  ```javascript
  db.courses.findOne(
      { _id: ObjectId("course_id") },
      { photoData: 1, photoContentType: 1 }
  );
  ```
- **Wishlist / Saved Courses with Joins (`$lookup` / `.populate`)**:
  ```javascript
  db.studentsavedcourses.find({ studentAccount: studentAccountId })
      .sort({ savedAt: -1 });
  // Populates referenced Course document metadata
  ```

**3. Update Operations**
- **Idempotent Upsert for Course Wishlist**:
  ```javascript
  db.studentsavedcourses.updateOne(
      { studentAccount: studentAccountId, course: courseId },
      { $setOnInsert: { savedAt: new Date() } },
      { upsert: true }
  );
  ```
- **Marking a Lesson Complete (`$addToSet`)**:
  ```javascript
  db.enrollments.updateOne(
      { _id: enrollmentId },
      {
          $addToSet: { completedLessons: lessonId },
          $set: { lastLesson: lessonId, lastActivityAt: new Date() }
      }
  );
  ```
- **Updating Course Metadata and Capacity**:
  ```javascript
  db.courses.updateOne(
      { _id: courseId },
      {
          $set: {
              title: "Operating System",
              capacity: 40,
              photoData: BinData(0, "<new_photo_data>"),
              photoContentType: "image/jpeg"
          }
      }
  );
  ```

**4. Delete Operations**
- **Removing a Saved Course**:
  ```javascript
  db.studentsavedcourses.deleteOne({
      studentAccount: studentAccountId,
      course: courseId
  });
  ```
- **User Sign-Out (Session Invalidation)**:
  ```javascript
  db.studentsessions.deleteOne({
      tokenHash: "<sha256_hash_of_cookie_token>"
  });
  ```
- **Removing Lesson Learning Material**:
  ```javascript
  db.courselearningmaterials.deleteOne({
      _id: materialId,
      course: courseId
  });
  ```

---

## Security notes

- Keep `.env` out of source control; it contains database connection details.
- Set `NODE_ENV=production` when deploying so session and CSRF cookies use the
  `Secure` attribute. Serve the app over HTTPS in production.
- Use a strong database credential and restrict database network access to
  trusted hosts.

