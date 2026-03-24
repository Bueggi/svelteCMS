<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import { LayoutDashboard, BookOpen, Settings, LogOut, PanelLeft, X, Users } from "lucide-svelte";
    import { slide, fade } from 'svelte/transition';
    import { cn } from "$lib/utils";
    import UpdateBanner from '$lib/components/UpdateBanner.svelte';

    let { children, data } = $props();
    let isSidebarOpen = $state(false);

    function toggleSidebar() {
        isSidebarOpen = !isSidebarOpen;
    }

    const navItems = [
        { href: '/admin/courses', label: 'Courses', icon: BookOpen },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/coupons', label: 'Coupons', icon: BookOpen }, // Assuming lucide-svelte has Ticket or just reuse
        { href: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    let pathname = $derived($page.url.pathname);
</script>

{#if data.updateInfo}
    <UpdateBanner version={data.updateInfo.version} summary={data.updateInfo.summary} />
{/if}

<div class="max-w-7xl mx-auto animate-in fade-in duration-500">
    {@render children()}
</div>
