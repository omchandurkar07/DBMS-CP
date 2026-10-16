const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { promisify } = require('util');
const { createHash, randomBytes, scrypt, timingSafeEqual } = require('crypto');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const StudentAccount = require('./models/StudentAccount');
const StudentSession = require('./models/StudentSession');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sessionCookieName = 'coursehub_session';
const csrfCookieName = 'coursehub_csrf';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const scryptAsync = promisify(scrypt);

function parseConfiguredAccountIds(variableName) {
    const accountIds = (process.env[variableName] || '')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean);
    if (accountIds.some((id) => !/^[a-f0-9]{24}$/.test(id))) {
        throw new Error(`${variableName} must contain comma-separated 24-character MongoDB account IDs`);
    }
    return new Set(accountIds);
}

const adminAccountIds = parseConfiguredAccountIds('ADMIN_ACCOUNT_IDS');
const teacherAccountIds = parseConfiguredAccountIds('TEACHER_ACCOUNT_IDS');

const notices = {
    enrolled: { type: 'success', message: 'You are enrolled! Your course is listed under My learning.' },
    invalid: { type: 'error', message: 'Your request could not be validated. Please try again.' },
    course: { type: 'error', message: 'That course is unavailable. Please refresh and choose another course.' },
    duplicate: { type: 'error', message: 'You are already enrolled in that course.' },
    full: { type: 'error', message: 'That course is full. Please choose another course.' },
    signedUp: { type: 'success', message: 'Your account is ready. You are now signed in.' },
    signedOut: { type: 'success', message: 'You have been signed out.' },
    profileUpdated: { type: 'success', message: 'Your profile has been updated.' },
    profileInvalid: { type: 'error', message: 'Enter a name between 1 and 80 characters.' },
    courseCreated: { type: 'success', message: 'The course has been created.' },
    courseUpdated: { type: 'success', message: 'The course has been updated.' },
    courseStatusUpdated: { type: 'success', message: 'The course status has been updated.' }
};

function getNotice(req) {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    return notices[status] || null;
}

