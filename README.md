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
   the app after changing role configuration.

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
| `GET /signup` and `POST /signup` | Create an account |
| `GET /login` and `POST /login` | Sign in |
| `GET /teacher/signup` and `POST /teacher/signup` | Create a teacher account |
| `GET /teacher/login` and `POST /teacher/login` | Sign in as a teacher |
| `POST /logout` | Sign out |
| `GET /dashboard` | Redirect to the signed-in user's role-specific dashboard |
| `GET /profile` and `POST /profile` | View and update the signed-in profile |
| `POST /enroll` | Enroll in an available course |
| `GET /teacher` | Teacher overview and management for the teacher's courses |
| `GET /admin` | Admin overview of accounts, courses, and enrollments |
| `/manage/courses/*` | Create, edit, publish, or archive courses (teacher/admin) |

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

Signed-in students' saved courses are stored as separate student/course records; guest catalog
favorites remain browser-local. Weekly goals default to 300 minutes and can be
set from 30 minutes to 1,680 minutes in 30-minute increments. Lesson activity
is recorded once per student/course/lesson when completion is submitted;
weekly minutes use the lesson's configured duration, not measured time-on-page.
Activity streaks and weekly summaries therefore begin accumulating from lesson
completions recorded after this feature is deployed. Activity dates use UTC.

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
- **StudentAccount** — name, unique email, password hash and salt, student/teacher role, and weekly learning goal.
- **StudentSession** — hashed session token, account reference, and expiration.
- **StudentSavedCourse** — a referenced student/course wishlist entry with a unique compound index.
- **Enrollment** — student and course references, completed lesson IDs, last
  lesson and activity time, enrollment date, and a unique course/email pair
  to prevent duplicate enrollments.
- **StudentLearningActivity** — one estimated-duration activity record per
  completed student/course/lesson, with a unique compound index.

## Security notes

- Keep `.env` out of source control; it contains database connection details.
- Set `NODE_ENV=production` when deploying so session and CSRF cookies use the
  `Secure` attribute. Serve the app over HTTPS in production.
- Use a strong database credential and restrict database network access to
  trusted hosts.
