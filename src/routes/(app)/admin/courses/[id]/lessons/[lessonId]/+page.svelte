<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { PageTitle } from "$lib/components/ui/page-title";
    import {
        ChevronLeft,
        Save,
        Video,
        FileText,
        ExternalLink,
        Eye,
        Heading1,
        Heading2,
        Heading3,
        Bold as BoldIcon,
        Italic as ItalicIcon,
        Underline as UnderlineIcon,
        List,
        ListOrdered,
        Code,
        Link as LinkIcon,
        ImagePlus,
        Loader2
    } from "lucide-svelte";
    import { onMount, onDestroy } from 'svelte';
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import Link from '@tiptap/extension-link';
    import Underline from '@tiptap/extension-underline';
    import Youtube from '@tiptap/extension-youtube';
    import Image from '@tiptap/extension-image';

    let { data } = $props();
    
    // Local state for the lesson data to allow editing
    let lesson = $state({ ...data.lesson });
    let editorContent = $state(lesson.content || '');

    let editor: Editor | null = $state(null);
    let editorElement: HTMLElement;
    let isSaving = $state(false);
    let editorStateCounter = $state(0);
    let isUploadingImage = $state(false);
    let imageFileInput = $state<HTMLInputElement>(null!);

    async function handleImageUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file || !editor) return;

        isUploadingImage = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json();
                alert(err.message || 'Upload failed');
                return;
            }
            const { url } = await res.json();
            editor.chain().focus().setImage({ src: url }).run();
        } catch (e) {
            alert('Upload failed. Please try again.');
        } finally {
            isUploadingImage = false;
            // Reset input so the same file can be re-selected
            imageFileInput.value = '';
        }
    }

    // Helper for reactive toolbar highlights
    function isActive(name: string, attrs?: any) {
        if (!editor || editorStateCounter < 0) return false;
        return editor.isActive(name, attrs);
    }

    // Sync from server data when it updates (e.g. after form submission)
    $effect(() => {
        if (data.lesson) {
            lesson = { ...data.lesson };
        }
    });

    onMount(() => {
        // Pre-fill content if empty
        const initialContent = lesson.content && lesson.content !== '<p></p>' 
            ? lesson.content 
            : `<h1>${lesson.title}</h1><p>Start writing your lesson content here...</p>`;

        editor = new Editor({
            element: editorElement,
            extensions: [
                StarterKit,
                Underline,
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-primary underline cursor-pointer',
                    }
                }),
                Youtube.configure({
                    controls: true,
                }),
                Image.configure({
                    HTMLAttributes: {
                        class: 'max-w-full rounded-lg my-4',
                    },
                }),
            ],
            content: initialContent,
            editorProps: {
                attributes: {
                    class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 bg-background border rounded-md shadow-inner',
                },
            },
            onUpdate: ({ editor }) => {
                editorContent = editor.getHTML();
                editorStateCounter++;
            },
            onTransaction: () => {
                editorStateCounter++;
            },
            onSelectionUpdate: () => {
                editorStateCounter++;
            }
        });
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    function getYouTubeId(url: string) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    let videoId = $derived(getYouTubeId(lesson.videoUrl || ''));
</script>