function getConfiguredRole(account) {
    const normalizedId = account._id.toString().toLowerCase();
    if (adminAccountIds.has(normalizedId)) {
        return 'admin';
    }
    if (teacherAccountIds.has(normalizedId)) {
        return 'teacher';
    }
    return account.role || 'student';
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCookies(header = '') {
    const cookies = new Map();
    header.split(';').forEach((part) => {
        const separator = part.indexOf('=');
        if (separator < 1) {
            return;
        }
        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        try {
            cookies.set(name, decodeURIComponent(value));
        } catch {
            cookies.set(name, '');
        }
    });
    return cookies;
}

function cookieOptions(maxAge) {
    return [
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(maxAge / 1000)}`,
        ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])
    ].join('; ');
}

function csrfCookieOptions(maxAge) {
    return [
        'Path=/',
        'SameSite=Strict',
        `Max-Age=${Math.floor(maxAge / 1000)}`,
        ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])
    ].join('; ');
}

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function safeNextPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
        value.startsWith('/login') || value.startsWith('/signup') || value.startsWith('/logout')) {
        return '/dashboard';
    }
    return value;
}

function safeEqual(first, second) {
    if (typeof first !== 'string' || typeof second !== 'string') {
        return false;
    }
    const firstBuffer = Buffer.from(first);
    const secondBuffer = Buffer.from(second);
    return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

function requireAuth(req, res, next) {
    if (!req.user) {
        const requestedPath = req.path === '/enroll' && mongoose.isValidObjectId(req.body.courseId)
            ? `/courses/${req.body.courseId}`
            : `${req.path}${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`;
        const returnTo = encodeURIComponent(requestedPath);
        return res.redirect(`/login?next=${returnTo}`);
    }
    return next();
}

function requireCsrf(req, res, next) {
    if (!safeEqual(req.body._csrf, req.csrfToken)) {
        return res.status(403).send('Your session expired or this request could not be verified. Refresh the page and try again.');
    }
    return next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).send('You do not have permission to access this page.');
        }
        return next();
    };
}

async function createStudentSession(account, res) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    await StudentSession.create({
        tokenHash: hashToken(token),
        account: account._id,
        expiresAt
    });
    res.append('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; ${cookieOptions(sessionLifetimeMs)}`);
}

async function getCoursesWithEnrollmentCounts(courseFilter = {}, includeInactive = false) {
    const courseDocuments = await Course.find({
        ...(!includeInactive ? { isActive: true } : {}),
        ...courseFilter
    }).sort({ title: 1 }).lean();
    const enrollmentCounts = await Enrollment.aggregate([
        { $group: { _id: '$course', count: { $sum: 1 } } }
    ]);
    const countByCourse = new Map(
        enrollmentCounts.map((item) => [item._id.toString(), item.count])
    );

    return courseDocuments.map((course) => ({
        ...course,
        enrollmentCount: countByCourse.get(course._id.toString()) || 0
    }));
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/media/coursehub-background.mp4', (req, res, next) => {
    res.sendFile(path.join(__dirname, '8675557-hd_1920_1080_30fps.mp4'), (error) => {
        if (error) {
            next(error);
        }
    });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(async (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    let csrfToken = cookies.get(csrfCookieName);
    if (!csrfToken || !/^[a-f0-9]{64}$/.test(csrfToken)) {
        csrfToken = randomBytes(32).toString('hex');
        res.append('Set-Cookie', `${csrfCookieName}=${csrfToken}; ${csrfCookieOptions(sessionLifetimeMs)}`);
    }
    req.csrfToken = csrfToken;
    res.locals.csrfToken = csrfToken;
    res.locals.currentUser = null;

    const sessionToken = cookies.get(sessionCookieName);
    if (sessionToken && /^[A-Za-z0-9_-]{40,60}$/.test(sessionToken)) {
        const session = await StudentSession.findOne({
            tokenHash: hashToken(sessionToken),
            expiresAt: { $gt: new Date() }
        }).lean();
        if (session) {
            const account = await StudentAccount.findById(session.account)
                .select('_id name email role')
                .lean();
            if (account) {
                const user = { ...account, role: getConfiguredRole(account) };
                req.user = user;
                res.locals.currentUser = user;
            } else {
                await StudentSession.deleteOne({ _id: session._id });
                res.append('Set-Cookie', `${sessionCookieName}=; ${cookieOptions(0)}`);
            }
        } else {
            res.append('Set-Cookie', `${sessionCookieName}=; ${cookieOptions(0)}`);
        }
    }
    return next();
});

function renderAuthPage(req, res, mode, authRole, authError = '') {
    if (req.user) {
        return res.redirect(safeNextPath(req.query.next));
    }
    return res.render('Auth.ejs', {
        mode,
        authRole,
        nextPath: safeNextPath(req.query.next),
        authError: authError || (typeof req.query.error === 'string' ? req.query.error : '')
    });
}

function createSignupHandler(authRole) {
    return async (req, res) => {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const nextPath = safeNextPath(req.body.next);

        if (!name || name.length > 80 || !emailPattern.test(email) || email.length > 254 ||
            password.length < 8 || password.length > 128) {
            return res.status(400).render('Auth.ejs', {
                mode: 'signup',
                authRole,
                nextPath,
                authError: 'Enter a name, a valid email, and a password between 8 and 128 characters.'
            });
        }

        const passwordSalt = randomBytes(16).toString('hex');
        const passwordHash = (await scryptAsync(password, passwordSalt, 64)).toString('hex');
        let account;
        try {
            account = await StudentAccount.create({ name, email, passwordHash, passwordSalt, role: authRole });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).render('Auth.ejs', {
                    mode: 'signup',
                    authRole,
                    nextPath,
                    authError: 'An account with that email already exists. Sign in instead.'
                });
            }
            throw error;
        }

        await createStudentSession(account, res);
        return res.redirect(nextPath);
    };
}

