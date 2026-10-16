const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { promisify } = require('util');
const { createHash, randomBytes, scrypt, timingSafeEqual } = require('crypto');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const StudentAccount = require('./models/StudentAccount');
const StudentLearningActivity = require('./models/StudentLearningActivity');
const StudentSavedCourse = require('./models/StudentSavedCourse');
const StudentSession = require('./models/StudentSession');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sessionCookieName = 'coursehub_session';
const csrfCookieName = 'coursehub_csrf';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const scryptAsync = promisify(scrypt);
const coursePhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 700, fieldSize: 22000, parts: 710 },
    fileFilter(req, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('Upload a JPEG, PNG, or WebP image.'));
        }
        return callback(null, true);
    }
});

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
    profileGoalUpdated: { type: 'success', message: 'Your weekly learning goal has been updated.' },
    learningGoalInvalid: { type: 'error', message: 'Choose a weekly learning goal from 30 to 1,680 minutes in 30-minute increments.' },
    savedCourseRemoved: { type: 'success', message: 'The course was removed from your saved courses.' },
    courseCreated: { type: 'success', message: 'The course has been created.' },
    courseUpdated: { type: 'success', message: 'The course has been updated.' },
    courseStatusUpdated: { type: 'success', message: 'The course status has been updated.' },
    lessonCompleted: { type: 'success', message: 'Lesson completed. Your course progress has been updated.' },
    lessonUnavailable: { type: 'error', message: 'That lesson could not be found in this course.' }
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
    }).select('-photoData -modules').sort({ title: 1 }).lean();
    const enrollmentCounts = await Enrollment.aggregate([
        { $match: { course: { $in: courseDocuments.map((course) => course._id) } } },
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

function parseCoursePhoto(req, res, next) {
    coursePhotoUpload.single('photo')(req, res, (error) => {
        if (!error) {
            return next();
        }
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).send('Course photos must be 5 MB or smaller.');
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).send('The course form contains too many or oversized fields.');
        }
        if (error.message === 'Upload a JPEG, PNG, or WebP image.') {
            return res.status(400).send(error.message);
        }
        return next(error);
    });
}

