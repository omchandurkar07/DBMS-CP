require('dotenv').config();

const mongoose = require('mongoose');

const destinationName = 'coursehub';
const teacherAccountIds = new Set(
    (process.env.TEACHER_ACCOUNT_IDS || '')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean)
);

if ([...teacherAccountIds].some((id) => !/^[a-f0-9]{24}$/.test(id))) {
    throw new Error('TEACHER_ACCOUNT_IDS must contain comma-separated 24-character MongoDB account IDs.');
}

function isTeacherAccount(account) {
    return account.role === 'teacher' || teacherAccountIds.has(account._id.toString().toLowerCase());
}

function accountModelForId(accountId) {
    return teacherAccountIdsFromSource.has(accountId.toString().toLowerCase())
        ? 'TeacherAccount'
        : 'StudentAccount';
}

const teacherAccountIdsFromSource = new Set();

async function ensureCollection(database, name) {
    if (!await database.listCollections({ name }, { nameOnly: true }).hasNext()) {
        await database.createCollection(name);
    }
}

async function copyCollection(sourceCollection, destinationDatabase, destinationName, transform) {
    await ensureCollection(destinationDatabase, destinationName);
    const destinationCollection = destinationDatabase.collection(destinationName);
    let batch = [];
    let copied = 0;
    for await (const sourceDocument of sourceCollection.find({}).batchSize(100)) {
        const document = transform ? transform(sourceDocument) : sourceDocument;
        if (!document) {
            continue;
        }
        batch.push(document);
        if (batch.length === 100) {
            await destinationCollection.insertMany(batch, { ordered: true });
            copied += batch.length;
            batch = [];
        }
    }
    if (batch.length) {
        await destinationCollection.insertMany(batch, { ordered: true });
        copied += batch.length;
    }
    return copied;
}

async function copyAccountCollection(sourceCollection, destinationDatabase) {
    await ensureCollection(destinationDatabase, 'studentaccounts');
    await ensureCollection(destinationDatabase, 'teacheraccounts');
    const studentAccounts = destinationDatabase.collection('studentaccounts');
    const teacherAccounts = destinationDatabase.collection('teacheraccounts');
    let copiedStudents = 0;
    let copiedTeachers = 0;
    let studentBatch = [];
    let teacherBatch = [];

    const saveBatch = async () => {
        if (studentBatch.length) {
            await studentAccounts.insertMany(studentBatch, { ordered: true });
            copiedStudents += studentBatch.length;
            studentBatch = [];
        }
        if (teacherBatch.length) {
            await teacherAccounts.insertMany(teacherBatch, { ordered: true });
            copiedTeachers += teacherBatch.length;
            teacherBatch = [];
        }
    };

    for await (const account of sourceCollection.find({}).batchSize(100)) {
        if (isTeacherAccount(account)) {
            account.role = 'teacher';
            teacherAccountIdsFromSource.add(account._id.toString().toLowerCase());
            teacherBatch.push(account);
        } else {
            account.role = 'student';
            studentBatch.push(account);
        }
        if (studentBatch.length + teacherBatch.length === 100) {
            await saveBatch();
        }
    }
    await saveBatch();
    return { studentaccounts: copiedStudents, teacheraccounts: copiedTeachers };
}

async function copyTeacherAccounts(sourceCollection, destinationDatabase) {
    await ensureCollection(destinationDatabase, 'teacheraccounts');
    const destinationCollection = destinationDatabase.collection('teacheraccounts');
    let copied = 0;
    for await (const account of sourceCollection.find({}).batchSize(100)) {
        account.role = 'teacher';
        await destinationCollection.replaceOne({ _id: account._id }, account, { upsert: true });
        copied += 1;
    }
    return copied;
}

