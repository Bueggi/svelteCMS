<script lang="ts">
    import { enhance, deserialize } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Label } from "$lib/components/ui/label";
    import { FormSelect } from "$lib/components/ui/form-select";
    import {
        Dialog, DialogContent, DialogDescription, DialogFooter,
        DialogHeader, DialogTitle, DialogTrigger,
    } from "$lib/components/ui/dialog";
    import {
        DropdownMenu, DropdownMenuContent, DropdownMenuItem,
        DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
        DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
    } from "$lib/components/ui/dropdown-menu";
    import { MessageSquare, ThumbsUp, Plus, MoreVertical, ArrowRight, Hash, X, Pencil, Trash2, Send, ChevronRight } from "lucide-svelte";
    import { page } from '$app/stores';

    let { data } = $props();
    let categories = $derived(data.categories);
    let course = $derived(data.communityCourse);

    // Local post list — initialised from server data, then mutated client-side.
    // Use $state.raw so that replacing the whole array always triggers reactivity.
    let localPosts = $state<any[]>([...(data.posts as any[])]);
    // Only reset when the server-side data actually changes (e.g. new post created via form).
    let _prevPostsRef = data.posts;
    $effect(() => {
        if (data.posts !== _prevPostsRef) {
            _prevPostsRef = data.posts;
            localPosts = [...(data.posts as any[])];
        }
    });

    const currentUser = $derived(data.user);
    const isStaff = $derived(['admin', 'instructor', 'moderator'].includes((currentUser as any)?.role));

    // ── New post dialog ───────────────────────────────────────────────────────
    let isNewPostOpen = $state(false);

    // ── Post modal state ──────────────────────────────────────────────────────
    let modalOpen = $state(false);
    let selectedPost = $state<any>(null);
    let modalComments = $state<any[]>([]);
    let commentsLoading = $state(false);

    // Editing state
    let editingPost = $state(false);
    let editPostTitle = $state('');
    let editPostBody = $state('');
    let editingCommentId = $state<string | null>(null);
    let editCommentBody = $state('');
    let newCommentBody = $state('');
    let submitting = $state(false);

    function canEdit(authorId: string) {
        return isStaff || (currentUser as any)?.id === authorId;
    }

    async function callAction(action: string, fields: Record<string, string>) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        const res = await fetch(`?/${action}`, { method: 'POST', body: fd });
        const text = await res.text();
        return deserialize(text) as any;
    }

    async function openPost(post: any) {
        selectedPost = post;
        modalOpen = true;
        editingPost = false;
        editingCommentId = null;
        newCommentBody = '';
        await reloadComments(post.id);
    }

    function closeModal() {
        modalOpen = false;
        selectedPost = null;
        modalComments = [];
        editingPost = false;
        editingCommentId = null;
    }

    async function reloadComments(postId: string) {
        commentsLoading = true;
        const result = await callAction('getPost', { postId });
        if (result.type === 'success') {
            modalComments = (result.data?.post as any)?.comments ?? [];
        }
        commentsLoading = false;
    }

    // ── Post actions ──────────────────────────────────────────────────────────
    function startEditPost() {
        editPostTitle = selectedPost.title;
        editPostBody = selectedPost.body;
        editingPost = true;
    }

    async function saveEditPost() {
        if (!selectedPost) return;
        submitting = true;
        const result = await callAction('editPost', {
            postId: selectedPost.id,
            title: editPostTitle,
            body: editPostBody,
        });
        submitting = false;
        if (result.type === 'success') {
            selectedPost = { ...selectedPost, title: editPostTitle, body: editPostBody };
            localPosts = localPosts.map((p: any) =>
                p.id === selectedPost.id ? { ...p, title: editPostTitle, body: editPostBody } : p
            );
            editingPost = false;
        }
    }

    async function deletePost(postId: string) {
        if (!confirm('Diskussion löschen?')) return;
        await callAction('deletePost', { postId });
        localPosts = localPosts.filter((p: any) => p.id !== postId);
        closeModal();
    }

    // ── Comment actions ───────────────────────────────────────────────────────
    async function submitComment() {
        if (!newCommentBody.trim() || !selectedPost) return;
        submitting = true;
        await callAction('createComment', { postId: selectedPost.id, body: newCommentBody });
        newCommentBody = '';
        submitting = false;
        localPosts = localPosts.map((p: any) =>
            p.id === selectedPost.id ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p
        );
        await reloadComments(selectedPost.id);
    }

    function startEditComment(comment: any) {
        editingCommentId = comment.id;
        editCommentBody = comment.body;
    }

    async function saveEditComment() {
        if (!editingCommentId) return;
        submitting = true;
        await callAction('editComment', { commentId: editingCommentId, body: editCommentBody });
        submitting = false;
        editingCommentId = null;
        await reloadComments(selectedPost.id);
    }

    async function deleteComment(commentId: string) {
        if (!confirm('Antwort löschen?')) return;
        await callAction('deleteComment', { commentId });
        localPosts = localPosts.map((p: any) =>
            p.id === selectedPost?.id ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 1) - 1) } : p
        );
        await reloadComments(selectedPost.id);
    }

    function avatarText(name: string) {
        return name?.[0]?.toUpperCase() ?? '?';
    }

    function formatDate(d: string | Date) {
        return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
    }
