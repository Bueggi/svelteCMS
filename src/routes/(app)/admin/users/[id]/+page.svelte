<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { ChevronLeft, Trash2, Plus, ExternalLink, Receipt, RefreshCcw } from "lucide-svelte";
    import { fade } from 'svelte/transition';
    import { FormSelect } from "$lib/components/ui/form-select";
    import { PageTitle } from "$lib/components/ui/page-title";

    let { data } = $props();
    let profile = $derived(data.profile);
    let enrollments = $derived(data.enrollments);
    let availableCourses = $derived(data.availableCourses);
    let recentActivity = $derived(data.recentActivity);
    // Explicitly fallback to empty array if purchases is undefined to prevent errors during migration
    let purchases = $derived(data.purchases || []); 

    let isSaving = $state(false);
    let isRefunding = $state<string | null>(null);

    // Form enhancement with toast/notification simulation and state consistency
    function enhanceProfileUpdate() {
        isSaving = true;
        return async ({ update, result }: any) => {
            await update(); // This triggers data invalidation (re-running load function)
            isSaving = false;
            if (result.type === 'success') {
                // We could show a toast here
                 // toast.success("Profile updated!"); 
            }
        };
    }
</script>

<div class="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/admin/users">
            <ChevronLeft class="w-5 h-5" />
        </Button>
        <div>
            <PageTitle>{profile.name}</PageTitle>
            <div class="flex items-center gap-2 text-muted-foreground text-sm">
                <span>{profile.email}</span>
                <span>•</span>
                <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
        <div class="ml-auto">
             <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                {profile.role}
            </Badge>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Profile -->
        <div class="lg:col-span-1 space-y-6">
            <form method="POST" action="?/updateProfile" use:enhance={enhanceProfileUpdate} class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg">Profile Details</h2>
                
                <div class="space-y-2">
                    <Label for="name">Full Name</Label>
                    <Input id="name" name="name" value={profile.name} required />
                </div>
                
                <div class="space-y-2">
                    <Label for="email">Email Address</Label>
                    <Input id="email" name="email" type="email" value={profile.email} required />
                </div>
                
                <div class="space-y-2">
                    <Label for="role">Role</Label>
                    <FormSelect id="role" name="role" value={profile.role}>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                    </FormSelect>
                </div>

                <Button type="submit" class="w-full" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </form>

            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg flex items-center gap-2">
                    <Receipt class="w-4 h-4" /> Purchase History
                </h2>
                
                {#if purchases.length === 0}
                    <div class="text-sm text-muted-foreground">No purchases found.</div>
                {:else}
                    <div class="space-y-4">
                         {#each purchases as purchase}
                            <div class="flex flex-col gap-2 p-3 bg-muted/30 rounded-md border relative">
                                <div class="flex justify-between items-start">
                                    <span class="font-medium text-sm">{purchase.course.title}</span>
                                    <span class="font-mono text-sm">${(purchase.amount / 100).toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{new Date(purchase.createdAt).toLocaleDateString()}</span>
                                    <Badge variant={purchase.status === 'refunded' ? 'destructive' : 'outline'} class="text-[10px] h-5 px-1.5 uppercase">
                                        {purchase.status}
                                    </Badge>
                                </div>
                                
                                {#if purchase.status !== 'refunded'}
                                    <form action="?/refundPurchase" method="POST" use:enhance={() => {
                                        isRefunding = purchase.id;
                                        return async ({ update }) => {
                                            await update();
                                            isRefunding = null;
                                        };
                                    }}>
                                        <input type="hidden" name="purchaseId" value={purchase.id} />
                                        <Button type="submit" variant="ghost" size="sm" class="w-full mt-2 h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isRefunding === purchase.id}>
                                            <RefreshCcw class="w-3 h-3 mr-1.5" />
                                            {isRefunding === purchase.id ? 'Refunding...' : 'Refund Purchase'}
                                        </Button>
                                    </form>
                                {/if}
                            </div>
                         {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Right Column: Products & Activity -->
        <div class="lg:col-span-2 space-y-6">
            <!-- Product Access -->
            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                    <h2 class="font-semibold text-lg">Product Access</h2>
                </div>

                {#if enrollments.length === 0}
                    <div class="text-sm text-muted-foreground py-4 border-2 border-dashed rounded-md text-center">
                        No active enrollments.
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each enrollments as enrollment (enrollment.courseId)}
                            <div class="p-3 bg-muted/30 rounded-md border space-y-2">
                                <div class="flex items-center justify-between">
                                    <div class="font-medium">{enrollment.course.title}</div>
                                    <div class="flex items-center gap-2">
                                        <Badge variant={enrollment.status === 'active' ? 'outline' : 'secondary'} class={enrollment.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-200' : ''}>
                                            {enrollment.status}
                                        </Badge>
                                        <form action="?/removeEnrollment" method="POST" use:enhance>
                                            <input type="hidden" name="courseId" value={enrollment.courseId} />
                                            <Button type="submit" variant="ghost" size="icon" class="h-6 w-6 text-destructive hover:bg-destructive/10">
                                                <Trash2 class="w-3 h-3" />
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                                <div class="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>Enrolled: {new Date(enrollment.enrolledAt).toLocaleDateString()}</span>
                                     {#if enrollment.expiresAt}
                                        <span class="font-medium {new Date(enrollment.expiresAt) < new Date() ? 'text-destructive' : 'text-orange-600'}">
                                            Expires: {new Date(enrollment.expiresAt).toLocaleDateString()}
                                        </span>
                                    {:else}
                                        <span>Lifetime Access</span>
                                    {/if}
                                </div>
                                
                                <!-- Edit/Manage Enrollment (Mini logic) -->
                                {#if enrollment.expiresAt || enrollment.status !== 'active'}
                                    <div class="pt-2 border-t flex justify-end gap-2">
                                         {#if enrollment.status === 'active' && enrollment.expiresAt}
                                            <form action="?/updateEnrollment" method="POST" use:enhance>
                                                <input type="hidden" name="courseId" value={enrollment.courseId} />
                                                <input type="hidden" name="status" value="cancelled" />
                                                <!-- Keep date same -->
                                                 <input type="hidden" name="expiresAt" value={enrollment.expiresAt} />
                                                <Button type="submit" variant="ghost" size="sm" class="h-6 text-[10px] text-destructive">
                                                    Cancel Subscription
                                                </Button>
                                            </form>
                                         {/if}
                                         {#if enrollment.status === 'cancelled'}
                                            <form action="?/updateEnrollment" method="POST" use:enhance>
                                                <input type="hidden" name="courseId" value={enrollment.courseId} />
                                                <input type="hidden" name="status" value="active" />
                                                <input type="hidden" name="expiresAt" value={enrollment.expiresAt} />
                                                <Button type="submit" variant="ghost" size="sm" class="h-6 text-[10px] text-primary">
                                                    Reactivate
                                                </Button>
                                            </form>
                                         {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="pt-4 border-t">
                    <h3 class="text-sm font-medium mb-2">Grant Access</h3>
                    <form action="?/addEnrollment" method="POST" use:enhance class="flex gap-2">
                        <FormSelect name="courseId" required>
                            <option value="" disabled selected>Select course to add...</option>
                            {#each availableCourses as course}
                                <option value={course.id}>{course.title}</option>
                            {/each}
                        </FormSelect>
                        <Button type="submit" variant="secondary">
                            <Plus class="w-4 h-4 mr-2" /> Add
                        </Button>
                    </form>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg">Recent Community Activity</h2>
                
                {#if recentActivity.length === 0}
                    <div class="text-sm text-muted-foreground">No recent posts.</div>
                {:else}
                    <div class="space-y-4">
                        {#each recentActivity as post}
                             <div class="flex gap-3 items-start border-b last:border-0 pb-4 last:pb-0">
                                <div class="flex-1 space-y-1">
                                    <div class="font-medium text-sm flex items-center justify-between">
                                        {post.title}
                                        <span class="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground line-clamp-2">
                                        {post.body}
                                    </div>
                                    <div class="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" class="text-[10px] h-5">{post.category.name}</Badge>
                                        <a href="/community/posts/{post.id}" target="_blank" class="text-xs text-primary flex items-center hover:underline">
                                            View Post <ExternalLink class="w-3 h-3 ml-1" />
                                        </a>
                                    </div>
                                </div>
                             </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