function createLoginHandler(authRole) {
    return async (req, res) => {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const nextPath = safeNextPath(req.body.next);
        const account = emailPattern.test(email) && email.length <= 254 && password.length <= 128
            ? await StudentAccount.findOne({ email })
            : null;
        const attemptedHash = await scryptAsync(
            password.slice(0, 128),
            account ? account.passwordSalt : 'coursehub-login-dummy-salt',
            64
        );
        const storedHash = account ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(64);
        if (!account || storedHash.length !== attemptedHash.length ||
            !timingSafeEqual(storedHash, attemptedHash)) {
            return res.status(401).render('Auth.ejs', {
                mode: 'login',
                authRole,
                nextPath,
                authError: 'Email or password is incorrect.'
            });
        }

        if (authRole === 'teacher' && getConfiguredRole(account) !== 'teacher') {
            return res.status(403).render('Auth.ejs', {
                mode: 'login',
                authRole,
                nextPath,
                authError: 'This account does not have teacher access. Create a teacher account or use student sign-in.'
            });
        }

        await createStudentSession(account, res);
        return res.redirect(nextPath);
    };
}

app.get('/signup', (req, res) => renderAuthPage(req, res, 'signup', 'student'));
app.get('/teacher/signup', (req, res) => renderAuthPage(req, res, 'signup', 'teacher'));
app.post('/signup', requireCsrf, createSignupHandler('student'));
app.post('/teacher/signup', requireCsrf, createSignupHandler('teacher'));

app.get('/login', (req, res) => renderAuthPage(req, res, 'login', 'student'));
app.get('/teacher/login', (req, res) => renderAuthPage(req, res, 'login', 'teacher'));
app.post('/login', requireCsrf, createLoginHandler('student'));
app.post('/teacher/login', requireCsrf, createLoginHandler('teacher'));

app.get('/dashboard', requireAuth, (req, res) => {
    if (req.user.role === 'admin') {
        return res.redirect('/admin');
    }
    if (req.user.role === 'teacher') {
        return res.redirect('/teacher');
    }
    return res.redirect('/my-learning');
});

app.post('/logout', requireAuth, requireCsrf, async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(sessionCookieName);
    if (sessionToken) {
        await StudentSession.deleteOne({ tokenHash: hashToken(sessionToken) });
    }
    res.append('Set-Cookie', `${sessionCookieName}=; ${cookieOptions(0)}`);
    return res.redirect('/?status=signedOut');
});

app.get('/profile', requireAuth, async (req, res) => {
    const [account, enrollmentCount] = await Promise.all([
        StudentAccount.findById(req.user._id).select('_id name email createdAt').lean(),
        Enrollment.countDocuments({ studentAccount: req.user._id })
    ]);

    if (!account) {
        return res.redirect('/login');
    }

    return res.render('Profile.ejs', {
        account,
        enrollmentCount,
        notice: getNotice(req)
    });
});

app.post('/profile', requireAuth, requireCsrf, async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
        return res.status(400).redirect('/profile?status=profileInvalid');
    }

    const account = await StudentAccount.findByIdAndUpdate(
        req.user._id,
        { $set: { name } },
        { new: true, runValidators: true }
    ).select('_id name email');

    if (!account) {
        return res.redirect('/login');
    }

    return res.redirect('/profile?status=profileUpdated');
});

app.get('/', async (req, res) => {
    const [courses, categories] = await Promise.all([
        getCoursesWithEnrollmentCounts(),
        Course.distinct('category', { isActive: true })
    ]);
    const featuredCourses = courses
        .sort((first, second) => second.enrollmentCount - first.enrollmentCount ||
            first.title.localeCompare(second.title))
        .slice(0, 3);

    return res.render('Home.ejs', {
        featuredCourses,
        courseCount: courses.length,
        categoryCount: categories.length,
        categories: categories.sort((first, second) => first.localeCompare(second)),
        notice: getNotice(req)
    });
});

