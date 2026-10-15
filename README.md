# CourseHub

CourseHub is a course discovery and student learning application built with
Node.js, Express, EJS, and MongoDB. Students can browse and compare courses,
create an account, enroll, and keep track of their learning.

## Features

- Browse active courses and filter by search term, subject category, or seat availability.
- View course details, including instructor, duration, enrollment, and capacity.
- Compare up to three courses from the catalog.
- Sign up, sign in, update a profile, and sign out.
- Enroll in courses and view enrollments on the **My learning** page.
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
   To grant a role, first create the account, verify its identity, and add its
   MongoDB `_id` to `ADMIN_ACCOUNT_IDS` or `TEACHER_ACCOUNT_IDS`. Find an
   account ID in MongoDB with
   `db.studentaccounts.findOne({ email: "admin@example.com" }, { _id: 1 })`.
   Separate multiple IDs with commas. Admin takes precedence if an ID appears
   in both lists. Accounts not listed in either setting have the student role.
   Restart the app after changing role configuration. Roles are deliberately
   not selectable during public signup.

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
| `GET /courses` | Course catalog with search and filters |
| `GET /courses/:courseId` | Course details |
| `GET /signup` and `POST /signup` | Create an account |
| `GET /login` and `POST /login` | Sign in |
| `POST /logout` | Sign out |
| `GET /dashboard` | Redirect to the signed-in user's role-specific dashboard |
| `GET /profile` and `POST /profile` | View and update the signed-in profile |
| `GET /my-learning` | View the signed-in student's enrollments |
| `POST /enroll` | Enroll in an available course |
| `GET /teacher` | Teacher overview and management for the teacher's courses |
| `GET /admin` | Admin overview of accounts, courses, and enrollments |
| `/manage/courses/*` | Create, edit, publish, or archive courses (teacher/admin) |

Profile, enrollment, and learning pages require a signed-in account. Teacher
and administrator routes additionally require the matching configured role.
Teachers can edit and archive only courses they created; administrators can
manage any course. Archiving hides a course from the public catalog without
deleting its enrollment history.

## Project structure

```text
.
├── components/     Shared EJS page components
├── models/         Mongoose models for courses, accounts, sessions, and enrollments
├── public/         Client-side JavaScript and CSS
├── views/          EJS pages and view components
├── index.js        Express application, routes, and startup logic
└── package.json    Dependencies and npm scripts
```

## Data models

- **Course** — course code, title, category, instructor, description, duration,
  capacity, creator reference, and active status.
- **StudentAccount** — student name, unique email, and password hash and salt.
- **StudentSession** — hashed session token, account reference, and expiration.
- **Enrollment** — student and course references, enrollment date, and a unique
  course/email pair to prevent duplicate enrollments.

## Security notes

- Keep `.env` out of source control; it contains database connection details.
- Set `NODE_ENV=production` when deploying so session and CSRF cookies use the
  `Secure` attribute. Serve the app over HTTPS in production.
- Use a strong database credential and restrict database network access to
  trusted hosts.
