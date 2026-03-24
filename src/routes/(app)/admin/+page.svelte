<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "$lib/components/ui/card";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import SalesLineChart from "$lib/components/SalesLineChart.svelte";
    import { Users, BookOpen, GraduationCap, TrendingUp, Clock, Euro, ArrowUpRight, ArrowDownRight, MoreHorizontal, RotateCcw } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { enhance } from '$app/forms';

    let { data } = $props();
    let stats = $derived(data.stats);
    let recentEnrollments = $derived(data.recentEnrollments);
    let recentPurchases = $derived(data.recentPurchases);
    let monthlyRevenue = $derived(data.monthlyRevenue);
</script>

<PageContainer variant="admin" class="max-w-7xl">
    <PageHeader title="Dashboard Overview" description="Analytics and recent sales activity.">
        {#snippet actions()}
            <Button variant="outline" href="/admin/coupons">Manage Coupons</Button>
            <Button href="/admin/courses/new">Create Course</Button>
        {/snippet}
    </PageHeader>

    <!-- Primary Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Total Revenue</CardTitle>
                <Euro class="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold font-mono">{(stats.totalRevenue / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                <p class="text-xs text-muted-foreground mt-1 flex items-center">
                    <ArrowUpRight class="w-3 h-3 text-green-500 mr-1" /> Lifetime Earnings
                </p>
            </CardContent>
        </Card>

        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Total Enrollments</CardTitle>
                <GraduationCap class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{stats.totalEnrollments}</div>
                <p class="text-xs text-muted-foreground mt-1">Active student subscriptions</p>
            </CardContent>
        </Card>

        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Refunds Issued</CardTitle>
                <RotateCcw class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold text-destructive/80">{stats.totalRefunds}</div>
                <p class="text-xs text-muted-foreground mt-1 text-destructive/60">Cancelled / Returned</p>
            </CardContent>
        </Card>

        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Active Courses</CardTitle>
                <BookOpen class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{stats.totalCourses}</div>
                <p class="text-xs text-muted-foreground mt-1">Published and available</p>
            </CardContent>
        </Card>
    </div>

    <!-- Revenue Chart Section -->
    <Card class="bg-card/50 backdrop-blur border shadow-sm">
        <CardHeader>
            <CardTitle>Sales Over Time</CardTitle>
            <CardDescription>Monthly revenue visualization from active purchases.</CardDescription>
        </CardHeader>
        <CardContent class="pt-2 pb-4 px-2">
            <SalesLineChart data={monthlyRevenue} />
        </CardContent>
    </Card>

    <!-- Recent Purchases Table -->
    <Card class="bg-card/50 backdrop-blur border shadow-sm">
        <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
            <CardDescription>View, manage and refund recent transactions.</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
            <Table>
                <TableHeader>
                    <tr>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Course Item</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead class="text-right">Actions</TableHead>
                    </tr>
                </TableHeader>
                <TableBody>
                    {#if recentPurchases.length === 0}
                        <TableRow>
                            <TableCell colspan={6} class="py-8 text-center text-muted-foreground">
                                <div class="flex flex-col items-center justify-center gap-2">
                                    <Euro class="w-8 h-8 opacity-20" />
                                    <p>No purchases recorded yet.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    {/if}
                    {#each recentPurchases as purchase}
                        <TableRow>
                            <TableCell class="text-muted-foreground whitespace-nowrap">
                                {new Date(purchase.createdAt).toLocaleDateString()}
                                <span class="text-xs opacity-50">{new Date(purchase.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </TableCell>
                            <TableCell>
                                <div class="flex flex-col">
                                    <span class="font-medium">{purchase.user.name}</span>
                                    <span class="text-xs text-muted-foreground truncate max-w-[150px]">{purchase.user.email}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span class="font-medium text-primary hover:underline cursor-pointer truncate max-w-[200px] inline-block">{purchase.course.title}</span>
                            </TableCell>
                            <TableCell class="font-mono font-medium">
                                {(purchase.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={purchase.status} />
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
                                            <DropdownMenu.Label>Transaction Options</DropdownMenu.Label>
                                            <DropdownMenu.Separator />
                                            <DropdownMenu.Item>
                                                {#snippet child({ props })}
                                                    <a href={`https://dashboard.stripe.com/test/payments/${purchase.stripeCheckoutSessionId}`} target="_blank" class="w-full flex items-center" {...props}>
                                                        <ArrowUpRight class="mr-2 h-4 w-4" />
                                                        <span>View in Stripe</span>
                                                    </a>
                                                {/snippet}
                                            </DropdownMenu.Item>

                                            {#if purchase.status === 'completed'}
                                                <DropdownMenu.Separator />
                                                <form method="POST" action="?/refundPurchase" use:enhance>
                                                    <input type="hidden" name="purchaseId" value={purchase.id} />
                                                    <DropdownMenu.Item>
                                                        {#snippet child({ props })}
                                                            <button type="submit" class="w-full flex items-center text-destructive cursor-pointer group" {...props}>
                                                                <RotateCcw class="mr-2 h-4 w-4 group-hover:animate-spin-once" />
                                                                <span>Issue Refund</span>
                                                            </button>
                                                        {/snippet}
                                                    </DropdownMenu.Item>
                                                </form>
                                            {/if}
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
