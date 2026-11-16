const fs = require('fs');
const path = require('path');
const https = require('https');
const mongoose = require('mongoose');
require('dotenv').config();

const COURSE_PHOTOS = {
    'DBMS-101': {
        title: 'Database Management Systems',
        url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&q=80'
    },
    'WEB-110': {
        title: 'Web Development Fundamentals',
        url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'
    },
    'DSA-120': {
        title: 'Data Structures & Algorithms',
        url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&q=80'
    },
    'PY-130': {
        title: 'Python Programming',
        url: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&q=80'
    },
    'JAVA-140': {
        title: 'Java Programming',
        url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80'
    },
    'JS-150': {
        title: 'JavaScript for the Web',
        url: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&q=80'
    },
    'HTML-160': {
        title: 'HTML and CSS Essentials',
        url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80'
    },
    'SQL-170': {
        title: 'SQL Fundamentals',
        url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80'
    },
    'AI-180': {
        title: 'Introduction to Artificial Intelligence',
        url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80'
    },
    'ML-190': {
        title: 'Machine Learning Basics',
        url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80'
    },
    'STAT-210': {
        title: 'Statistics for Computing',
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80'
    },
    'DS-201': {
        title: 'Data Science Foundations',
        url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80'
    },
    'SEC-240': {
        title: 'Cybersecurity Fundamentals',
        url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'
    },
    'OS-220': {
        title: 'Operating Systems',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80'
    },
    'NET-230': {
        title: 'Computer Networks',
        url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80'
    },
    'CLOUD-250': {
        title: 'Cloud Computing Basics',
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80'
    },
    'UX-260': {
        title: 'UI and UX Design',
        url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80'
    },
    'MOB-270': {
        title: 'Mobile App Development',
        url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80'
    },
    'DSA-290': {
        title: 'Problem Solving with Algorithms',
        url: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80'
    },
    'GIT-280': {
        title: 'Git and Collaborative Development',
        url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80'
    },
    'LINUX-330': {
        title: 'Linux Command Line',
        url: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=800&q=80'
    },
    'IOT-301': {
        title: 'Internet of Things',
        url: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=800&q=80'
    },
    'BIG-320': {
        title: 'Big Data Concepts',
        url: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80'
    },
    'MATH-340': {
        title: 'Discrete Mathematics',
        url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80'
    },
    'SE-310': {
        title: 'Software Engineering',
        url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80'
    }
};

function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        function get(targetUrl) {
            https.get(targetUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return get(res.headers.location);
                }
                if (res.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    return reject(new Error(`Status ${res.statusCode} for ${targetUrl}`));
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve(destPath));
                });
            }).on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => {});
                reject(err);
            });
        }
        get(url);
    });
}

function getCoursePhotoContentType(buffer) {
    if (!buffer || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
        buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return 'image/png';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
}

async function run() {
    const outputDir = path.join(__dirname, '..', 'public', 'images', 'courses');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('--- Step 1: Downloading Course Photos ---');
    for (const [code, info] of Object.entries(COURSE_PHOTOS)) {
        const filePath = path.join(outputDir, `${code}.jpg`);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
            console.log(`[Cache] ${code} already exists (${fs.statSync(filePath).size} bytes)`);
            continue;
        }
        try {
            console.log(`[Download] Fetching ${code} (${info.title})...`);
            await downloadImage(info.url, filePath);
            const size = fs.statSync(filePath).size;
            console.log(`[Done] ${code} saved (${size} bytes)`);
        } catch (err) {
            console.error(`[Error] Failed to download for ${code}:`, err.message);
        }
    }

    console.log('\n--- Step 2: Connecting to MongoDB and Updating Courses ---');
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in environment');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');

    const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));
    const allCourses = await Course.find({}).lean();
    console.log(`Found ${allCourses.length} courses in database.`);

    let updatedCount = 0;
    for (const course of allCourses) {
        // If course already has photoData, skip unless missing contentType
        if (course.photoData && course.photoContentType) {
            console.log(`[Skip] Course ${course.code} already has a photo.`);
            continue;
        }

        const localFile = path.join(outputDir, `${course.code}.jpg`);
        let buffer = null;
        let contentType = null;

        if (fs.existsSync(localFile)) {
            buffer = fs.readFileSync(localFile);
            contentType = getCoursePhotoContentType(buffer);
        }

        if (!buffer || !contentType) {
            // Check fallback for any unmatched custom course: use general tech fallback
            const fallbackFile = path.join(outputDir, 'DBMS-101.jpg');
            if (fs.existsSync(fallbackFile)) {
                buffer = fs.readFileSync(fallbackFile);
                contentType = getCoursePhotoContentType(buffer);
            }
        }

        if (buffer && contentType) {
            await Course.updateOne(
                { _id: course._id },
                {
                    $set: {
                        photoData: buffer,
                        photoContentType: contentType
                    }
                }
            );
            console.log(`[Updated] Course ${course.code} (${course.title}) updated with photo (${contentType}, ${buffer.length} bytes)`);
            updatedCount++;
        } else {
            console.warn(`[Warning] No photo available for course ${course.code}`);
        }
    }

    console.log(`\nFinished! Successfully updated ${updatedCount} courses.`);
    process.exit(0);
}

run().catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
});