function getCoursePhotoContentType(buffer) {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

function generateCourseCode(title) {
    const prefix = title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 7) || 'COURSE';
    return `${prefix}-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;
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
        StudentAccount.findById(req.user._id)
            .select('_id name email role createdAt weeklyLearningGoalMinutes')
            .lean(),
        Enrollment.countDocuments({ studentAccount: req.user._id })
    ]);

    if (!account) {
        return res.redirect('/login');
    }

    return res.render('Profile.ejs', {
        account: { ...account, role: req.user.role },
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

app.post('/profile/learning-goal', requireAuth, requireRole('student'), requireCsrf, async (req, res) => {
    const minutesValue = typeof req.body.weeklyLearningGoalMinutes === 'string'
        ? req.body.weeklyLearningGoalMinutes.trim()
        : '';
    const minutes = /^\d+$/.test(minutesValue) ? Number(minutesValue) : NaN;
    if (!Number.isSafeInteger(minutes) || minutes < 30 || minutes > 1680 || minutes % 30 !== 0) {
        return res.redirect('/profile?status=learningGoalInvalid');
    }

    const updateResult = await StudentAccount.updateOne(
        { _id: req.user._id },
        { $set: { weeklyLearningGoalMinutes: minutes } },
        { runValidators: true }
    );
    if (!updateResult.matchedCount) {
        return res.redirect('/login');
    }
    return res.redirect('/profile?status=profileGoalUpdated');
});

app.get('/saved-courses', requireAuth, requireRole('student'), async (req, res) => {
    const savedCourses = await StudentSavedCourse.find({ studentAccount: req.user._id })
        .sort({ savedAt: -1 })
        .populate({
            path: 'course',
            select: 'title category instructor description duration capacity photoContentType updatedAt isActive'
        })
        .lean();
    return res.render('SavedCourses.ejs', {
        courses: savedCourses.map((savedCourse) => savedCourse.course).filter(Boolean),
        notice: getNotice(req)
    });
});

app.post('/saved-courses/:courseId', requireAuth, requireRole('student'), requireCsrf, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId) ||
        !['true', 'false', true, false].includes(req.body.saved)) {
        return res.status(400).json({ error: 'Choose whether to save or remove this course.' });
    }
    const saved = req.body.saved === 'true' || req.body.saved === true;
    if (saved) {
        const courseExists = await Course.exists({ _id: req.params.courseId, isActive: true });
        if (!courseExists) {
            return res.status(404).json({ error: 'Only active courses can be saved.' });
        }
    }

    if (saved) {
        try {
            await StudentSavedCourse.updateOne(
                { studentAccount: req.user._id, course: req.params.courseId },
                { $setOnInsert: { savedAt: new Date() } },
                { upsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }
        }
    } else {
        await StudentSavedCourse.deleteOne({
            studentAccount: req.user._id,
            course: req.params.courseId
        });
    }
    const savedCourseCount = await StudentSavedCourse.countDocuments({ studentAccount: req.user._id });

    if (req.is('application/json')) {
        return res.json({ saved, savedCourseCount });
    }
    return res.redirect(saved ? '/saved-courses' : '/saved-courses?status=savedCourseRemoved');
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
    const sort = ['title', 'newest', 'popular'].includes(req.query.sort) ? req.query.sort : 'title';
    const requestedPage = typeof req.query.page === 'string' && /^\d+$/.test(req.query.page) &&
        Number.isSafeInteger(Number(req.query.page))
        ? Math.min(Number(req.query.page), 1000000)
        : 1;
    const pageSize = 9;
    const courseFilter = {};

    if (search) {
        const searchExpression = new RegExp(escapeRegex(search), 'i');
        courseFilter.$or = [
            { title: searchExpression },
            { category: searchExpression },
            { instructor: searchExpression },
            { description: searchExpression }
        ];
    }

    if (category) {
        courseFilter.category = category;
    }

    const sortOptions = {
        title: { title: 1 },
        newest: { createdAt: -1, title: 1 },
        popular: { enrollmentCount: -1, title: 1 }
    };
    const pipeline = [
        { $match: { isActive: true, ...courseFilter } },
        {
            $lookup: {
                from: Enrollment.collection.name,
                let: { courseId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$course', '$$courseId'] } } },
                    { $count: 'count' }
                ],
                as: 'enrollmentStats'
            }
        },
        {
            $addFields: {
                enrollmentCount: { $ifNull: [{ $arrayElemAt: ['$enrollmentStats.count', 0] }, 0] }
            }
        },
        ...(availability === 'available' ? [{
            $match: { $expr: { $lt: ['$enrollmentCount', '$capacity'] } }
        }] : []),
        {
            $facet: {
                metadata: [{ $count: 'total' }],
                courses: [
                    { $sort: sortOptions[sort] },
                    { $skip: (Math.max(requestedPage, 1) - 1) * pageSize },
                    { $limit: pageSize },
                    { $project: { photoData: 0, modules: 0, enrollmentStats: 0 } }
                ]
            }
        }
    ];
    const [result] = await Course.aggregate(pipeline);
    const totalCourses = result.metadata[0] ? result.metadata[0].total : 0;
    const pageCount = Math.ceil(totalCourses / pageSize);
    const page = pageCount ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
    const courses = page === requestedPage
        ? result.courses
        : await Course.aggregate([
            ...pipeline.slice(0, -1),
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    courses: [
                        { $sort: sortOptions[sort] },
                        { $skip: (page - 1) * pageSize },
                        { $limit: pageSize },
                        { $project: { photoData: 0, modules: 0, enrollmentStats: 0 } }
                    ]
                }
            }
        ]).then(([pageResult]) => pageResult.courses);
    const [categories, savedCoursesAccount] = await Promise.all([
        Course.distinct('category', { isActive: true }),
        req.user && req.user.role === 'student'
            ? StudentSavedCourse.find({ studentAccount: req.user._id }).select('course').lean()
            : Promise.resolve(null)
    ]);
    const savedCourseIds = savedCoursesAccount
        ? savedCoursesAccount.map((savedCourse) => savedCourse.course.toString())
        : [];

    res.render('Courses.ejs', {
        courses,
        savedCourseIds,
        persistedFavorites: Boolean(savedCoursesAccount),
        savedCourseCount: savedCoursesAccount ? savedCoursesAccount.length : 0,
        categories: categories.sort((first, second) => first.localeCompare(second)),
        filters: { search, category, availability, sort, page, pageCount, totalCourses },
        notice: getNotice(req)
    });
});

app.get('/courses/:courseId', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
        return res.status(404).render('NotFound.ejs');
    }

    let course = await Course.findOne({
        _id: req.params.courseId,
        isActive: true
    }).select('title category instructor description duration capacity photoContentType updatedAt modules.title modules.lessons.title modules.lessons.summary modules.lessons.durationMinutes').lean();
    if (!course && req.user && req.user.role === 'student') {
        const isEnrolled = await Enrollment.exists({
            course: req.params.courseId,
            studentAccount: req.user._id
        });
        if (isEnrolled) {
            course = await Course.findById(req.params.courseId)
                .select('title category instructor description duration capacity photoContentType updatedAt modules.title modules.lessons.title modules.lessons.summary modules.lessons.durationMinutes')
                .lean();
        }
    }
    if (!course) {
        return res.status(404).render('NotFound.ejs');
    }

    course.enrollmentCount = await Enrollment.countDocuments({ course: course._id });
    const enrollment = req.user && req.user.role === 'student'
        ? await Enrollment.findOne({ course: course._id, studentAccount: req.user._id }).lean()
        : null;
    const learningEnrollment = enrollment
        ? prepareEnrollmentForLearning({ ...enrollment, course })
        : null;
    return res.render('CourseDetails.ejs', {
        course,
        learningEnrollment,
        notice: getNotice(req)
    });
});

app.get('/courses/:courseId/photo', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
        return res.sendStatus(404);
    }

    const course = await Course.findById(req.params.courseId)
        .select('photoData photoContentType')
        .lean();
    if (!course || !course.photoData || !course.photoContentType) {
        return res.sendStatus(404);
    }

    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=300');
    return res.type(course.photoContentType).send(course.photoData);
});

function prepareEnrollmentForLearning(enrollment) {
    if (!enrollment.course) {
        return { ...enrollment, progress: 0, completedLessonCount: 0, lessonCount: 0, continueUrl: null };
    }
    const lessons = (enrollment.course.modules || []).flatMap((module) => module.lessons);
    const lessonIds = new Set(lessons.map((lesson) => lesson._id.toString()));
    const completedIds = new Set(
        (enrollment.completedLessons || [])
            .map((lessonId) => lessonId.toString())
            .filter((lessonId) => lessonIds.has(lessonId))
    );
    const completedLessonCount = completedIds.size;
    const progress = lessons.length ? Math.round(completedLessonCount / lessons.length * 100) : 0;
    const lastLessonId = enrollment.lastLesson && enrollment.lastLesson.toString();
    const nextLesson = lessons.find((lesson) => lesson._id.toString() === lastLessonId && !completedIds.has(lastLessonId)) ||
        lessons.find((lesson) => !completedIds.has(lesson._id.toString())) ||
        lessons[lessons.length - 1];

    return {
        ...enrollment,
        progress,
        completedLessonCount,
        lessonCount: lessons.length,
        continueUrl: nextLesson
            ? `/learn/${enrollment.course._id}/${nextLesson._id}`
            : `/courses/${enrollment.course._id}`
    };
}

async function getStudentLearningEnrollments(studentAccountId) {
    const enrollments = await Enrollment.find({ studentAccount: studentAccountId })
        .populate('course', 'title category instructor photoContentType duration modules.title modules.lessons.title modules.lessons.durationMinutes')
        .sort({ lastActivityAt: -1, enrolledAt: -1 })
        .lean();
    return enrollments.map(prepareEnrollmentForLearning);
}

async function getStudentActivitySummary(studentAccountId, now = new Date()) {
    const dayMilliseconds = 24 * 60 * 60 * 1000;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7);
    const activities = await StudentLearningActivity.aggregate([
        { $match: { studentAccount: new mongoose.Types.ObjectId(studentAccountId) } },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$activityAt',
                        timezone: 'UTC'
                    }
                },
                minutes: { $sum: '$minutes' },
                lessons: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }
    ]);
    const activityByDay = new Map(activities.map((activity) => [
        activity._id,
        { minutes: activity.minutes, lessons: activity.lessons }
    ]));
    let weeklyMinutes = 0;
    let weeklyLessons = 0;
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const todayKey = today.toISOString().slice(0, 10);
    for (const [dateKey, activity] of activityByDay) {
        if (dateKey >= weekStartKey && dateKey <= todayKey) {
            weeklyMinutes += activity.minutes;
            weeklyLessons += activity.lessons;
        }
    }

    const activeDays = new Set(activityByDay.keys());
    const streakStart = new Date(today);
    if (!activeDays.has(streakStart.toISOString().slice(0, 10))) {
        streakStart.setUTCDate(streakStart.getUTCDate() - 1);
    }
    let streakDays = 0;
    while (activeDays.has(streakStart.toISOString().slice(0, 10))) {
        streakDays += 1;
        streakStart.setUTCDate(streakStart.getUTCDate() - 1);
    }

    const week = Array.from({ length: 7 }, (_, index) => {
        const dayDate = new Date(weekStart.getTime() + index * dayMilliseconds);
        const dateKey = dayDate.toISOString().slice(0, 10);
        const day = activityByDay.get(dateKey) || { minutes: 0, lessons: 0 };
        return {
            date: dateKey,
            label: dayDate.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
            minutes: day.minutes,
            lessons: day.lessons
        };
    });

    return {
        weeklyMinutes,
        weeklyLessons,
        streakDays,
        week,
        weekStart: weekStart.toISOString()
    };
}

app.get('/my-learning', requireAuth, requireRole('student'), async (req, res) => {
    const studentEmail = req.user.email;
    const [enrollments, accountAndSavedCount, activity] = await Promise.all([
        getStudentLearningEnrollments(req.user._id),
        Promise.all([
            StudentAccount.findById(req.user._id).select('weeklyLearningGoalMinutes').lean(),
            StudentSavedCourse.countDocuments({ studentAccount: req.user._id })
        ]),
        getStudentActivitySummary(req.user._id)
    ]);
    const inProgressCount = enrollments.filter((enrollment) => enrollment.progress < 100).length;
    const completedCount = enrollments.filter((enrollment) => enrollment.progress === 100).length;
    const completedLessonCount = enrollments.reduce(
        (total, enrollment) => total + enrollment.completedLessonCount,
        0
    );
    const [account, savedCourseCount] = accountAndSavedCount;
    const weeklyLearningGoalMinutes = account ? account.weeklyLearningGoalMinutes || 300 : 300;
    activity.goalProgress = Math.min(100, Math.round(activity.weeklyMinutes / weeklyLearningGoalMinutes * 100));

    return res.render('MyLearning.ejs', {
        enrollments,
        stats: {
            enrolledCount: enrollments.length,
            inProgressCount,
            completedCount,
            completedLessonCount
        },
        activity,
        weeklyLearningGoalMinutes,
        savedCourseCount,
        studentEmail,
        studentName: req.user.name,
        notice: getNotice(req)
    });
});

app.get('/my-courses', requireAuth, requireRole('student'), async (req, res) => {
    const status = ['in-progress', 'completed'].includes(req.query.status) ? req.query.status : 'all';
    let enrollments = await getStudentLearningEnrollments(req.user._id);
    if (status === 'completed') {
        enrollments = enrollments.filter((enrollment) => enrollment.progress === 100);
    } else if (status === 'in-progress') {
        enrollments = enrollments.filter((enrollment) => enrollment.progress < 100);
    }
    return res.render('MyCourses.ejs', { enrollments, status, notice: getNotice(req) });
});

app.get('/learn/:courseId/:lessonId', requireAuth, requireRole('student'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId) || !mongoose.isValidObjectId(req.params.lessonId)) {
        return res.status(404).render('NotFound.ejs');
    }

    const [course, enrollment] = await Promise.all([
        Course.findById(req.params.courseId)
            .select('title modules.title modules.lessons.title modules.lessons.summary modules.lessons.content modules.lessons.videoUrl modules.lessons.durationMinutes')
            .lean(),
        Enrollment.findOne({ course: req.params.courseId, studentAccount: req.user._id })
    ]);
    if (!course || !enrollment) {
        return res.status(404).render('NotFound.ejs');
    }

    const lessons = (course.modules || []).flatMap((module) =>
        module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title }))
    );
    const lessonIndex = lessons.findIndex((lesson) => lesson._id.toString() === req.params.lessonId);
    if (lessonIndex === -1) {
        return res.status(404).render('NotFound.ejs');
    }

    const lesson = lessons[lessonIndex];
    const completedIds = new Set((enrollment.completedLessons || []).map((id) => id.toString()));
    const progress = lessons.length ? Math.round(
        lessons.filter((item) => completedIds.has(item._id.toString())).length / lessons.length * 100
    ) : 0;
    await Enrollment.updateOne(
        { _id: enrollment._id },
        { $set: { lastLesson: lesson._id, lastActivityAt: new Date() } }
    );

    return res.render('Lesson.ejs', {
        course,
        lesson,
        lessons,
        lessonIndex,
        completed: completedIds.has(lesson._id.toString()),
        progress,
        notice: getNotice(req)
    });
});

app.post('/learn/:courseId/:lessonId/complete', requireAuth, requireRole('student'), requireCsrf, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId) || !mongoose.isValidObjectId(req.params.lessonId)) {
        return res.status(404).render('NotFound.ejs');
    }

    const course = await Course.findById(req.params.courseId)
        .select('modules._id modules.lessons._id modules.lessons.durationMinutes')
        .lean();
    const lesson = course && (course.modules || []).flatMap((module) => module.lessons)
        .find((item) => item._id.toString() === req.params.lessonId);
    if (!lesson) {
        return res.redirect('/my-courses?status=lessonUnavailable');
    }

    const enrollment = await Enrollment.findOneAndUpdate(
        { course: req.params.courseId, studentAccount: req.user._id },
        {
            $addToSet: { completedLessons: new mongoose.Types.ObjectId(req.params.lessonId) },
            $set: { lastLesson: new mongoose.Types.ObjectId(req.params.lessonId), lastActivityAt: new Date() }
        },
        { new: true }
    );
    if (!enrollment) {
        return res.status(403).send('Enroll in this course before marking lessons complete.');
    }

    try {
        await StudentLearningActivity.updateOne(
            {
                studentAccount: req.user._id,
                course: course._id,
                lesson: lesson._id
            },
            {
                $setOnInsert: {
                    minutes: lesson.durationMinutes,
                    activityAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) {
            throw error;
        }
    }

    const allLessonIds = (course.modules || []).flatMap((module) => module.lessons.map((lesson) => lesson._id.toString()));
    const completedIds = new Set((enrollment.completedLessons || []).map((id) => id.toString()));
    if (allLessonIds.length > 0 && allLessonIds.every((lessonId) => completedIds.has(lessonId))) {
        enrollment.completedAt = enrollment.completedAt || new Date();
        await enrollment.save();
    }

    return res.redirect(`/learn/${req.params.courseId}/${req.params.lessonId}?status=lessonCompleted`);
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
            .populate('course', 'title category photoContentType')
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

function getCourseInput(body, user, options = {}) {
    const text = (field) => typeof body[field] === 'string' ? body[field].trim() : '';
    const capacityValue = text('capacity');
    const capacity = /^\d+$/.test(capacityValue) ? Number(capacityValue) : NaN;
    const rawModules = Array.isArray(body.modules) ? body.modules : [];
    let hasInvalidVideoUrl = false;
    const modules = rawModules.map((rawModule) => {
        const module = rawModule && typeof rawModule === 'object' ? rawModule : {};
        const lessons = Array.isArray(module.lessons) ? module.lessons.map((rawLesson) => {
            const lesson = rawLesson && typeof rawLesson === 'object' ? rawLesson : {};
            const durationValue = typeof lesson.durationMinutes === 'string'
                ? lesson.durationMinutes.trim()
                : '';
            let videoUrl = typeof lesson.videoUrl === 'string' ? lesson.videoUrl.trim() : '';
            if (videoUrl) {
                try {
                    const parsedUrl = new URL(videoUrl);
                    if (parsedUrl.protocol !== 'https:') {
                        hasInvalidVideoUrl = true;
                    }
                } catch {
                    hasInvalidVideoUrl = true;
                }
            }
            return {
                ...(mongoose.isValidObjectId(lesson._id) ? { _id: lesson._id } : {}),
                title: typeof lesson.title === 'string' ? lesson.title.trim() : '',
                summary: typeof lesson.summary === 'string' ? lesson.summary.trim() : '',
                content: typeof lesson.content === 'string' ? lesson.content.trim() : '',
                videoUrl,
                durationMinutes: /^\d+$/.test(durationValue) ? Number(durationValue) : NaN
            };
        }) : [];
        return {
            ...(mongoose.isValidObjectId(module._id) ? { _id: module._id } : {}),
            title: typeof module.title === 'string' ? module.title.trim() : '',
            lessons
        };
    });
    const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);
    const totalDuration = modules.reduce(
        (total, module) => total + module.lessons.reduce((sum, lesson) =>
            sum + (Number.isSafeInteger(lesson.durationMinutes) ? lesson.durationMinutes : 0), 0),
        0
    );
    const calculatedDuration = totalDuration >= 60
        ? `${Number((totalDuration / 60).toFixed(1))} hours`
        : `${totalDuration} min`;
    const course = {
        title: text('title'),
        category: text('category'),
        instructor: user.role === 'admin' ? text('instructor') : user.name,
        description: text('description'),
        duration: totalDuration ? calculatedDuration : (options.fallbackDuration || ''),
        capacity
    };
    if (modules.length || body.curriculumPresent === 'true') {
        course.modules = modules;
    }

    if ((options.requireCurriculum && modules.length === 0) || modules.length > 30 || lessonCount > 100 ||
        modules.some((module) => !module.title || module.title.length > 120 ||
            module.lessons.length === 0 || module.lessons.length > 50 ||
            module.lessons.some((lesson) => !lesson.title || lesson.title.length > 120 ||
                lesson.summary.length > 500 || lesson.content.length > 20000 ||
                !Number.isSafeInteger(lesson.durationMinutes) ||
                lesson.durationMinutes < 1 || lesson.durationMinutes > 600))) {
        return {
            course,
            error: 'Add valid modules and lessons. Each lesson needs a title and duration from 1 to 600 minutes.'
        };
    }
    if (hasInvalidVideoUrl) {
        return { course, error: 'Lesson video links must use a valid HTTPS URL.' };
    }

    if (!course.title || course.title.length > 120 ||
        !course.category || course.category.length > 60 ||
        !course.instructor || course.instructor.length > 80 ||
        !course.description || course.description.length > 500 ||
        !course.duration || course.duration.length > 40 ||
        !Number.isSafeInteger(course.capacity) || course.capacity < 1) {
        return { course, error: 'Complete every field with valid values. Capacity must be positive and lessons need valid durations.' };
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
    return Course.findOne(filter).select('-photoData');
}

app.get('/manage/courses/new', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
    return res.render('CourseForm.ejs', {
        course: {
            capacity: 30,
            modules: [{ title: '', lessons: [{ title: '', durationMinutes: 10 }] }]
        },
        error: '',
        returnPath: courseDashboardPath(req.user)
    });
});

app.post('/manage/courses', requireAuth, requireRole('teacher', 'admin'), parseCoursePhoto, requireCsrf, async (req, res) => {
    const { course, error } = getCourseInput(req.body, req.user, { requireCurriculum: true });
    const returnPath = courseDashboardPath(req.user);
    if (error) {
        return res.status(400).render('CourseForm.ejs', { course, error, returnPath });
    }
    const photoContentType = req.file && getCoursePhotoContentType(req.file.buffer);
    if (!photoContentType) {
        return res.status(400).render('CourseForm.ejs', {
            course,
            error: req.file
                ? 'The uploaded file is not a valid JPEG, PNG, or WebP image.'
                : 'Upload a course photo before creating the course.',
            returnPath
        });
    }

    try {
        await Course.create({
            ...course,
            code: generateCourseCode(course.title),
            photoData: req.file.buffer,
            photoContentType,
            createdBy: req.user._id
        });
    } catch (createError) {
        if (createError.code === 11000) {
            return res.status(409).render('CourseForm.ejs', {
                course,
                error: 'The course could not be assigned a unique internal identifier. Please try again.',
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

app.post('/manage/courses/:courseId', requireAuth, requireRole('teacher', 'admin'), parseCoursePhoto, requireCsrf, async (req, res) => {
    const existingCourse = await findManageableCourse(req.params.courseId, req.user);
    if (!existingCourse) {
        return res.status(404).render('NotFound.ejs');
    }

    const { course, error } = getCourseInput(req.body, req.user, {
        fallbackDuration: existingCourse.duration
    });
    const returnPath = courseDashboardPath(req.user);
    course._id = existingCourse._id;
    course.isActive = existingCourse.isActive;
    course.photoContentType = existingCourse.photoContentType;
    course.modules = course.modules || existingCourse.modules;
    if (error) {
        return res.status(400).render('CourseForm.ejs', { course, error, returnPath });
    }
    const photoContentType = req.file && getCoursePhotoContentType(req.file.buffer);
    if (req.file && !photoContentType) {
        return res.status(400).render('CourseForm.ejs', {
            course,
            error: 'The uploaded file is not a valid JPEG, PNG, or WebP image.',
            returnPath
        });
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
        if (req.file) {
            courseFields.photoData = req.file.buffer;
            courseFields.photoContentType = photoContentType;
        }
        await Course.updateOne(
            { _id: existingCourse._id },
            { $set: courseFields },
            { runValidators: true }
        );
    } catch (updateError) {
        if (updateError.code === 11000) {
            return res.status(409).render('CourseForm.ejs', {
                course,
                error: 'The course could not be saved. Please try again.',
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

app.post('/enroll', requireAuth, requireRole('student'), requireCsrf, async (req, res) => {
    const studentName = req.user.name;
    const studentEmail = req.user.email;
    const courseId = typeof req.body.courseId === 'string' ? req.body.courseId : '';

    if (!mongoose.isValidObjectId(courseId)) {
        return res.redirect('/courses?status=invalid');
    }

    const course = await Course.findOne({ _id: courseId, isActive: true })
        .select('-photoData')
        .lean();
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
            course: course._id,
            lastActivityAt: new Date()
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
        StudentLearningActivity.init(),
        StudentSavedCourse.init(),
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
