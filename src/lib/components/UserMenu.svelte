<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuTrigger
    } from "$lib/components/ui/dropdown-menu";
    import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
    import { User, Settings, LogOut, LayoutDashboard, Shield } from "lucide-svelte";
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";

    let { user } = $props();

    const langCtx = getContext<{ lang: LangKey } | undefined>('i18n');
    const t = $derived(getT(langCtx?.lang ?? 'de'));

    async function handleLogout() {
        await authClient.signOut();
        goto("/");
    }
</script>

<DropdownMenu>
    <DropdownMenuTrigger>
        <Button variant="ghost" class="relative h-8 w-8 rounded-full">
            <Avatar class="h-8 w-8">
                {#if user.image}<AvatarImage src={user.image} alt={user.name} />{/if}
                <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="end">
        <DropdownMenuLabel class="font-normal">
            <div class="flex flex-col space-y-1">
                <p class="text-sm font-medium leading-none">{user.name}</p>
                <p class="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem href="/dashboard">
            <LayoutDashboard class="mr-2 h-4 w-4" />
            <span>{t('menuDashboard')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem href="/settings">
            <Settings class="mr-2 h-4 w-4" />
            <span>{t('navSettings')}</span>
        </DropdownMenuItem>
        {#if user.role === 'admin' || user.role === 'instructor'}
            <DropdownMenuSeparator />
            <DropdownMenuItem href="/admin">
                <Shield class="mr-2 h-4 w-4" />
                <span>{t('menuAdminDashboard')}</span>
            </DropdownMenuItem>
        {/if}
        <DropdownMenuSeparator />
        <DropdownMenuItem onclick={handleLogout}>
            <LogOut class="mr-2 h-4 w-4" />
            <span>{t('signOut')}</span>
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
