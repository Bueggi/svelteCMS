
import { db } from '../server/db';
import { courses } from '../server/db/schema';

async function check() {
    const allCourses = await db.select().from(courses);
    console.log(JSON.stringify(allCourses.map(c => ({ title: c.title, thumbnailUrl: c.thumbnailUrl })), null, 2));
}

check();
