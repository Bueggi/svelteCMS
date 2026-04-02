<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import UserMenu from "$lib/components/UserMenu.svelte";
    import {
        LayoutDashboard,
        BookOpen,
        Settings,
        Shield,
        Menu,
        ChevronRight,
        Users,
        Ticket,
        ShoppingBag,
        LogOut,
        MessageCircle,
        Zap,
        GitBranch,
        Images,
        FileText,
        CreditCard,
    } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { getContext } from "svelte";
    import { getT as getTranslator, type LangKey } from "$lib/i18n";

    let { children, data } = $props();
    const user = $derived(data.user);
    const settings = $derived(data.settings);

    const langCtx = getContext<{ lang: LangKey }>('i18n');
    const t = $derived(getTranslator(langCtx.lang));
    const getT = (k: Parameters<ReturnType<typeof getTranslator>>[0]) => t(k);

    let isSidebarOpen = $state(true);

    const userNavItems = $derived([
        { href: '/dashboard',  label: getT('navOverview'),   icon: LayoutDashboard },
        { href: '/my-courses', label: getT('navMyLearning'), icon: BookOpen },
        { href: '/community',  label: getT('navCommunity'),  icon: MessageCircle },
        { href: '/billing',    label: getT('navBilling'),    icon: CreditCard },
        { href: '/settings',   label: getT('navSettings'),   icon: Settings },
    ]);

    const adminNavItems = $derived([
        { href: '/admin',            label: getT('navOverview'),     icon: LayoutDashboard },
        { href: '/admin/courses',    label: getT('navCourses'),      icon: BookOpen },
        { href: '/admin/users',      label: getT('navUsers'),        icon: Users },
        { href: '/admin/purchases',  label: getT('navPurchases'),    icon: ShoppingBag },
        { href: '/admin/coupons',    label: getT('navCoupons'),      icon: Ticket },
        { href: '/community',        label: getT('navCommunity'),    icon: MessageCircle },
        { href: '/admin/automations',label: getT('navAutomations'),  icon: Zap },
        { href: '/admin/funnels',    label: getT('navFunnels'),      icon: GitBranch },
        { href: '/admin/invoices',   label: getT('navInvoices'),     icon: FileText },
        { href: '/admin/media',      label: getT('navMedia'),        icon: Images },
        { href: '/admin/settings',   label: getT('navSettings'),     icon: Settings },
    ]);

    const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));
    const isLearnPage  = $derived($page.url.pathname.includes('/learn'));

    const navItems = $derived(isAdminRoute ? adminNavItems : userNavItems);

    const contextItems = $derived.by(() => {
        const items: { href: string; label: string; icon: typeof LogOut }[] = [];
        if (user?.role === 'admin' || user?.role === 'instructor') {
            if (isAdminRoute) {
                items.push({ href: '/dashboard', label: getT('navExitAdmin'),  icon: LogOut });
            } else {
                items.push({ href: '/admin',     label: getT('navAdminPanel'), icon: Shield });
            }
        }
        return items;
    });
</script>

<div class="min-h-screen bg-background relative selection:bg-primary/20">
    <!-- Background Mesh — opacity controlled per theme -->
    <div class="theme-mesh fixed inset-0 z-0 pointer-events-none overflow-hidden" style="opacity: var(--theme-mesh-opacity, 1); transition: opacity 0.5s;">
        <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px] animate-pulse duration-[10000ms]"></div>
        <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[100px] animate-pulse duration-[15000ms]"></div>
        <div class="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-[100px] animate-pulse duration-[20000ms]"></div>
    </div>

    <!-- Content Wrapper -->
    <div class="flex relative z-10 min-h-screen">
        <!-- Functional App Sidebar -->
        {#if !isLearnPage}
        <aside
            class={cn(
                "theme-sidebar fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 lg:static lg:translate-x-0",
                !isSidebarOpen && "-translate-x-full"
            )}
            style="
                background: var(--theme-sidebar-bg);
                backdrop-filter: blur(var(--theme-sidebar-blur));
                -webkit-backdrop-filter: blur(var(--theme-sidebar-blur));
                border-right: var(--theme-sidebar-border);
            "
        >
            <div class="flex flex-col h-full">
                <div class="p-6 flex items-center gap-3 border-b border-border/50">
                    {#if settings?.logoUrl}
                        <img src={settings.logoUrl} alt={settings.appName} class="h-8 w-auto object-contain max-w-[120px] shrink-0" />
                    {:else}
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20 shrink-0">
                            {(settings?.appName || 'L')[0].toUpperCase()}
                        </div>
                    {/if}
                    {#if settings?.logoText || (!settings?.logoUrl && settings?.appName)}
                        <span class="font-serif font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 truncate">
                            {settings?.logoText || settings?.appName || 'LUMIÈRE'}
                        </span>
                    {/if}
                </div>

                <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
                    <div class="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold">
                        {settings?.appName || 'Menu'}
                    </div>
                    {#each navItems as item}
                        <a 
                            href={item.href}
                            class={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                $page.url.pathname === item.href 
                                    ? "bg-primary/10 text-primary shadow-sm" 
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <item.icon class="w-4 h-4" />
                            {item.label}
                        </a>
                    {/each}

                    {#if contextItems.length > 0}
                        <div class="px-3 mt-8 mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold">
                            {isAdminRoute ? getT('navSystem') : getT('navAdministration')}
                        </div>
                        {#each contextItems as item}
                            <a 
                                href={item.href}
                                class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            >
                                <item.icon class="w-4 h-4" />
                                {item.label}
                            </a>
                        {/each}
                    {/if}
                </nav>

                <div class="p-4 border-t border-border/50 bg-muted/20">
                    <div class="flex items-center gap-3 px-2">
                        {#if user}<UserMenu {user} />{/if}
                        <div class="flex flex-col min-w-0">
                            <span class="text-sm font-medium truncate">{user?.name}</span>
                            <span class="text-xs text-muted-foreground truncate uppercase tracking-tighter">{user?.role}</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
        {/if}

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col min-w-0 transition-all duration-300">
            <!-- Dashboard Top Header -->
            {#if !isLearnPage}
            <header
                class="theme-header h-16 flex items-center justify-between px-6 sticky top-0 z-30"
                style="
                    background: var(--theme-header-bg);
                    backdrop-filter: blur(var(--theme-header-blur));
                    -webkit-backdrop-filter: blur(var(--theme-header-blur));
                    border-bottom: var(--theme-header-border);
                "
            >
                <div class="flex items-center gap-4">
                    <Button variant="ghost" size="icon" class="lg:hidden" onclick={() => isSidebarOpen = !isSidebarOpen}>
                        <Menu class="w-5 h-5" />
                    </Button>
                    
                    <nav class="flex items-center text-sm text-muted-foreground">
                        <span class="capitalize font-medium text-foreground/80">{$page.url.pathname.split('/')[1]}</span>
                        {#if $page.url.pathname.split('/').length > 2}
                            <ChevronRight class="w-4 h-4 mx-1 opacity-40" />
                            <span class="capitalize text-foreground font-semibold">{$page.url.pathname.split('/')[2]}</span>
                        {/if}
                    </nav>
                </div>

                <div class="flex items-center gap-4">
                </div>
            </header>
            {/if}

            <main class={cn("flex-1", !isLearnPage && "p-6 lg:p-10")}>
                {@render children()}
            </main>
        </div>
    </div>
</div>