app.get('/courses', async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const category = typeof req.query.category === 'string'
        ? req.query.category.trim().slice(0, 60)
        : '';
    const availability = req.query.availability === 'available' ? 'available' : '';
    const courseFilter = {};

    if (search) {
        const searchExpression = new RegExp(escapeRegex(search), 'i');
        courseFilter.$or = [
            { title: searchExpression },
            { code: searchExpression },
            { category: searchExpression },
            { instructor: searchExpression },
            { description: searchExpression }
        ];
    }

    if (category) {
        courseFilter.category = category;
    }

    let courses = await getCoursesWithEnrollmentCounts(courseFilter);
    if (availability === 'available') {
        courses = courses.filter((course) => course.enrollmentCount < course.capacity);
    }
    const categories = await Course.distinct('category', { isActive: true });

    res.render('Courses.ejs', {
        courses,
        categories: categories.sort((first, second) => first.localeCompare(second)),
        filters: { search, category, availability },
        notice: getNotice(req)
    });
});

app.get('/courses/:courseId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
        return res.status(404).render('NotFound.ejs');
    }

    const course = await Course.findOne({
        _id: req.params.courseId,
        isActive: true
    }).lean();
    if (!course) {
        return res.status(404).render('NotFound.ejs');
    }

    course.enrollmentCount = await Enrollment.countDocuments({ course: course._id });
    return res.render('CourseDetails.ejs', {
        course,
        notice: getNotice(req)
    });
});

app.get('/my-learning', requireAuth, async (req, res) => {
    const studentEmail = req.user.email;
    const enrollments = await Enrollment.find({ studentAccount: req.user._id })
        .populate('course', 'title code instructor')
        .sort({ enrolledAt: -1 })
        .lean();

    return res.render('MyLearning.ejs', {
        enrollments,
        studentEmail,
        studentName: req.user.name,
        notice: getNotice(req)
    });
});

app.get('/teacher', requireAuth, requireRole('teacher'), async (req, res) => {
    const [courses, courseCount, activeCourseCount, enrollmentCount, studentCount] = await Promise.all([
        getCoursesWithEnrollmentCounts({ createdBy: req.user._id }, true),
        Course.countDocuments(),
        Course.countDocuments({ isActive: true }),
        Enrollment.countDocuments(),
        StudentAccount.countDocuments()
    ]);

    return res.render('TeacherDashboard.ejs', {
        courses,
        overview: { courseCount, activeCourseCount, enrollmentCount, studentCount },
        notice: getNotice(req)
    });
});

app.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
    const [accounts, courses, enrollments] = await Promise.all([
        StudentAccount.find().select('_id name email role createdAt').sort({ createdAt: -1 }).lean(),
        getCoursesWithEnrollmentCounts({}, true),
        Enrollment.find()
            .populate('studentAccount', 'name email')
            .populate('course', 'code title')
            .sort({ enrolledAt: -1 })
            .lean()
    ]);

    return res.render('AdminDashboard.ejs', {
        accounts: accounts.map((account) => ({
            ...account,
            role: getConfiguredRole(account)
        })),
        courses,
        enrollments,
        notice: getNotice(req)
    });
});

function getCourseInput(body, user) {
    const text = (field) => typeof body[field] === 'string' ? body[field].trim() : '';
    const capacityValue = text('capacity');
    const capacity = /^\d+$/.test(capacityValue) ? Number(capacityValue) : NaN;
    const course = {
        code: text('code').toUpperCase(),
        title: text('title'),
        category: text('category'),
        instructor: user.role === 'admin' ? text('instructor') : user.name,
        description: text('description'),
        duration: text('duration'),
        capacity
    };

    if (!course.code || course.code.length > 32 ||
        !course.title || course.title.length > 120 ||
        !course.category || course.category.length > 60 ||
        !course.instructor || course.instructor.length > 80 ||
        !course.description || course.description.length > 500 ||
        !course.duration || course.duration.length > 40 ||
        !Number.isSafeInteger(course.capacity) || course.capacity < 1) {
        return { course, error: 'Complete every field with valid values. Capacity must be a positive whole number.' };
    }

    return { course, error: null };
}

function courseDashboardPath(user) {
    return user.role === 'admin' ? '/admin' : '/teacher';
}

async function findManageableCourse(courseId, user) {
    if (!mongoose.isValidObjectId(courseId)) {
        return null;
    }

    const filter = { _id: courseId };
    if (user.role !== 'admin') {
        filter.createdBy = user._id;
    }
    return Course.findOne(filter);
}

