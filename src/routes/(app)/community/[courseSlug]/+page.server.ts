
import { db } from '$lib/server/db';
import { communityPosts, communityCategories, communityComments, courses } from '$lib/server/db/schema';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent, url }) => {
    const { communityCourse } = await parent();
    const categoryId = url.searchParams.get('category');

    const posts = await db.query.communityPosts.findMany({
        where: (posts, { eq, inArray }) => {
            if (categoryId) {
                return eq(posts.categoryId, categoryId);
            } else {
                const categoryIds = communityCourse.communityCategories.map((c: any) => c.id);
                return inArray(posts.categoryId, categoryIds);
            }
        },
        with: { author: true, category: true, comments: true },
        orderBy: [desc(communityPosts.createdAt)],
    });

    return {
        posts: posts.map(p => ({ ...p, commentCount: p.comments.length })),
    };
};

function isStaff(user: any) {
    return ['admin', 'instructor', 'moderator'].includes(user?.role);
}

export const actions: Actions = {
    // ── Load a single post with comments (for modal) ──────────────────────────
    getPost: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const postId = fd.get('postId') as string;
        const post = await db.query.communityPosts.findFirst({
            where: eq(communityPosts.id, postId),
            with: {
                author: true,
                category: true,
                comments: {
                    where: (c, { isNull }) => isNull(c.parentId),
                    with: {
                        author: true,
                        replies: {
                            with: { author: true },
                            orderBy: [asc(communityComments.createdAt)],
                        },
                    },
                    orderBy: [asc(communityComments.createdAt)],
                },
            },
        });
        if (!post) return fail(404);
        return { post };
    },

    // ── Create a top-level comment (or reply) ─────────────────────────────────
    createComment: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const postId = fd.get('postId') as string;
        const body = (fd.get('body') as string)?.trim();
        const parentId = (fd.get('parentId') as string) || null;
        if (!postId || !body) return fail(400, { message: 'Body required' });
        await db.insert(communityComments).values({ postId, body, authorId: locals.user.id, parentId });
        return { success: true };
    },

    // ── Edit a post ───────────────────────────────────────────────────────────
    editPost: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const postId = fd.get('postId') as string;
        const title = (fd.get('title') as string)?.trim();
        const body = (fd.get('body') as string)?.trim();
        if (!postId || !title || !body) return fail(400);
        const post = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, postId) });
        if (!post) return fail(404);
        if (!isStaff(locals.user) && post.authorId !== locals.user.id) return fail(403);
        await db.update(communityPosts).set({ title, body, updatedAt: new Date() }).where(eq(communityPosts.id, postId));
        return { success: true };
    },

    // ── Delete a post ─────────────────────────────────────────────────────────
    deletePost: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const postId = fd.get('postId') as string;
        const post = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, postId) });
        if (!post) return fail(404);
        if (!isStaff(locals.user) && post.authorId !== locals.user.id) return fail(403);
        await db.delete(communityPosts).where(eq(communityPosts.id, postId));
        return { success: true };
    },

    // ── Edit a comment ────────────────────────────────────────────────────────
    editComment: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const commentId = fd.get('commentId') as string;
        const body = (fd.get('body') as string)?.trim();
        if (!commentId || !body) return fail(400);
        const comment = await db.query.communityComments.findFirst({ where: eq(communityComments.id, commentId) });
        if (!comment) return fail(404);
        if (!isStaff(locals.user) && comment.authorId !== locals.user.id) return fail(403);
        await db.update(communityComments).set({ body, updatedAt: new Date() }).where(eq(communityComments.id, commentId));
        return { success: true };
    },

    // ── Delete a comment ──────────────────────────────────────────────────────
    deleteComment: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const commentId = fd.get('commentId') as string;
        const comment = await db.query.communityComments.findFirst({ where: eq(communityComments.id, commentId) });
        if (!comment) return fail(404);
        if (!isStaff(locals.user) && comment.authorId !== locals.user.id) return fail(403);
        await db.delete(communityComments).where(eq(communityComments.id, commentId));
        return { success: true };
    },

    // ── Existing actions ──────────────────────────────────────────────────────
    createPost: async ({ request, locals }) => {
        if (!locals.user) return fail(401);
        const fd = await request.formData();
        const title = fd.get('title') as string;
        const body = fd.get('body') as string;
        const categoryId = fd.get('categoryId') as string;
        if (!title || !body || !categoryId) return fail(400, { message: 'Missing fields' });
        await db.insert(communityPosts).values({ title, body, categoryId, authorId: locals.user.id });
        return { success: true };
    },

    createCategory: async ({ request, locals, params }) => {
        if (!locals.user || !isStaff(locals.user)) return fail(401);
        const fd = await request.formData();
        const name = fd.get('name') as string;
        if (!name) return fail(400);
        const course = await db.query.courses.findFirst({ where: eq(courses.slug, params.courseSlug) });
        if (!course) return fail(404);
        await db.insert(communityCategories).values({ name, courseId: course.id, order: 99 });
        return { success: true };
    },

    movePost: async ({ request, locals }) => {
        if (!locals.user || !isStaff(locals.user)) return fail(401);
        const fd = await request.formData();
        const postId = fd.get('postId') as string;
        const categoryId = fd.get('categoryId') as string;
        if (!postId || !categoryId) return fail(400);
        await db.update(communityPosts).set({ categoryId }).where(eq(communityPosts.id, postId));
        return { success: true };
    },
};
