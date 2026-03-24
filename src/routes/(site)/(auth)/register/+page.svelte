<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Loader2 } from "lucide-svelte";
    import { goto } from "$app/navigation";

    let name = $state("");
    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let isLoading = $state(false);
    let error = $state("");

    async function handleRegister() {
        if (!name || !email || !password || !confirmPassword) {
            error = "Please fill in all fields";
            return;
        }

        if (password !== confirmPassword) {
            error = "Passwords do not match";
            return;
        }

        isLoading = true;
        error = "";

        try {
            await authClient.signUp.email({
                email,
                password,
                name,
            }, {
                onSuccess: () => {
                    goto("/dashboard");
                },
                onError: (ctx) => {
                    error = ctx.error.message;
                    isLoading = false;
                }
            });
        } catch (e) {
            error = "An unexpected error occurred";
            isLoading = false;
        }
    }
</script>

<svelte:head>
    <title>Register | Lumière Academy</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/10 via-background to-background pointer-events-none"></div>

    <Card class="w-full max-w-md border-gold/20 shadow-luxury bg-card/80 backdrop-blur-sm relative z-10 transition-all duration-500 hover:shadow-gold/10">
        <CardHeader class="space-y-1 text-center">
            <CardTitle class="text-3xl font-serif tracking-tight">Create an Account</CardTitle>
            <CardDescription>Join our exclusive learning community</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
            {#if error}
                <div class="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                    {error}
                </div>
            {/if}
            <div class="grid gap-2">
                <Label for="name">Full Name</Label>
                <Input id="name" type="text" placeholder="John Doe" bind:value={name} disabled={isLoading} />
            </div>
            <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input id="email" type="email" placeholder="name@example.com" bind:value={email} disabled={isLoading} />
            </div>
            <div class="grid gap-2">
                <Label for="password">Password</Label>
                <Input id="password" type="password" bind:value={password} disabled={isLoading} />
            </div>
            <div class="grid gap-2">
                <Label for="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" bind:value={confirmPassword} disabled={isLoading} />
            </div>
        </CardContent>
        <CardFooter class="flex flex-col gap-4">
            <Button class="w-full bg-gold hover:bg-gold/90 text-white font-medium transition-all" onclick={handleRegister} disabled={isLoading}>
                {#if isLoading}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                {:else}
                    Create Account
                {/if}
            </Button>
            <div class="text-center text-sm text-muted-foreground">
                Already have an account? 
                <a href="/login" class="underline underline-offset-4 hover:text-primary transition-colors">Sign In</a>
            </div>
        </CardFooter>
    </Card>
</div>
