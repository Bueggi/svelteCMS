<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import { FormSelect } from "$lib/components/ui/form-select";
    import { Search, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Eye } from "lucide-svelte";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

    let { data } = $props();
    let allPurchases = $derived(data.purchases);
    let pagination = $derived(data.pagination);
    let filters = $derived(data.filters);

    let searchQuery = $state($page.url.searchParams.get('search') || '');
    let searchTimeout: ReturnType<typeof setTimeout>;

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateUrl({ search: searchQuery, page: '1' });
        }, 400);
    }

    function updateUrl(params: Record<string, string | null>) {
        const url = new URL($page.url);
        for (const [key, value] of Object.entries(params)) {
            if (!value) url.searchParams.delete(key);
            else url.searchParams.set(key, value);
        }
        goto(url, { keepFocus: true, noScroll: true });
    }

    function changePage(newPage: number) {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        updateUrl({ page: newPage.toString() });
    }

    function formatAmount(cents: number) {
        return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    }
</script>

<PageContainer variant="admin">
    <PageHeader
        title="Purchases"
        description="{pagination.totalCount} total transactions"
    />

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div class="relative flex-1 w-full max-w-sm">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search customer or course…"
                class="pl-9"
                bind:value={searchQuery}
                oninput={handleSearch}
            />
        </div>
        <FormSelect
            class="w-full sm:w-44"
            value={filters.status}
            onchange={(e) => updateUrl({ status: e.currentTarget.value, page: '1' })}
        >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="disputed">Disputed</option>
        </FormSelect>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table>
            <TableHeader>
                <tr>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </tr>
            </TableHeader>
            <TableBody>
                {#if allPurchases.length === 0}
                    <TableRow>
                        <TableCell colspan={6} class="py-12 text-center text-muted-foreground">
                            No purchases found matching your filters.
                        </TableCell>
                    </TableRow>
                {:else}
                    {#each allPurchases as purchase (purchase.id)}
                        <TableRow
                            class="cursor-pointer hover:bg-muted/40"
                            onclick={() => goto(`/admin/purchases/${purchase.id}`)}
                        >
                            <TableCell class="whitespace-nowrap text-muted-foreground">
                                <div>{new Date(purchase.createdAt).toLocaleDateString()}</div>
                                <div class="text-xs opacity-50">
                                    {new Date(purchase.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div class="font-medium">{purchase.user?.name ?? '—'}</div>
                                <div class="text-xs text-muted-foreground truncate max-w-[180px]">{purchase.user?.email ?? '—'}</div>
                            </TableCell>
                            <TableCell>
                                <span class="font-medium truncate max-w-[200px] inline-block">{purchase.course?.title ?? '—'}</span>
                            </TableCell>
                            <TableCell class="font-mono font-medium">
                                {formatAmount(purchase.amount)}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={purchase.status} />
                            </TableCell>
                            <TableCell class="text-right" onclick={(e) => e.stopPropagation()}>
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger>
                                        {#snippet child({ props })}
                                            <Button variant="ghost" size="icon" {...props}>
                                                <Eye class="w-4 h-4" />
                                                <span class="sr-only">Actions</span>
                                            </Button>
                                        {/snippet}
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Group>
                                            <DropdownMenu.Item>
                                                {#snippet child({ props })}
                                                    <a href="/admin/purchases/{purchase.id}" class="flex items-center w-full" {...props}>
                                                        <Eye class="mr-2 h-4 w-4" />
                                                        View Details
                                                    </a>
                                                {/snippet}
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item>
                                                {#snippet child({ props })}
                                                    <a
                                                        href="https://dashboard.stripe.com/payments/{purchase.stripeCheckoutSessionId}"
                                                        target="_blank"
                                                        class="flex items-center w-full"
                                                        {...props}
                                                    >
                                                        <ExternalLink class="mr-2 h-4 w-4" />
                                                        View in Stripe
                                                    </a>
                                                {/snippet}
                                            </DropdownMenu.Item>

                                            {#if purchase.status === 'completed'}
                                                <DropdownMenu.Separator />
                                                <form method="POST" action="?/refundPurchase" use:enhance>
                                                    <input type="hidden" name="purchaseId" value={purchase.id} />
                                                    <DropdownMenu.Item>
                                                        {#snippet child({ props })}
                                                            <button type="submit" class="flex items-center w-full text-destructive cursor-pointer" {...props}>
                                                                <RotateCcw class="mr-2 h-4 w-4" />
                                                                Issue Refund
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
                {/if}
            </TableBody>
        </Table>
    </div>

    <!-- Pagination -->
    {#if pagination.totalPages > 1}
        <div class="flex items-center justify-between px-1">
            <p class="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
            </p>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => changePage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                >
                    <ChevronLeft class="w-4 h-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => changePage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                >
                    <ChevronRight class="w-4 h-4" />
                </Button>
            </div>
        </div>
    {/if}
</PageContainer>
