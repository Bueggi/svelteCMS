import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('Drizzle Schema Definitions', () => {
    it('should have a users table with expected columns', () => {
        expect(schema.users).toBeDefined();
        expect(schema.users.email).toBeDefined();
        expect(schema.users.role).toBeDefined();
    });

    it('should have a courses table with instructor relationship', () => {
        expect(schema.courses).toBeDefined();
        expect(schema.courses.instructorId).toBeDefined();
    });

    it('should have community relationship definitions', () => {
        expect(schema.communityPostsRelations).toBeDefined();
        expect(schema.communityCommentsRelations).toBeDefined();
    });

    it('should have calendar and event tables', () => {
        expect(schema.calendarEvents).toBeDefined();
        expect(schema.eventRegistrations).toBeDefined();
    });

    it('should have commerce/purchase tables', () => {
        expect(schema.purchases).toBeDefined();
    });
});
