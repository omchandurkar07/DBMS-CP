const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const CourseAnnouncement = require('../models/CourseAnnouncement');
const CourseReview = require('../models/CourseReview');

function validReview(overrides = {}) {
    return {
        course: new mongoose.Types.ObjectId(),
        studentAccount: new mongoose.Types.ObjectId(),
        authorName: 'CourseHub Student',
        rating: 5,
        comment: 'Clear lessons and helpful examples.',
        ...overrides
    };
}

function validAnnouncement(overrides = {}) {
    return {
        course: new mongoose.Types.ObjectId(),
        authorAccount: new mongoose.Types.ObjectId(),
        authorAccountModel: 'TeacherAccount',
        authorName: 'CourseHub Teacher',
        title: 'Welcome to the course',
        message: 'Please review the first lesson before class.',
        ...overrides
    };
}

test('course reviews validate ratings, names, and comment length', async () => {
    await assert.doesNotReject(new CourseReview(validReview()).validate());

    for (const rating of [0, 6, 2.5]) {
        await assert.rejects(new CourseReview(validReview({ rating })).validate());
    }

    await assert.rejects(
        new CourseReview(validReview({ comment: 'x'.repeat(1001) })).validate()
    );
});

test('course reviews enforce one review per student and course', () => {
    const hasUniqueCourseStudentIndex = CourseReview.schema.indexes().some(([fields, options]) =>
        fields.course === 1 && fields.studentAccount === 1 && options.unique
    );

    assert.equal(hasUniqueCourseStudentIndex, true);
});

test('announcements require a supported author and bounded title and message', async () => {
    await assert.doesNotReject(new CourseAnnouncement(validAnnouncement()).validate());

    await assert.rejects(new CourseAnnouncement(validAnnouncement({
        authorAccountModel: 'UnsupportedAccount'
    })).validate());
    await assert.rejects(new CourseAnnouncement(validAnnouncement({
        title: 'x'.repeat(121)
    })).validate());
    await assert.rejects(new CourseAnnouncement(validAnnouncement({
        message: 'x'.repeat(2001)
    })).validate());
});

test('announcements have a course and creation-time index for the student feed', () => {
    const hasCourseFeedIndex = CourseAnnouncement.schema.indexes().some(([fields]) =>
        fields.course === 1 && fields.createdAt === -1
    );

    assert.equal(hasCourseFeedIndex, true);
});
