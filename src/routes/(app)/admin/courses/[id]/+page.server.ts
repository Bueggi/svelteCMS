import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses, modules, lessons, communityCategories, moduleRatings } from '$lib/server/db/schema';
import { eq, asc, avg, count, inArray } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const courseId = params.id;

    const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId),
        with: {
            modules: {
                orderBy: [asc(modules.order)],
                with: {
                    lessons: {
                        orderBy: [asc(lessons.order)]
                    }
                }
            },
            communityCategories: {
                orderBy: [asc(communityCategories.order)]
            }
        }
    });

    if (!course) throw redirect(302, '/admin/courses');

    // Load avg module ratings (anonymous aggregates only — no user data exposed)
    const moduleIds = course?.modules.map(m => m.id) ?? [];
    const ratingRows = moduleIds.length > 0
        ? await db
            .select({
                moduleId: moduleRatings.moduleId,
                avgRating: avg(moduleRatings.rating),
                ratingCount: count(moduleRatings.id),
            })
            .from(moduleRatings)
            .where(inArray(moduleRatings.moduleId, moduleIds))
            .groupBy(moduleRatings.moduleId)
        : [];

    const moduleRatingMap: Record<string, { avg: number; count: number }> = {};
    for (const row of ratingRows) {
        moduleRatingMap[row.moduleId] = {
            avg: parseFloat(row.avgRating ?? '0'),
            count: row.ratingCount,
        };
    }

    return {
        course,
        moduleRatingMap,
    };
};