app.get('/manage/courses/new', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
    return res.render('CourseForm.ejs', {
        course: { capacity: 30 },
        error: '',
        returnPath: courseDashboardPath(req.user)
    });
});

app.post('/manage/courses', requireAuth, requireRole('teacher', 'admin'), requireCsrf, async (req, res) => {
    const { course, error } = getCourseInput(req.body, req.user);
    const returnPath = courseDashboardPath(req.user);
    if (error) {
        return res.status(400).render('CourseForm.ejs', { course, error, returnPath });
    }

    try {
        await Course.create({ ...course, createdBy: req.user._id });
    } catch (createError) {
        if (createError.code === 11000) {
            return res.status(409).render('CourseForm.ejs', {
                course,
                error: 'A course with that code already exists. Choose a unique course code.',
                returnPath
            });
        }
        throw createError;
    }

    return res.redirect(`${returnPath}?status=courseCreated`);
});

app.get('/manage/courses/:courseId/edit', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
    const course = await findManageableCourse(req.params.courseId, req.user);
    if (!course) {
        return res.status(404).render('NotFound.ejs');
    }

    return res.render('CourseForm.ejs', {
        course,
        error: '',
        returnPath: courseDashboardPath(req.user)
    });
});

app.post('/manage/courses/:courseId', requireAuth, requireRole('teacher', 'admin'), requireCsrf, async (req, res) => {
    const existingCourse = await findManageableCourse(req.params.courseId, req.user);
    if (!existingCourse) {
        return res.status(404).render('NotFound.ejs');
    }

    const { course, error } = getCourseInput(req.body, req.user);
    const returnPath = courseDashboardPath(req.user);
    course._id = existingCourse._id;
    course.isActive = existingCourse.isActive;
    if (error) {
        return res.status(400).render('CourseForm.ejs', { course, error, returnPath });
    }

    const enrollmentCount = await Enrollment.countDocuments({ course: existingCourse._id });
    if (course.capacity < enrollmentCount) {
        return res.status(400).render('CourseForm.ejs', {
            course,
            error: `Capacity cannot be lower than the ${enrollmentCount} existing enrollments.`,
            returnPath
        });
    }

    try {
        const courseFields = { ...course };
        delete courseFields._id;
        await Course.updateOne(
            { _id: existingCourse._id },
            { $set: courseFields },
            { runValidators: true }
        );
    } catch (updateError) {
        if (updateError.code === 11000) {
            return res.status(409).render('CourseForm.ejs', {
                course,
                error: 'A course with that code already exists. Choose a unique course code.',
                returnPath
            });
        }
        throw updateError;
    }

    return res.redirect(`${returnPath}?status=courseUpdated`);
});

app.post('/manage/courses/:courseId/status', requireAuth, requireRole('teacher', 'admin'), requireCsrf, async (req, res) => {
    if (req.body.isActive !== 'true' && req.body.isActive !== 'false') {
        return res.status(400).send('Choose a valid course status.');
    }

    const course = await findManageableCourse(req.params.courseId, req.user);
    if (!course) {
        return res.status(404).render('NotFound.ejs');
    }

    course.isActive = req.body.isActive === 'true';
    await course.save();
    return res.redirect(`${courseDashboardPath(req.user)}?status=courseStatusUpdated`);
});