async function migrate() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in the environment.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    const sourceDatabase = mongoose.connection.db;
    if (sourceDatabase.databaseName === destinationName) {
        throw new Error(`MONGO_URI already points to ${destinationName}; set it to the source database before migrating.`);
    }

    const destinationDatabase = mongoose.connection.useDb(destinationName).db;
    const destinationCollections = await destinationDatabase.listCollections({}, { nameOnly: true }).toArray();
    if (destinationCollections.length) {
        throw new Error(`Refusing to overwrite non-empty ${destinationName} database.`);
    }

    const sourceCollections = await sourceDatabase.listCollections({}, { nameOnly: true }).toArray();
    const accountCollection = sourceCollections.find((collection) => collection.name === 'studentaccounts');
    if (!accountCollection) {
        throw new Error(`Source database ${sourceDatabase.databaseName} has no studentaccounts collection.`);
    }

    const configuredTeacherAccounts = (process.env.TEACHER_ACCOUNT_IDS || '')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean);
    configuredTeacherAccounts.forEach((id) => teacherAccountIdsFromSource.add(id));
    for await (const account of sourceDatabase.collection('studentaccounts')
        .find({ role: 'teacher' }, { projection: { _id: 1 } }).batchSize(100)) {
        teacherAccountIdsFromSource.add(account._id.toString().toLowerCase());
    }
    if (sourceCollections.some((collection) => collection.name === 'teacheraccounts')) {
        for await (const account of sourceDatabase.collection('teacheraccounts').find({}, {
            projection: { _id: 1 }
        }).batchSize(100)) {
            teacherAccountIdsFromSource.add(account._id.toString().toLowerCase());
        }
    }

    const copied = {};
    for (const { name } of sourceCollections) {
        if (name.startsWith('system.')) {
            continue;
        }
        if (name === 'studentaccounts') {
            Object.assign(copied, await copyAccountCollection(sourceDatabase.collection(name), destinationDatabase));
            continue;
        }
        if (name === 'teacheraccounts') {
            copied.teacheraccounts += await copyTeacherAccounts(sourceDatabase.collection(name), destinationDatabase);
            continue;
        }
        if (name === 'studentsessions' || name === 'passwordresettokens') {
            copied[name] = await copyCollection(
                sourceDatabase.collection(name),
                destinationDatabase,
                name,
                (document) => {
                    document.accountModel = accountModelForId(document.account);
                    return document;
                }
            );
            continue;
        }
        if (name === 'courses') {
            copied[name] = await copyCollection(
                sourceDatabase.collection(name),
                destinationDatabase,
                name,
                (document) => {
                    if (document.createdBy) {
                        document.createdByModel = accountModelForId(document.createdBy);
                    }
                    return document;
                }
            );
            continue;
        }
        copied[name] = await copyCollection(sourceDatabase.collection(name), destinationDatabase, name);
    }

    for (const { name } of sourceCollections) {
        if (name === 'studentaccounts' || name === 'teacheraccounts' || name.startsWith('system.')) {
            continue;
        }
        const sourceCount = await sourceDatabase.collection(name).countDocuments();
        const destinationCount = await destinationDatabase.collection(name).countDocuments();
        if (sourceCount !== destinationCount) {
            throw new Error(`Document count mismatch after copying ${name}: ${sourceCount} != ${destinationCount}.`);
        }
    }
    const sourceAccountCount =
        await sourceDatabase.collection('studentaccounts').countDocuments() +
        (sourceCollections.some((collection) => collection.name === 'teacheraccounts')
            ? await sourceDatabase.collection('teacheraccounts').countDocuments()
            : 0);
    const destinationAccountCount =
        await destinationDatabase.collection('studentaccounts').countDocuments() +
        await destinationDatabase.collection('teacheraccounts').countDocuments();
    if (sourceAccountCount !== destinationAccountCount) {
        throw new Error(`Document count mismatch after splitting accounts: ${sourceAccountCount} != ${destinationAccountCount}.`);
    }

    console.log(JSON.stringify({
        sourceDatabase: sourceDatabase.databaseName,
        destinationDatabase: destinationName,
        copied
    }, null, 2));
}

migrate()
    .catch((error) => {
        console.error('CourseHub database migration failed:', error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