export const actions: Actions = {
    updateSettings: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const title = data.get('title') as string;
        const slug = data.get('slug') as string;
        const description = data.get('description') as string;
        const fullDescription = data.get('fullDescription') as string;
        const price = parseInt(data.get('price') as string) || 0;
        const isPublished = data.get('isPublished') === 'on';
        const accessType = data.get('accessType') as 'lifetime' | 'duration' | 'subscription';
        const accessDuration = parseInt(data.get('accessDuration') as string) || null;
        const thumbnailUrl = data.get('thumbnailUrl') as string;
        const communityEnabled = data.get('communityEnabled') === 'on';
        const trialDays = parseInt(data.get('trialDays') as string) || null;
        const subscriptionInterval = data.get('subscriptionInterval') === 'year' ? 'year' : 'month';

        // Installment plan — amount is entered in euros
        const installmentsEnabled = data.get('installmentsEnabled') === 'on';
        const installmentCount = parseInt(data.get('installmentCount') as string) || null;
        const installmentEuros = parseFloat(((data.get('installmentAmount') as string) || '').replace(',', '.'));
        const installmentAmount = Number.isFinite(installmentEuros) && installmentEuros > 0 ? Math.round(installmentEuros * 100) : null;

        if (installmentsEnabled) {
            if (accessType === 'subscription') {
                return fail(400, { message: 'Ratenzahlung ist nur für Kurse mit Einmalkauf möglich, nicht für Abos.' });
            }
            if (!installmentCount || installmentCount < 2 || installmentCount > 36) {
                return fail(400, { message: 'Bitte eine Anzahl von 2 bis 36 Raten angeben.' });
            }
            if (!installmentAmount) {
                return fail(400, { message: 'Bitte einen Betrag pro Rate angeben.' });
            }
        }

        try {
            await db.update(courses)
                .set({
                    title, slug, description, fullDescription, price, thumbnailUrl, isPublished, accessType, accessDuration, communityEnabled, trialDays,
                    subscriptionInterval, installmentsEnabled, installmentCount, installmentAmount,
                    updatedAt: new Date(),
                })
                .where(eq(courses.id, params.id));
            
            return { success: true };
        } catch (error) {
            console.error('Update settings error:', error);
            return fail(500, { message: 'Failed to update settings' });
        }
    },
    
    // Additional actions for modules/lessons will go here or in separate endpoints
    createModule: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const title = data.get('title') as string;
        const order = parseInt(data.get('order') as string) || 0;

        try {
            await db.insert(modules).values({
                courseId: params.id,
                title,
                order
            });
            return { success: true };
        } catch (error) {
            console.error('Create module error:', error);
            return fail(500, { message: 'Failed to create module' });
        }
    },

    deleteModule: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;

        if (!id) return fail(400, { message: 'Missing module ID' });

        try {
            await db.delete(modules).where(eq(modules.id, id));
            return { success: true };
        } catch (error) {
            console.error('Delete module error:', error);
            return fail(500, { message: 'Failed to delete module' });
        }
    },

    createLesson: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const moduleId = data.get('moduleId') as string;
        const title = data.get('title') as string;
        const type = data.get('type') as 'video' | 'text' | 'quiz';
        
        // Simple order Logic: put at end
        // For now, we'll just let it be 0 or random, reorder handles it better
        // ideally we fetch max order.

        try {
            await db.insert(lessons).values({
                moduleId,
                title,
                type: type || 'video',
                order: 999 // Placeholder, should be max + 1
            });
            return { success: true };
        } catch (error) {
            console.error('Create lesson error:', error);
            return fail(500, { message: 'Failed to create lesson' });
        }
    },

    deleteLesson: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;

        if (!id) return fail(400, { message: 'Missing lesson ID' });

        try {
            await db.delete(lessons).where(eq(lessons.id, id));
            return { success: true };
        } catch (error) {
            console.error('Delete lesson error:', error);
            return fail(500, { message: 'Failed to delete lesson' });
        }
    },

    updateModule: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;
        const title = data.get('title') as string;

        if (!id || !title) return fail(400, { message: 'Missing fields' });

        try {
            await db.update(modules).set({ title }).where(eq(modules.id, id));
            return { success: true };
        } catch (error) {
            console.error('Update module error:', error);
            return fail(500, { message: 'Failed to update module' });
        }
    },

    updateLesson: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;
        const title = data.get('title') as string;

        if (!id || !title) return fail(400, { message: 'Missing fields' });

        try {
            await db.update(lessons).set({ title }).where(eq(lessons.id, id));
            return { success: true };
        } catch (error) {
            console.error('Update lesson error:', error);
            return fail(500, { message: 'Failed to update lesson' });
        }
    },

    reorderCurriculum: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const payload = data.get('payload') as string;

        if (!payload) return fail(400, { message: 'Missing payload' });

        try {
            const { modules: updatedModules } = JSON.parse(payload);
            
            await db.transaction(async (tx) => {
                for (let i = 0; i < updatedModules.length; i++) {
                    const m = updatedModules[i];
                    await tx.update(modules)
                        .set({ order: i })
                        .where(eq(modules.id, m.id));
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Reorder error:', error);
            return fail(500, { message: 'Failed to reorder' });
        }
    },

    reorderLessons: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const payload = data.get('payload') as string;

        if (!payload) return fail(400, { message: 'Missing payload' });

        try {
            const { lessons: updatedLessons } = JSON.parse(payload);
            
            await db.transaction(async (tx) => {
                for (let i = 0; i < updatedLessons.length; i++) {
                    const l = updatedLessons[i];
                    await tx.update(lessons)
                        .set({ order: i })
                        .where(eq(lessons.id, l.id));
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Reorder lessons error:', error);
            return fail(500, { message: 'Failed to reorder lessons' });
        }
    },

    createCategory: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const name = data.get('name') as string;
        
        if (!name) return fail(400, { message: 'Name is required' });

        try {
            await db.insert(communityCategories).values({
                courseId: params.id,
                name,
                order: 99
            });
            return { success: true };
        } catch (error) {
            console.error('Create category error:', error);
            return fail(500, { message: 'Failed to create category' });
        }
    },

    updateCategory: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;
        const name = data.get('name') as string;

        if (!id || !name) return fail(400, { message: 'Missing fields' });

        try {
            await db.update(communityCategories).set({ name }).where(eq(communityCategories.id, id));
            return { success: true };
        } catch (error) {
            console.error('Update category error:', error);
            return fail(500, { message: 'Failed to update category' });
        }
    },

    deleteCategory: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const id = data.get('id') as string;

        if (!id) return fail(400, { message: 'Missing category ID' });

        try {
            await db.delete(communityCategories).where(eq(communityCategories.id, id));
            return { success: true };
        } catch (error) {
            console.error('Delete category error:', error);
            return fail(500, { message: 'Failed to delete category' });
        }
    },

};
