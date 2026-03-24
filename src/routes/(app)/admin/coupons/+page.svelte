<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Card, CardHeader, CardTitle, CardContent } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import { Trash2, Ticket, Plus, MoreHorizontal, Power, PowerOff } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { enhance } from '$app/forms';
    import { FormSelect } from "$lib/components/ui/form-select";

    let { data, form } = $props();
    let coupons = $derived(data.coupons);
    let courses = $derived(data.courses);

    let isCreating = $state(false);
</script>

<PageContainer variant="admin">
    <PageHeader title="Coupons" description="Manage global and course-specific discounts">
        {#snippet actions()}
            <Button onclick={() => isCreating = !isCreating}>
                {#if isCreating}
                    Cancel
                {:else}
                    <Plus class="w-4 h-4 mr-2" /> Create Coupon
                {/if}
            </Button>
        {/snippet}
    </PageHeader>

    {#if isCreating}
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader>
                <CardTitle>Create New Coupon</CardTitle>
            </CardHeader>
            <CardContent>
                {#if form?.message}
                    <div class="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                        {form.message}
                    </div>
                {/if}
                <form method="POST" action="?/createCoupon" use:enhance={() => {
                    return async ({ update, result }) => {
                        await update();
                        if (result.type === 'success') {
                            isCreating = false;
                        }
                    };
                }} class="space-y-4 max-w-2xl">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label for="code" class="text-sm font-medium">Coupon Code</label>
                            <Input id="code" name="code" placeholder="e.g. SUMMER24" required class="uppercase" />
                        </div>
                        <div class="space-y-2">
                            <label for="discountType" class="text-sm font-medium">Discount Type</label>
                            <FormSelect id="discountType" name="discountType">
                                <option value="percentage">Percentage (%)</option>
                                <option value="amount">Fixed Amount (Cents)</option>
                            </FormSelect>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label for="discountValue" class="text-sm font-medium">Discount Value</label>
                        <Input id="discountValue" name="discountValue" type="number" min="0" placeholder="e.g. 20 (for 20%) or 1500 (for €15.00)" required />
                        <p class="text-xs text-muted-foreground">For Fixed Amount, enter value in cents (e.g. 1500 for €15.00)</p>
                    </div>

                    <div class="space-y-2">
                        <label for="applicableTo" class="text-sm font-medium">Applicability</label>
                        <FormSelect id="applicableTo" name="applicableTo" onchange={(e) => {
                            const val = e.currentTarget.value;
                            const courseSelect = document.getElementById('courseIdDiv');
                            if (courseSelect) {
                                courseSelect.style.display = val === 'specific' ? 'block' : 'none';
                            }
                        }}>
                            <option value="all">Global (All Courses)</option>
                            <option value="specific">Specific Course</option>
                        </FormSelect>
                    </div>

                    <div class="space-y-2" id="courseIdDiv" style="display: none;">
                        <label for="courseId" class="text-sm font-medium">Select Course</label>
                        <FormSelect id="courseId" name="courseId">
                            <option value="null">-- Select a course --</option>
                            {#each courses as course}
                                <option value={course.id}>{course.title}</option>
                            {/each}
                        </FormSelect>
                    </div>

                    <div class="space-y-2">
                        <label for="expiresAt" class="text-sm font-medium">Expiration Date (Optional)</label>
                        <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                    </div>

                    <Button type="submit" class="w-full">Create Coupon</Button>
                </form>
            </CardContent>
        </Card>
    {/if}

    <Card class="bg-card/50 backdrop-blur border shadow-sm">
        <CardContent class="p-0">
            <Table>
                <TableHeader>
                    <tr>
                        <TableHead>Code</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Applies To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead class="text-right">Actions</TableHead>
                    </tr>
                </TableHeader>
                <TableBody>
                    {#if coupons.length === 0}
                        <TableRow>
                            <TableCell colspan={6} class="py-8 text-center text-muted-foreground">
                                <div class="flex flex-col items-center justify-center gap-2">
                                    <Ticket class="w-8 h-8 opacity-20" />
                                    <p>No coupons created yet.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    {/if}
                    {#each coupons as coupon}
                        <TableRow>
                            <TableCell class="font-mono font-medium">{coupon.code}</TableCell>
                            <TableCell class="font-medium">
                                {#if coupon.discountType === 'percentage'}
                                    {coupon.discountValue}%
                                {:else}
                                    {(coupon.discountValue / 100).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                                {/if}
                            </TableCell>
                            <TableCell>
                                {#if coupon.applicableTo === 'all'}
                                    <StatusBadge status="global" />
                                {:else}
                                    <span class="text-xs truncate max-w-[200px] inline-block" title={coupon.course?.title}>{coupon.course?.title || 'Unknown Course'}</span>
                                {/if}
                            </TableCell>
                            <TableCell>
                                {#if !coupon.isActive}
                                    <StatusBadge status="inactive" />
                                {:else if coupon.expiresAt && new Date(coupon.expiresAt) < new Date()}
                                    <StatusBadge status="expired" />
                                {:else}
                                    <StatusBadge status="active" />
                                {/if}
                            </TableCell>
                            <TableCell class="text-muted-foreground text-xs">
                                {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell class="text-right">
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger>
                                        {#snippet child({ props })}
                                            <Button variant="ghost" size="icon" {...props}>
                                                <MoreHorizontal class="w-4 h-4" />
                                                <span class="sr-only">Toggle menu</span>
                                            </Button>
                                        {/snippet}
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Group>
                                            <DropdownMenu.Label>Actions</DropdownMenu.Label>
                                            <DropdownMenu.Separator />
                                            <form method="POST" action="?/toggleCouponStatus" use:enhance>
                                                <input type="hidden" name="id" value={coupon.id} />
                                                <DropdownMenu.Item>
                                                    {#snippet child({ props })}
                                                        <button type="submit" class="w-full flex items-center cursor-pointer" {...props}>
                                                            {#if coupon.isActive}
                                                                <PowerOff class="mr-2 h-4 w-4" />
                                                                <span>Deactivate</span>
                                                            {:else}
                                                                <Power class="mr-2 h-4 w-4" />
                                                                <span>Activate</span>
                                                            {/if}
                                                        </button>
                                                    {/snippet}
                                                </DropdownMenu.Item>
                                            </form>
                                            <DropdownMenu.Separator />
                                            <form method="POST" action="?/deleteCoupon" use:enhance>
                                                <input type="hidden" name="id" value={coupon.id} />
                                                <DropdownMenu.Item>
                                                    {#snippet child({ props })}
                                                        <button type="submit" class="w-full flex items-center text-destructive cursor-pointer" {...props}>
                                                            <Trash2 class="mr-2 h-4 w-4" />
                                                            <span>Delete</span>
                                                        </button>
                                                    {/snippet}
                                                </DropdownMenu.Item>
                                            </form>
                                        </DropdownMenu.Group>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            </TableCell>
                        </TableRow>
                    {/each}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
</PageContainer>
