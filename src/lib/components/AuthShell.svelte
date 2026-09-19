<script lang="ts">
    import type { Snippet } from "svelte";

    let { title, subtitle, children }: { title: string; subtitle?: string; children: Snippet } = $props();
</script>

<!-- Same look as the login page: centered form over soft background orbs.
     Children can use the `.field` (label + input) and `.submit-btn` classes. -->
<div class="auth-shell min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
    </div>

    <div class="relative z-10 w-full max-w-90 space-y-8">
        <div class="space-y-1">
            <h1 class="text-3xl font-serif font-medium tracking-tight">{title}</h1>
            {#if subtitle}
                <p class="text-sm text-muted-foreground">{subtitle}</p>
            {/if}
        </div>

        {@render children()}
    </div>
</div>

<style>
    /* Background orbs */
    .orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        opacity: 0.35;
    }
    .orb-1 {
        width: 45vw; height: 45vw;
        top: -10%; left: -10%;
        background: hsl(var(--primary));
        animation: drift 18s ease-in-out infinite alternate;
    }
    .orb-2 {
        width: 35vw; height: 35vw;
        bottom: -5%; right: -5%;
        background: hsl(var(--accent));
        animation: drift 22s ease-in-out infinite alternate-reverse;
    }
    .orb-3 {
        width: 25vw; height: 25vw;
        top: 55%; left: 55%;
        background: hsl(var(--secondary));
        opacity: 0.2;
        animation: drift 14s ease-in-out infinite alternate;
    }
    @keyframes drift {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(4%, 6%) scale(1.08); }
    }

    /* Field */
    .auth-shell :global(.field) {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .auth-shell :global(.field label) {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: hsl(var(--muted-foreground));
    }
    .auth-shell :global(.field input) {
        width: 100%;
        height: 3rem;
        padding: 0 1rem;
        border-radius: 0.875rem;
        border: 1px solid hsl(var(--border));
        background: hsl(var(--muted) / 0.3);
        font-size: 0.875rem;
        color: hsl(var(--foreground));
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .auth-shell :global(.field input:focus) {
        border-color: hsl(var(--primary) / 0.6);
        background: hsl(var(--muted) / 0.5);
        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
    }
    .auth-shell :global(.field input::placeholder) {
        color: hsl(var(--muted-foreground) / 0.35);
    }
    .auth-shell :global(.field input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Submit */
    .auth-shell :global(.submit-btn) {
        margin-top: 0.5rem;
        width: 100%;
        height: 3rem;
        border-radius: 0.875rem;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-decoration: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 20px hsl(var(--primary) / 0.3);
    }
    .auth-shell :global(.submit-btn:hover:not(:disabled)) {
        opacity: 0.92;
        transform: translateY(-1px);
        box-shadow: 0 6px 28px hsl(var(--primary) / 0.4);
    }
    .auth-shell :global(.submit-btn:active:not(:disabled)) {
        transform: translateY(0);
    }
    .auth-shell :global(.submit-btn:disabled) {
        opacity: 0.55;
        cursor: not-allowed;
    }
</style>