<div class="max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-20 py-4 border-b">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/admin/courses/{data.id}">
                <ChevronLeft class="w-5 h-5" />
            </Button>
            <div>
                <div class="flex items-center gap-2">
                    <PageTitle class="text-2xl">{lesson.title}</PageTitle>
                    <Badge variant={lesson.isPublished ? 'default' : 'secondary'}>
                        {lesson.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                </div>
                <p class="text-sm text-muted-foreground">Admin Lesson Editor</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
             <Button variant="outline" href="/admin/preview/courses/{data.courseSlug}/learn/{lesson.id}" target="_blank">
                <Eye class="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button form="lesson-form" disabled={isSaving}>
                <Save class="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
    </div>

    <form 
        id="lesson-form"
        method="POST" 
        action="?/updateLesson" 
        use:enhance={() => {
            isSaving = true;
            return async ({ update, result }) => {
                await update();
                isSaving = false;
            };
        }}
        class="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
        <!-- Left: Lesson Settings -->
        <div class="lg:col-span-1 space-y-6">
            <div class="bg-card border rounded-lg p-6 space-y-6 shadow-sm">
                <h2 class="text-lg font-serif font-semibold border-b pb-2">Lesson Settings</h2>
                
                <div class="space-y-2">
                    <Label for="title">Lesson Name</Label>
                    <Input id="title" name="title" bind:value={lesson.title} placeholder="e.g. Introduction to Svelte" required />
                </div>

                <div class="space-y-2">
                    <Label for="videoUrl">Video URL (YouTube/Vimeo)</Label>
                    <div class="flex gap-2">
                        <Input id="videoUrl" name="videoUrl" bind:value={lesson.videoUrl} placeholder="https://youtube.com/watch?v=..." />
                        {#if lesson.videoUrl}
                            <Button variant="outline" size="icon" href={lesson.videoUrl} target="_blank">
                                <ExternalLink class="w-4 h-4" />
                            </Button>
                        {/if}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <Label for="duration">Duration (mins)</Label>
                        <Input id="duration" name="duration" type="number" bind:value={lesson.duration} />
                    </div>
                    <div class="space-y-2">
                        <Label for="dripDays">Drip (days after enrollment)</Label>
                        <Input id="dripDays" name="dripDays" type="number" min="0" bind:value={lesson.dripDays} placeholder="Immediately" />
                        <p class="text-xs text-muted-foreground">Leave empty for immediate access.</p>
                    </div>
                </div>

                <div class="space-y-4 pt-4 border-t">
                    <div class="flex items-center justify-between">
                        <Label for="isPublished" class="flex flex-col gap-1">
                            <span>Published</span>
                            <span class="text-xs font-normal text-muted-foreground">Make this lesson visible to students</span>
                        </Label>
                        <input type="checkbox" id="isPublished" name="isPublished" class="w-4 h-4" checked={lesson.isPublished} />
                    </div>

                    <div class="flex items-center justify-between">
                        <Label for="isFreePreview" class="flex flex-col gap-1">
                            <span>Free Preview</span>
                            <span class="text-xs font-normal text-muted-foreground">Allow non-enrolled users to watch</span>
                        </Label>
                        <input type="checkbox" id="isFreePreview" name="isFreePreview" class="w-4 h-4" checked={lesson.isFreePreview} />
                    </div>
                </div>
            </div>

            {#if videoId}
                <div class="bg-card border rounded-lg p-4 space-y-3 shadow-sm">
                    <h3 class="text-sm font-medium flex items-center gap-2">
                        <Video class="w-4 h-4 text-blue-500" /> Video Preview
                    </h3>
                    <div class="aspect-video bg-muted rounded overflow-hidden">
                        <iframe
                            class="w-full h-full"
                            src="https://www.youtube.com/embed/{videoId}"
                            title="Video preview"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                        ></iframe>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Right: Content Editor -->
        <div class="lg:col-span-2 space-y-6">
            <div class="bg-card border rounded-lg p-6 space-y-4 shadow-sm min-h-[600px]">
                <div class="flex flex-col space-y-4">
                    <div class="flex items-center justify-between border-b pb-2">
                        <h2 class="text-lg font-serif font-semibold flex items-center gap-2">
                            <FileText class="w-5 h-5 text-orange-500" /> Lesson Content
                        </h2>
                    </div>

                    <!-- Toolbar -->
                    <div class="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md mb-2 border transition-all">
                        {#if editorStateCounter >= 0}
                            <div class="flex gap-1 items-center bg-background rounded border p-1 shadow-sm">
                                <Button type="button" variant={isActive('heading', { level: 1 }) ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} class="px-2 h-8 text-xs">
                                    <Heading1 class="w-3.5 h-3.5 mr-1" /> H1
                                </Button>
                                <Button type="button" variant={isActive('heading', { level: 2 }) ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} class="px-2 h-8 text-xs">
                                    <Heading2 class="w-3.5 h-3.5 mr-1" /> H2
                                </Button>
                                <Button type="button" variant={isActive('heading', { level: 3 }) ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} class="px-2 h-8 text-xs">
                                    <Heading3 class="w-3.5 h-3.5 mr-1" /> H3
                                </Button>
                            </div>

                        <div class="flex gap-1 items-center bg-background rounded border p-1 shadow-sm">
                            <Button type="button" variant={isActive('bold') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleBold().run()} class="w-8 h-8 p-0">
                                <BoldIcon class="w-3.5 h-3.5" />
                            </Button>
                            <Button type="button" variant={isActive('italic') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleItalic().run()} class="w-8 h-8 p-0">
                                <ItalicIcon class="w-3.5 h-3.5" />
                            </Button>
                            <Button type="button" variant={isActive('underline') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleUnderline().run()} class="w-8 h-8 p-0">
                                <UnderlineIcon class="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div class="flex gap-1 items-center bg-background rounded border p-1 shadow-sm">
                            <Button type="button" variant={isActive('bulletList') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleBulletList().run()} class="w-8 h-8 p-0">
                                <List class="w-3.5 h-3.5" />
                            </Button>
                            <Button type="button" variant={isActive('orderedList') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleOrderedList().run()} class="w-8 h-8 p-0">
                                <ListOrdered class="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div class="flex gap-1 items-center bg-background rounded border p-1 shadow-sm">
                            <Button type="button" variant={isActive('codeBlock') ? 'luxury' : 'ghost'} size="sm" onclick={() => editor?.chain().focus().toggleCodeBlock().run()} class="px-2 h-8 text-xs">
                                <Code class="w-3.5 h-3.5 mr-1" /> Code
                            </Button>
                            <Button type="button" variant={isActive('link') ? 'luxury' : 'ghost'} size="sm" onclick={() => {
                                const previousUrl = editor?.getAttributes('link').href;
                                const url = window.prompt('URL', previousUrl);
                                if (url === '') {
                                    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
                                } else if (url) {
                                    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                                }
                            }} class="px-2 h-8 text-xs">
                                <LinkIcon class="w-3.5 h-3.5 mr-1" /> Link
                            </Button>
                        </div>

                        <!-- Image upload -->
                        <div class="flex gap-1 items-center bg-background rounded border p-1 shadow-sm">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onclick={() => imageFileInput.click()}
                                disabled={isUploadingImage}
                                class="px-2 h-8 text-xs"
                                title="Bild hochladen"
                            >
                                {#if isUploadingImage}
                                    <Loader2 class="w-3.5 h-3.5 mr-1 animate-spin" />
                                {:else}
                                    <ImagePlus class="w-3.5 h-3.5 mr-1" />
                                {/if}
                                Bild
                            </Button>
                            <input
                                bind:this={imageFileInput as any}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                                class="hidden"
                                onchange={handleImageUpload}
                            />
                        </div>
                        {/if}
                    </div>
                </div>
                
                <div bind:this={editorElement} class="tiptap-container"></div>
                <input type="hidden" name="content" value={editorContent} />
            </div>
        </div>
    </form>
</div>

<style>
    /* TipTap Styling */
    :global(.tiptap-container .ProseMirror) {
        outline: none;
    }
    :global(.tiptap-container .ProseMirror p.is-editor-empty:first-child::before) {
        color: #adb5bd;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }
</style>
