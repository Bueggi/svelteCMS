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

    let { user } = $props();

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
            <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem href="/settings">
            <Settings class="mr-2 h-4 w-4" />
            <span>Settings</span>
        </DropdownMenuItem>
        {#if user.role === 'admin' || user.role === 'instructor'}
            <DropdownMenuSeparator />
            <DropdownMenuItem href="/admin">
                <Shield class="mr-2 h-4 w-4" />
                <span>Admin Dashboard</span>
            </DropdownMenuItem>
        {/if}
        <DropdownMenuSeparator />
        <DropdownMenuItem onclick={handleLogout}>
            <LogOut class="mr-2 h-4 w-4" />
            <span>Log out</span>
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
