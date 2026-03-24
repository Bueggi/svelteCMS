<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
    import { FormSelect } from "$lib/components/ui/form-select";
    import { Search, ChevronLeft, ChevronRight, Eye } from "lucide-svelte";

    let { data } = $props();
    let users = $derived(data.users);
    let pagination = $derived(data.pagination);
    let filters = $derived(data.filters);

    let searchQuery = $state($page.url.searchParams.get('search') || '');
    let searchTimeout: any;

    function handleSearch(e: Event) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateUrl({ search: searchQuery, page: '1' });
        }, 500);
    }

    function updateUrl(params: Record<string, string | null>) {
        const url = new URL($page.url);
        for (const [key, value] of Object.entries(params)) {
             if (value === null || value === '') {
                 url.searchParams.delete(key);
             } else {
                 url.searchParams.set(key, value);
             }
        }
        goto(url, { keepFocus: true, noScroll: true });
    }

    function changePage(newPage: number) {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        updateUrl({ page: newPage.toString() });
    }
</script>

<PageContainer variant="admin">
    <PageHeader title="User Management" description="{pagination.totalCount} registered users" />

    <div class="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div class="relative flex-1 w-full max-w-sm">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search by name or email..."
                class="pl-9"
                bind:value={searchQuery}
                oninput={handleSearch}
            />
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <FormSelect
                class="min-w-[150px]"
                value={filters.activeCourseId || ''}
                onchange={(e) => updateUrl({ courseId: e.currentTarget.value, page: '1' })}
            >
                <option value="">All Courses</option>
                {#each filters.courses as course}
                    <option value={course.id}>{course.title}</option>
                {/each}
            </FormSelect>

            <FormSelect
                value={$page.url.searchParams.get('minClv') || ''}
                onchange={(e) => updateUrl({ minClv: e.currentTarget.value, page: '1' })}
            >
                <option value="">Any CLV</option>
                <option value="100">CLV > $100</option>
                <option value="500">CLV > $500</option>
                <option value="1000">CLV > $1,000</option>
            </FormSelect>
        </div>
    </div>

    <div class="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
            <TableHeader>
                <tr>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>CLV</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </tr>
            </TableHeader>
            <TableBody>
                {#if users.length === 0}
                    <TableRow>
                        <TableCell colspan={6} class="py-8 text-center text-muted-foreground">
                            No users found matching filters.
                        </TableCell>
                    </TableRow>
                {:else}
                    {#each users as user (user.id)}
                        <TableRow>
                            <TableCell>
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                        {user.name?.substring(0, 2)}
                                    </div>
                                    <div>
                                        <div class="font-medium">{user.name}</div>
                                        <div class="text-xs text-muted-foreground">{user.email}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                    {user.role}
                                </Badge>
                            </TableCell>
                            <TableCell>{user.productCount} Active</TableCell>
                            <TableCell class="font-mono">${(user.clv / 100).toFixed(2)}</TableCell>
                            <TableCell class="text-muted-foreground">
                                {new Date(user.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell class="text-right">
                                <Button variant="ghost" size="icon" href="/admin/users/{user.id}">
                                    <Eye class="w-4 h-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    {/each}
                {/if}
            </TableBody>
        </Table>
    </div>

    {#if pagination.totalPages > 1}
        <div class="flex items-center justify-between px-2">
            <div class="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
            </div>
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
