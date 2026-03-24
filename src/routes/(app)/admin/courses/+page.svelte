<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import { PlusCircle, Edit, Trash, Eye } from "lucide-svelte";
    import { enhance } from '$app/forms';
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";

    let { data } = $props();
    let courses = $derived(data.courses);
</script>

<PageContainer variant="admin">
    <PageHeader title="Courses" description="Manage your course catalog and content.">
        {#snippet actions()}
            <Button href="/admin/courses/new">
                <PlusCircle class="w-4 h-4 mr-2" />
                Create Course
            </Button>
        {/snippet}
    </PageHeader>

    <div class="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table>
            <TableHeader>
                <tr>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </tr>
            </TableHeader>
            <TableBody>
                {#each courses as course (course.id)}
                    <TableRow class="group">
                        <TableCell>
                            <div class="flex items-center gap-4">
                                <div class="w-16 h-10 rounded-md overflow-hidden bg-muted relative">
                                    <img
                                        src={course.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                                        alt={course.title}
                                        class="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                <div>
                                    <div class="font-medium text-foreground">{course.title}</div>
                                    <div class="text-xs text-muted-foreground truncate max-w-[200px]">/{course.slug}</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
                        </TableCell>
                        <TableCell class="font-mono text-muted-foreground">
                            {course.price === 0 ? 'Free' : `$${(course.price / 100).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                            <div class="flex flex-col gap-1 items-start">
                                {#if course.accessType === 'lifetime'}
                                    <StatusBadge status="lifetime" />
                                {:else if course.accessType === 'subscription'}
                                    <StatusBadge status="subscription" />
                                {:else if course.accessType === 'duration'}
                                    <div class="flex items-center gap-2">
                                        <StatusBadge status="fixed" />
                                        <span class="text-xs text-muted-foreground">{course.accessDuration} Days</span>
                                    </div>
                                {:else}
                                    <span class="text-muted-foreground text-xs capitalize">{course.accessType}</span>
                                {/if}
                            </div>
                        </TableCell>
                        <TableCell class="text-muted-foreground">{course.enrollmentCount}</TableCell>
                        <TableCell class="font-mono text-muted-foreground">
                            ${(Number(course.lifetimeRevenue || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell class="text-muted-foreground">
                            {new Date(course.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell class="text-right">
                            <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" href={`/admin/courses/${course.id}`}>
                                    <Edit class="w-4 h-4" />
                                </Button>
                                <form action="?/deleteCourse" method="POST" use:enhance={({ cancel }) => {
                                    if (!confirm('Möchtest du diesen Kurs wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                                        cancel();
                                    }
                                    return async ({ update }) => {
                                        await update();
                                    };
                                }}>
                                    <input type="hidden" name="id" value={course.id} />
                                    <Button type="submit" variant="ghost" size="icon" class="text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash class="w-4 h-4" />
                                    </Button>
                                </form>
                                <Button variant="ghost" size="icon" href={`/courses/${course.slug}`} target="_blank">
                                    <Eye class="w-4 h-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                {/each}
                {#if courses.length === 0}
                    <TableRow>
                        <TableCell colspan={8} class="py-12 text-center text-muted-foreground">
                            No courses found. Get started by creating your first course.
                        </TableCell>
                    </TableRow>
                {/if}
            </TableBody>
        </Table>
    </div>
</PageContainer>
