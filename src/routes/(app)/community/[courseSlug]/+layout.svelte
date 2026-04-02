
<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
        DialogTrigger,
    } from "$lib/components/ui/dialog";
    import { Hash, MessageSquarePlus, ChevronLeft } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";

    let { data, children } = $props();
    let course = $derived(data.communityCourse);
    let categories = $derived(data.categories);
    let activeCategory = $derived($page.url.searchParams.get('category'));

    const langCtx = getContext<{ lang: LangKey }>('i18n');
    const t = $derived(getT(langCtx.lang));
</script>

<div class="flex h-[calc(100vh-4rem)]">
    <!-- Community Sidebar -->
    <aside class="w-64 border-r bg-muted/10 hidden md:flex flex-col">
        <div class="p-4 border-b">
            <h2 class="font-bold text-lg truncate" title={course.title}>{course.title}</h2>
            <p class="text-xs text-muted-foreground uppercase tracking-widest mt-1">{t('communityTitle')}</p>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-1">
            <Button variant="ghost" class={cn("w-full justify-start", !activeCategory && "bg-muted text-secondary-foreground")} href="/community/{course.slug}">
                <Hash class="w-4 h-4 mr-2" />
                {t('communityAllPosts')}
            </Button>

            <div class="pt-4 pb-2 px-2 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider group">
                {t('communityChannels')}
                {#if ['admin', 'instructor', 'moderator'].includes(data.user?.role)}
                     <Dialog>
                        <DialogTrigger>
                            {#snippet child({ props })}
                                <Button {...props} variant="ghost" size="icon" class="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MessageSquarePlus class="w-3 h-3" />
                                </Button>
                            {/snippet}
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('communityCreateChannel')}</DialogTitle>
                                <DialogDescription>{t('communityChannelDesc')}</DialogDescription>
                            </DialogHeader>
                            <form action="/community/{course.slug}?/createCategory" method="POST" class="space-y-4">
                                <div class="space-y-2">
                                    <Label for="name">{t('communityChannelName')}</Label>
                                    <Input id="name" name="name" placeholder={t('communityChannelPh')} required />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">{t('create')}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                {/if}
            </div>

            {#each categories as category}
                <Button
                    variant="ghost"
                    class={cn("w-full justify-start truncate", activeCategory === category.id && "bg-muted text-secondary-foreground")}
                    href="/community/{course.slug}?category={category.id}"
                    title={category.name}
                >
                    <Hash class="w-4 h-4 mr-2 text-muted-foreground" />
                    {category.name}
                </Button>
            {/each}
        </div>

        <div class="p-4 border-t">
            <Button variant="outline" class="w-full" href="/my-courses">
                <ChevronLeft class="w-4 h-4 mr-2" />
                {t('communityBackToCourses')}
            </Button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto bg-background">
        <div class="container max-w-4xl mx-auto py-6 px-4 md:px-8">
            {@render children()}
        </div>
    </main>
</div>