app.post('/enroll', requireAuth, requireCsrf, async (req, res) => {
    const studentName = req.user.name;
    const studentEmail = req.user.email;
    const courseId = typeof req.body.courseId === 'string' ? req.body.courseId : '';

    if (!mongoose.isValidObjectId(courseId)) {
        return res.redirect('/courses?status=invalid');
    }

    const course = await Course.findOne({ _id: courseId, isActive: true }).lean();
    if (!course) {
        return res.redirect('/courses?status=course');
    }

    const alreadyEnrolled = await Enrollment.exists({
        course: course._id,
        studentAccount: req.user._id
    });
    if (alreadyEnrolled) {
        return res.redirect(`/courses/${course._id}?status=duplicate`);
    }

    const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
    if (enrollmentCount >= course.capacity) {
        return res.redirect(`/courses/${course._id}?status=full`);
    }

    try {
        await Enrollment.create({
            studentName,
            studentEmail,
            studentAccount: req.user._id,
            course: course._id
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.redirect(`/courses/${course._id}?status=duplicate`);
        }
        throw error;
    }

    return res.redirect('/my-learning?status=enrolled');
});

app.use((error, req, res, next) => {
    console.error('Request failed:', error);
    if (res.headersSent) {
        return next(error);
    }
    return res.status(500).send('Something went wrong while processing your request.');
});

async function seedCourses() {
    const courses = [
        {
            code: 'DBMS-101',
            title: 'Database Management Systems',
            category: 'Computer Science',
            instructor: 'Prof. A. Sharma',
            description: 'Learn relational data, SQL, normalization, and database design.',
            duration: '8 weeks',
            capacity: 40
        },
        {
            code: 'WEB-110',
            title: 'Web Development Fundamentals',
            category: 'Development',
            instructor: 'Prof. R. Mehta',
            description: 'Build a strong foundation in HTML, CSS, JavaScript, and the web.',
            duration: '6 weeks',
            capacity: 35
        },
        {
            code: 'DSA-120',
            title: 'Data Structures & Algorithms',
            category: 'Computer Science',
            instructor: 'Prof. S. Kulkarni',
            description: 'Practice essential data structures and problem-solving techniques.',
            duration: '10 weeks',
            capacity: 30
        },
        {
            code: 'PY-130',
            title: 'Python Programming',
            category: 'Programming',
            instructor: 'Prof. N. Joshi',
            description: 'Write Python programs using core syntax, functions, files, and modules.',
            duration: '7 weeks',
            capacity: 36
        },
        {
            code: 'JAVA-140',
            title: 'Java Programming',
            category: 'Programming',
            instructor: 'Prof. K. Desai',
            description: 'Learn object-oriented programming and build applications with Java.',
            duration: '8 weeks',
            capacity: 32
        },
        {
            code: 'JS-150',
            title: 'JavaScript for the Web',
            category: 'Development',
            instructor: 'Prof. R. Mehta',
            description: 'Add interactivity to websites with modern JavaScript fundamentals.',
            duration: '6 weeks',
            capacity: 35
        },
        {
            code: 'HTML-160',
            title: 'HTML and CSS Essentials',
            category: 'Development',
            instructor: 'Prof. P. Shah',
            description: 'Create accessible page structures and responsive layouts with HTML and CSS.',
            duration: '5 weeks',
            capacity: 40
        },
        {
            code: 'SQL-170',
            title: 'SQL Fundamentals',
            category: 'Data Science',
            instructor: 'Prof. A. Sharma',
            description: 'Query relational databases using filtering, joins, grouping, and subqueries.',
            duration: '5 weeks',
            capacity: 38
        },
        {
            code: 'AI-180',
            title: 'Introduction to Artificial Intelligence',
            category: 'Artificial Intelligence',
            instructor: 'Prof. M. Rao',
            description: 'Explore search, reasoning, and introductory AI problem-solving methods.',
            duration: '8 weeks',
            capacity: 28
        },
        {
            code: 'ML-190',
            title: 'Machine Learning Basics',
            category: 'Artificial Intelligence',
            instructor: 'Prof. M. Rao',
            description: 'Understand supervised learning, model evaluation, and common algorithms.',
            duration: '9 weeks',
            capacity: 28
        },
        {
            code: 'DS-201',
            title: 'Data Science Foundations',
            category: 'Data Science',
            instructor: 'Prof. T. Patil',
            description: 'Prepare, explore, and communicate insights from real-world datasets.',
            duration: '8 weeks',
            capacity: 32
        },
        {
            code: 'STAT-210',
            title: 'Statistics for Computing',
            category: 'Mathematics',
            instructor: 'Prof. S. Kulkarni',
            description: 'Learn probability and statistical methods used in computing and analytics.',
            duration: '7 weeks',
            capacity: 34
        },
        {
            code: 'OS-220',
            title: 'Operating Systems',
            category: 'Computer Science',
            instructor: 'Prof. V. Nair',
            description: 'Study processes, memory management, filesystems, and operating system concepts.',
            duration: '9 weeks',
            capacity: 30
        },
        {
            code: 'NET-230',
            title: 'Computer Networks',
            category: 'Computer Science',
            instructor: 'Prof. V. Nair',
            description: 'Understand network layers, addressing, routing, and internet protocols.',
            duration: '8 weeks',
            capacity: 30
        },
        {
            code: 'SEC-240',
            title: 'Cybersecurity Fundamentals',
            category: 'Cybersecurity',
            instructor: 'Prof. D. Kulkarni',
            description: 'Learn security principles, common threats, and defensive best practices.',
            duration: '7 weeks',
            capacity: 26
        },
        {
            code: 'CLOUD-250',
            title: 'Cloud Computing Basics',
            category: 'Cloud Computing',
            instructor: 'Prof. J. Fernandes',
            description: 'Explore cloud service models, deployment patterns, and scalable applications.',
            duration: '6 weeks',
            capacity: 30
        },
        {
            code: 'UX-260',
            title: 'UI and UX Design',
            category: 'Design',
            instructor: 'Prof. E. Thomas',
            description: 'Practice user research, wireframing, prototyping, and interface design.',
            duration: '6 weeks',
            capacity: 24
        },
        {
            code: 'MOB-270',
            title: 'Mobile App Development',
            category: 'Development',
            instructor: 'Prof. P. Shah',
            description: 'Learn the building blocks of mobile interfaces and app development.',
            duration: '8 weeks',
            capacity: 28
        },
        {
            code: 'GIT-280',
            title: 'Git and Collaborative Development',
            category: 'Development',
            instructor: 'Prof. R. Mehta',
            description: 'Track changes, manage branches, and collaborate with version control.',
            duration: '3 weeks',
            capacity: 40
        },
        {
            code: 'DSA-290',
            title: 'Problem Solving with Algorithms',
            category: 'Computer Science',
            instructor: 'Prof. S. Kulkarni',
            description: 'Build algorithmic thinking through complexity analysis and coding practice.',
            duration: '8 weeks',
            capacity: 30
        },
        {
            code: 'IOT-301',
            title: 'Internet of Things',
            category: 'Electronics',
            instructor: 'Prof. L. Iyer',
            description: 'Connect sensors and devices and learn the foundations of IoT systems.',
            duration: '7 weeks',
            capacity: 25
        },
        {
            code: 'SE-310',
            title: 'Software Engineering',
            category: 'Computer Science',
            instructor: 'Prof. K. Desai',
            description: 'Explore requirements, design, testing, and software project workflows.',
            duration: '8 weeks',
            capacity: 34
        },
        {
            code: 'BIG-320',
            title: 'Big Data Concepts',
            category: 'Data Science',
            instructor: 'Prof. T. Patil',
            description: 'Learn how large-scale data is stored, processed, and analyzed.',
            duration: '7 weeks',
            capacity: 26
        },
        {
            code: 'LINUX-330',
            title: 'Linux Command Line',
            category: 'Systems',
            instructor: 'Prof. D. Kulkarni',
            description: 'Work confidently with shell commands, files, permissions, and scripts.',
            duration: '4 weeks',
            capacity: 38
        },
        {
            code: 'MATH-340',
            title: 'Discrete Mathematics',
            category: 'Mathematics',
            instructor: 'Prof. S. Kulkarni',
            description: 'Study logic, sets, relations, graphs, and counting for computer science.',
            duration: '8 weeks',
            capacity: 34
        }
    ];

    await Course.bulkWrite(courses.map((course) => ({
        updateOne: {
            filter: { code: course.code },
            update: { $setOnInsert: course },
            upsert: true
        }
    })));
}

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in the environment');
    }

    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([
        Course.init(),
        Enrollment.init(),
        StudentAccount.init(),
        StudentSession.init()
    ]);
    await seedCourses();
    console.log('MongoDB connected');

    app.listen(port, () => {
        console.log(`CourseHub is running on port ${port}`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start the server:', error);
    process.exitCode = 1;
});