</script>

<!-- ── Page header + New Discussion button ──────────────────────────────────── -->
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
        <h1 class="text-3xl font-serif font-semibold text-foreground">
            {$page.url.searchParams.get('category')
                ? (categories.find((c: any) => c.id === $page.url.searchParams.get('category'))?.name ?? 'Discussions')
                : 'Community Discussions'}
        </h1>
        <p class="text-muted-foreground text-sm mt-1">Connect, share, and learn with fellow students.</p>
    </div>

    <Dialog bind:open={isNewPostOpen}>
        <DialogTrigger>
            {#snippet child({ props })}
                <Button {...props} class="shrink-0 gap-2">
                    <Plus class="w-4 h-4" /> New Discussion
                </Button>
            {/snippet}
        </DialogTrigger>
        <DialogContent class="sm:max-w-[540px]">
            <DialogHeader>
                <DialogTitle>Create a new post</DialogTitle>
                <DialogDescription>Share your thoughts with the community.</DialogDescription>
            </DialogHeader>
            <form
                action="?/createPost"
                method="POST"
                use:enhance={() => {
                    return async ({ result, update }) => {
                        await update();
                        if (result.type === 'success') isNewPostOpen = false;
                    };
                }}
                class="space-y-4 mt-2"
            >
                <div class="space-y-1.5">
                    <Label for="title">Title</Label>
                    <Input id="title" name="title" placeholder="What's on your mind?" required />
                </div>
                <div class="space-y-1.5">
                    <Label for="category">Channel</Label>
                    <FormSelect id="category" name="categoryId" required>
                        {#each categories as category}
                            <option value={category.id}>{category.name}</option>
                        {/each}
                    </FormSelect>
                </div>
                <div class="space-y-1.5">
                    <Label for="body">Content</Label>
                    <Textarea id="body" name="body" placeholder="Write your post details here..." rows={5} required class="resize-none" />
                </div>
                <DialogFooter>
                    <Button type="submit" class="w-full sm:w-auto">Post Discussion</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</div>

<!-- ── Post feed ─────────────────────────────────────────────────────────────── -->
{#if localPosts.length === 0}
    <div class="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-2xl">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare class="w-8 h-8 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-2">No discussions yet</h3>
        <p class="text-muted-foreground max-w-sm text-sm">Be the first to start a conversation!</p>
    </div>
{:else}
    <div class="space-y-3">
        {#each localPosts as post (post.id)}
            <button
                onclick={() => openPost(post)}
                class="group w-full text-left bg-card border border-border/60 rounded-2xl hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
            >
                <div class="p-5 flex items-start gap-4">
                    <div class="hidden sm:flex flex-col items-center gap-1 text-secondary-foreground bg-muted/50 border border-border/60 px-3 py-2.5 rounded-xl shrink-0 min-w-[3rem]">
                        <ThumbsUp class="w-4 h-4" />
                        <span class="text-xs font-bold">0</span>
                    </div>

                    <div class="flex-1 min-w-0 space-y-2">
                        <div class="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                                <Hash class="w-3 h-3" />{post.category.name}
                            </span>
                            <span class="flex items-center gap-1.5">
                                <span class="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                                    {avatarText(post.author.name)}
                                </span>
                                {post.author.name}
                            </span>
                            <span class="ml-auto">{formatDate(post.createdAt)}</span>
                        </div>

                        <h3 class="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                            {post.title}
                        </h3>
                        <p class="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.body}</p>

                        <div class="flex items-center justify-between pt-2 border-t border-border/30 mt-1">
                            <span class="inline-flex items-center gap-1.5 text-xs text-secondary-foreground bg-muted/50 rounded-full px-3 py-1">
                                <MessageSquare class="w-3.5 h-3.5" />
                                {post.commentCount} Antworten
                            </span>
                            <span class="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                                Öffnen <ChevronRight class="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </div>
            </button>
        {/each}
    </div>

    <!-- Admin: move post dropdown (separate form, not inside the button) -->
    {#if isStaff}
        <div class="hidden">
            {#each localPosts as post (post.id)}
                {#each categories as category}
                    {#if category.id !== post.categoryId}
                        <form action="?/movePost" method="POST" use:enhance id="move-{post.id}-{category.id}">
                            <input type="hidden" name="postId" value={post.id} />
                            <input type="hidden" name="categoryId" value={category.id} />
                        </form>
                    {/if}
                {/each}
            {/each}
        </div>
    {/if}
{/if}

<!-- ── Post modal ─────────────────────────────────────────────────────────────── -->
{#if modalOpen && selectedPost}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
        <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <!-- Modal header -->
            <div class="flex items-start gap-3 p-5 border-b border-border/40 shrink-0">
                <div class="flex-1 min-w-0">
                    {#if editingPost}
                        <Input bind:value={editPostTitle} class="font-semibold text-base" />
                    {:else}
                        <h2 class="font-serif font-semibold text-xl leading-snug">{selectedPost.title}</h2>
                        <div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span class="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center text-[9px] text-white font-bold shrink-0">
                                {avatarText(selectedPost.author.name)}
                            </span>
                            {selectedPost.author.name} · {formatDate(selectedPost.createdAt)}
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                                <Hash class="w-2.5 h-2.5" />{selectedPost.category.name}
                            </span>
                        </div>
                    {/if}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    {#if canEdit(selectedPost.authorId)}
                        {#if editingPost}
                            <Button size="sm" onclick={saveEditPost} disabled={submitting}>Speichern</Button>
                            <Button size="sm" variant="ghost" onclick={() => editingPost = false}>Abbrechen</Button>
                        {:else}
                            <button onclick={startEditPost} class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Bearbeiten">
                                <Pencil class="w-4 h-4" />
                            </button>
                            <button onclick={() => deletePost(selectedPost.id)} class="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Löschen">
                                <Trash2 class="w-4 h-4" />
                            </button>
                        {/if}
                    {/if}
                    <button onclick={closeModal} class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground ml-1">
                        <X class="w-4 h-4" />
                    </button>
                </div>
            </div>

            <!-- Scrollable body -->
            <div class="flex-1 overflow-y-auto">
                <!-- Post body -->
                <div class="px-5 py-4 border-b border-border/30">
                    {#if editingPost}
                        <Textarea bind:value={editPostBody} rows={6} class="resize-none text-sm" />
                    {:else}
                        <p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedPost.body}</p>
                    {/if}
                </div>

                <!-- Comments section -->
                <div class="px-5 py-4 space-y-4">
                    <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {#if commentsLoading}Lade Antworten...{:else}{modalComments.length} Antworten{/if}
                    </h3>

                    {#if commentsLoading}
                        <div class="space-y-3">
                            {#each [1,2] as _}
                                <div class="animate-pulse flex gap-3">
                                    <div class="w-7 h-7 rounded-full bg-muted shrink-0"></div>
                                    <div class="flex-1 space-y-2">
                                        <div class="h-3 bg-muted rounded w-1/4"></div>
                                        <div class="h-3 bg-muted rounded w-3/4"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else if modalComments.length === 0}
                        <p class="text-sm text-muted-foreground py-4 text-center">Noch keine Antworten. Sei der Erste!</p>
                    {:else}
                        {#each modalComments as comment (comment.id)}
                            <div class="group/comment flex gap-3">
                                <span class="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0 mt-0.5">
                                    {avatarText(comment.author.name)}
                                </span>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span class="font-medium text-foreground">{comment.author.name}</span>
                                            {formatDate(comment.createdAt)}
                                        </div>
                                        {#if canEdit(comment.authorId)}
                                            <div class="flex gap-0.5 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                {#if editingCommentId === comment.id}
                                                    <Button size="sm" onclick={saveEditComment} disabled={submitting} class="h-6 px-2 text-xs">Speichern</Button>
                                                    <Button size="sm" variant="ghost" onclick={() => editingCommentId = null} class="h-6 px-2 text-xs">Abbrechen</Button>
                                                {:else}
                                                    <button onclick={() => startEditComment(comment)} class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                                        <Pencil class="w-3 h-3" />
                                                    </button>
                                                    <button onclick={() => deleteComment(comment.id)} class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                                        <Trash2 class="w-3 h-3" />
                                                    </button>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>

                                    {#if editingCommentId === comment.id}
                                        <Textarea bind:value={editCommentBody} rows={3} class="mt-1.5 text-sm resize-none" />
                                    {:else}
                                        <p class="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                                    {/if}

                                    <!-- Replies -->
                                    {#if comment.replies?.length}
                                        <div class="mt-3 pl-3 border-l-2 border-border/40 space-y-3">
                                            {#each comment.replies as reply (reply.id)}
                                                <div class="group/reply flex gap-2">
                                                    <span class="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-400 to-pink-400 flex items-center justify-center text-[9px] text-white font-bold shrink-0 mt-0.5">
                                                        {avatarText(reply.author.name)}
                                                    </span>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="flex items-center justify-between gap-2">
                                                            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span class="font-medium text-foreground">{reply.author.name}</span>
                                                                {formatDate(reply.createdAt)}
                                                            </div>
                                                            {#if canEdit(reply.authorId)}
                                                                <div class="flex gap-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                                                    {#if editingCommentId === reply.id}
                                                                        <Button size="sm" onclick={saveEditComment} disabled={submitting} class="h-6 px-2 text-xs">Speichern</Button>
                                                                        <Button size="sm" variant="ghost" onclick={() => editingCommentId = null} class="h-6 px-2 text-xs">Abbrechen</Button>
                                                                    {:else}
                                                                        <button onclick={() => startEditComment(reply)} class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                                                            <Pencil class="w-3 h-3" />
                                                                        </button>
                                                                        <button onclick={() => deleteComment(reply.id)} class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                                                            <Trash2 class="w-3 h-3" />
                                                                        </button>
                                                                    {/if}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                        {#if editingCommentId === reply.id}
                                                            <Textarea bind:value={editCommentBody} rows={2} class="mt-1 text-sm resize-none" />
                                                        {:else}
                                                            <p class="text-sm text-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                                                        {/if}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- New comment form -->
            <div class="border-t border-border/40 p-4 shrink-0 bg-muted/20">
                <div class="flex gap-3 items-end">
                    <span class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0 mb-0.5">
                        {avatarText((currentUser as any)?.name ?? '?')}
                    </span>
                    <div class="flex-1 flex gap-2 items-end">
                        <Textarea
                            bind:value={newCommentBody}
                            placeholder="Antwort schreiben..."
                            rows={2}
                            class="resize-none text-sm flex-1"
                            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment(); }}
                        />
                        <Button onclick={submitComment} disabled={submitting || !newCommentBody.trim()} size="icon" class="shrink-0 mb-0.5">
                            <Send class="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                <p class="text-[10px] text-muted-foreground mt-1.5 ml-10">Ctrl+Enter zum Senden</p>
            </div>
        </div>
    </div>
{/if}
