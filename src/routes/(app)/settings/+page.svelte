<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { SectionCard } from "$lib/components/ui/section-card";
    import { authClient } from "$lib/auth-client";
    import { User, Lock, Mail, CreditCard, CheckCircle2, AlertCircle, ExternalLink } from "lucide-svelte";
    import { untrack } from 'svelte';

    let { data } = $props();

    let name  = $state(untrack(() => data.user?.name  || ''));
    let email = $state(untrack(() => data.user?.email || ''));

    $effect(() => {
        name  = data.user?.name  || '';
        email = data.user?.email || '';
    });

    let currentPassword  = $state('');
    let newPassword      = $state('');
    let confirmPassword  = $state('');
    let isUpdatingProfile   = $state(false);
    let isChangingPassword  = $state(false);
    let profileFeedback  = $state<{ type: 'success' | 'error'; message: string } | null>(null);
    let passwordFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

    async function handleUpdateProfile() {
        isUpdatingProfile = true;
        profileFeedback = null;
        try {
            await authClient.updateUser({ name });
            profileFeedback = { type: 'success', message: 'Profil erfolgreich aktualisiert.' };
        } catch {
            profileFeedback = { type: 'error', message: 'Profil konnte nicht aktualisiert werden.' };
        } finally {
            isUpdatingProfile = false;
        }
    }

    async function handleChangePassword() {
        passwordFeedback = null;
        if (newPassword !== confirmPassword) {
            passwordFeedback = { type: 'error', message: 'Passwörter stimmen nicht überein.' };
            return;
        }
        isChangingPassword = true;
        try {
            await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
            passwordFeedback = { type: 'success', message: 'Passwort erfolgreich geändert.' };
            currentPassword = '';
            newPassword = '';
            confirmPassword = '';
        } catch {
            passwordFeedback = { type: 'error', message: 'Fehler beim Ändern des Passworts. Bitte aktuelles Passwort prüfen.' };
        } finally {
            isChangingPassword = false;
        }
    }
</script>

<PageContainer>
    <PageHeader title="Einstellungen" description="Konto und Sicherheit verwalten." />

    <div class="space-y-6 max-w-2xl">
        <!-- Profile -->
        <SectionCard title="Profilinformationen" description="Aktualisiere deinen Anzeigenamen.">
            {#snippet icon()}<User class="w-5 h-5 text-primary" />{/snippet}
            <div class="grid gap-2">
                <Label for="name">Anzeigename</Label>
                <Input id="name" bind:value={name} placeholder="Dein Name" />
            </div>
            <div class="grid gap-2">
                <Label for="email">E-Mail-Adresse</Label>
                <div class="relative">
                    <Mail class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="email" bind:value={email} class="pl-9" disabled />
                </div>
                <p class="text-xs text-muted-foreground">Wende dich an den Support, um deine E-Mail zu ändern.</p>
            </div>
            {#if profileFeedback}
                <div class="flex items-center gap-2 text-sm {profileFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}">
                    {#if profileFeedback.type === 'success'}<CheckCircle2 class="w-4 h-4 shrink-0" />{:else}<AlertCircle class="w-4 h-4 shrink-0" />{/if}
                    {profileFeedback.message}
                </div>
            {/if}
            {#snippet footer()}
                <Button onclick={handleUpdateProfile} disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? 'Speichern...' : 'Änderungen speichern'}
                </Button>
            {/snippet}
        </SectionCard>

        <!-- Security -->
        <SectionCard title="Sicherheit" description="Passwort ändern.">
            {#snippet icon()}<Lock class="w-5 h-5 text-primary" />{/snippet}
            <div class="grid gap-2">
                <Label for="current-password">Aktuelles Passwort</Label>
                <Input id="current-password" type="password" bind:value={currentPassword} />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="grid gap-2">
                    <Label for="new-password">Neues Passwort</Label>
                    <Input id="new-password" type="password" bind:value={newPassword} />
                </div>
                <div class="grid gap-2">
                    <Label for="confirm-password">Passwort bestätigen</Label>
                    <Input id="confirm-password" type="password" bind:value={confirmPassword} />
                </div>
            </div>
            {#if passwordFeedback}
                <div class="flex items-center gap-2 text-sm {passwordFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}">
                    {#if passwordFeedback.type === 'success'}<CheckCircle2 class="w-4 h-4 shrink-0" />{:else}<AlertCircle class="w-4 h-4 shrink-0" />{/if}
                    {passwordFeedback.message}
                </div>
            {/if}
            {#snippet footer()}
                <Button onclick={handleChangePassword} disabled={isChangingPassword} variant="secondary">
                    {isChangingPassword ? 'Aktualisieren...' : 'Passwort ändern'}
                </Button>
            {/snippet}
        </SectionCard>

        <!-- Billing teaser -->
        <SectionCard title="Abrechnung" description="Abonnements, Käufe und Rechnungen verwalten.">
            {#snippet icon()}<CreditCard class="w-5 h-5 text-primary" />{/snippet}
            <p class="text-sm text-muted-foreground">
                Hier findest du deine aktiven Mitgliedschaften, alle vergangenen Käufe und kannst Rechnungen als PDF herunterladen.
            </p>
            {#snippet footer()}
                <Button href="/billing" variant="outline">
                    <ExternalLink class="w-4 h-4 mr-2" />
                    Zum Abrechnungsbereich
                </Button>
            {/snippet}
        </SectionCard>
    </div>
</PageContainer>
