import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './src/lib/server/db/schema';
import { v4 as uuidv4 } from 'uuid';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
}

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function seed() {
    console.log('Seeding database...');

    // 1. Create OR Update Instructor
    const instructorId = 'instructor-1'; // Fixed ID
    await db.insert(schema.user).values({
        id: instructorId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        emailVerified: true,
        role: 'instructor',
        createdAt: new Date(),
        updatedAt: new Date(),
    }).onConflictDoUpdate({
        target: schema.user.email,
        set: { name: 'Jane Doe', role: 'instructor' }
    });

    // 2. Courses Data
    const coursesData = [
        {
            title: 'Luxurious Skincare 101',
            subtitle: 'Master the art of glow',
            description: 'Learn the secrets of premium skincare routines and the science behind the glow.',
            fullDescription: `
<h1>Unlock Your Best Skin</h1>
<p>This comprehensive course takes you through the fundamentals of skincare, from understanding your skin type to building a routine that works for you.</p>
<h2>What You'll Learn</h2>
<ul>
    <li>Identifying your unique skin type</li>
    <li>The science of ingredients (Retinol, Vitamin C, Hyaluronic Acid)</li>
    <li>Building a morning and evening routine</li>
    <li>Diet and lifestyle factors</li>
</ul>
<p>Join us on this journey to healthier, glowing skin.</p>
            `,
            slug: 'skincare-101',
            price: 4900,
            isPublished: true,
            instructorId,
        },
        {
            title: 'Advanced Anti-Aging',
            subtitle: 'Reverse the clock with science',
            description: 'A deep dive into advanced anti-aging treatments and ingredients.',
            fullDescription: `
<h1>Turn Back Time</h1>
<p>Discover the latest advancements in anti-aging technology and treatments. This course is designed for those who want to go beyond the basics.</p>
<h2>Course Highlights</h2>
<ul>
    <li>Peptides and Growth Factors</li>
    <li>Advanced exfoliation techniques</li>
    <li>Professional treatments (Microneedling, Laser)</li>
    <li>Preventative measures</li>
</ul>
            `,
            slug: 'advanced-anti-aging',
            price: 9900,
            isPublished: true,
            instructorId,
        }
    ];

    for (const courseData of coursesData) {
        // Check if course exists
        const existingCourse = await db.query.courses.findFirst({
            where: (courses, { eq }) => eq(courses.slug, courseData.slug)
        });

        let courseId;
        if (existingCourse) {
            console.log(`Updating course: ${courseData.title}`);
            courseId = existingCourse.id;
            await db.update(schema.courses).set({
                ...courseData,
                updatedAt: new Date(),
            }).where(eq(schema.courses.id, courseId));
        } else {
            console.log(`Creating course: ${courseData.title}`);
            courseId = uuidv4();
            await db.insert(schema.courses).values({
                id: courseId,
                ...courseData,
            });
        }
        
        // 3. Modules - Cleanup and Re-insert to ensure clean state
        // Delete all modules for this course (cascades to lessons usually, checking schema)
        // Schema says: lessons -> modules (onDelete cascade). modules -> courses (onDelete cascade).
        // BUT wait, if we have users progress? We might wipe it.
        // For SEEDING in dev, wiping is usually acceptable.
        // To be safe, we'll delete modules with specific titles or just all for this course since it's "seed".
        
        // Let's just delete all modules for the course to avoid duplicates.
        // Note: This wipes progress for these specific demo courses.
        await db.delete(schema.modules).where(eq(schema.modules.courseId, courseId));

        const moduleId = uuidv4();
        await db.insert(schema.modules).values({
            id: moduleId,
            courseId: courseId,
            title: 'Getting Started',
            description: 'Introduction to the course and basics.',
            order: 1,
        });

        // 4. Create Lessons
        await db.insert(schema.lessons).values([
            {
                id: uuidv4(),
                moduleId,
                title: 'Welcome to the Course',
                content: '<h1>Welcome!</h1><p>We are glad to have you here.</p>',
                type: 'video',
                order: 1,
            },
            {
                id: uuidv4(),
                moduleId,
                title: 'Skin Types Overview',
                content: '<p>Understanding different skin types is the first step.</p>',
                type: 'text',
                isFreePreview: true,
                order: 2,
            }
        ]);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
