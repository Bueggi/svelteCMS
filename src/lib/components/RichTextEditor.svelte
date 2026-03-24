<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import Typography from '@tiptap/extension-typography';
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/utils";
    import { 
        Bold, 
        Italic, 
        List, 
        ListOrdered, 
        Heading1, 
        Heading2, 
        Quote, 
        Code, 
        Undo, 
        Redo 
    } from "lucide-svelte";

    let { value = $bindable(''), editable = true, class: className } = $props();

    let element: HTMLElement;
    let editor: Editor | undefined = $state();

    onMount(() => {
        editor = new Editor({
            element: element,
            extensions: [
                StarterKit,
                Typography,
            ],
            content: value,
            editable: editable,
            onTransaction: () => {
                editor = editor;
            },
            onUpdate: ({ editor }) => {
                value = editor.getHTML();
            },
            editorProps: {
                attributes: {
                    class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[150px] p-4'
                }
            }
        });
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    // Watch for external value changes if needed (e.g. initial load vs subsequent updates)
    // For now simplistic, assuming value is source of truth initially.
    $effect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if difference is significant to avoid cursor jumps or loops
            // For now, let's just trust onUpdate handles the out -> in Sync.
            // If we need in -> out sync for external changes, we need more logic.
            // basic implementation:
            if (editor.getText() === '' && value) {
                 editor.commands.setContent(value);
            }
        }
    }); 

</script>

<div class={cn("border rounded-md bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
    {#if editor && editable}
        <div class="flex flex-wrap items-center gap-1 border-b p-1 bg-muted/50">
            <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleBold().run()} 
                disabled={!editor.can().chain().focus().toggleBold().run()}
                data-active={editor.isActive('bold') ? 'true' : undefined}
                class={cn("h-8 w-8", editor.isActive('bold') ? 'bg-muted text-foreground' : '')}
            >
                <Bold class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleItalic().run()} 
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                class={cn("h-8 w-8", editor.isActive('italic') ? 'bg-muted text-foreground' : '')}
            >
                <Italic class="h-4 w-4" />
            </Button>
            <div class="w-px h-6 bg-border mx-1"></div>
            <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} 
                class={cn("h-8 w-8", editor.isActive('heading', { level: 1 }) ? 'bg-muted text-foreground' : '')}
            >
                <Heading1 class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} 
                class={cn("h-8 w-8", editor.isActive('heading', { level: 2 }) ? 'bg-muted text-foreground' : '')}
            >
                <Heading2 class="h-4 w-4" />
            </Button>
            <div class="w-px h-6 bg-border mx-1"></div>
             <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleBulletList().run()} 
                class={cn("h-8 w-8", editor.isActive('bulletList') ? 'bg-muted text-foreground' : '')}
            >
                <List class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" 
                onclick={() => editor?.chain().focus().toggleOrderedList().run()} 
                class={cn("h-8 w-8", editor.isActive('orderedList') ? 'bg-muted text-foreground' : '')}
            >
                <ListOrdered class="h-4 w-4" />
            </Button>
            <div class="w-px h-6 bg-border mx-1"></div>
            <Button variant="ghost" size="icon" class="h-8 w-8" 
                 onclick={() => editor?.chain().focus().undo().run()} 
                 disabled={!editor.can().chain().focus().undo().run()}
            >
                <Undo class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8" 
                 onclick={() => editor?.chain().focus().redo().run()} 
                 disabled={!editor.can().chain().focus().redo().run()}
            >
                <Redo class="h-4 w-4" />
            </Button>
        </div>
    {/if}

    <div bind:this={element} class="min-h-[150px] w-full"></div>
</div>
