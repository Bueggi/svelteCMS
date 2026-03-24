<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Label } from "$lib/components/ui/label";
    import { Plus, Save, GripVertical, Video, FileText, ChevronRight, ChevronDown, Trash2, Edit2, Hash, Copy, Star } from "lucide-svelte";
    import { dndzone, type DndEvent } from 'svelte-dnd-action';
    import { flip } from 'svelte/animate';
    import { slide } from 'svelte/transition';

    import { untrack } from 'svelte';
    import RichTextEditor from "$lib/components/RichTextEditor.svelte";
    import { FormSelect } from "$lib/components/ui/form-select";
    import CourseAdminNav from "$lib/components/ui/CourseAdminNav.svelte";
    import MediaPicker from "$lib/components/MediaPicker.svelte";

    let { data } = $props();
    let course = $derived(data.course);
    let thumbnailUrl = $state(course?.thumbnailUrl ?? '');
    let moduleRatingMap = $derived(data.moduleRatingMap ?? {});
    let selectedAccessType = $state(course?.accessType ?? 'lifetime');

    let activeTab = $state('curriculum'); // 'curriculum' | 'settings'
    let isSaving = $state(false);

    // Curriculum State - initialized to empty and sync via effect to avoid prop-init warning
    let modules = $state<any[]>([]);

    // We use a regular variable for internal effect memory to avoid circular dependencies
    let lastModulesData = null;

    $effect(() => {
        const serverModules = data.course.modules;

        // Prevent unnecessary re-runs if data identity hasn't changed
        if (serverModules === lastModulesData) return;
        lastModulesData = serverModules;

        untrack(() => {
            // Sync with local state while preserving UI flags
            modules = serverModules.map(m => {
                const existingModule = modules.find(existing => existing.id === m.id);
                return {
                    ...m,
                    id: m.id,
                    expand: existingModule?.expand ?? true,
                    isEditing: existingModule?.isEditing ?? false,
                    lessons: m.lessons.map(l => {
                        const existingLesson = existingModule?.lessons?.find(existingL => existingL.id === l.id);
                        return {
                            ...l, 
                            id: l.id,
                            isEditing: existingLesson?.isEditing ?? false
                        };
                    })
                };
            });
        });
    });

    function handleDndConsiderModules(e: any) {
        modules = e.detail.items;
    }

    async function handleDndFinalizeModules(e: any) {
        modules = e.detail.items;
        
        // Save order to server
        const formData = new FormData();
        formData.append('payload', JSON.stringify({ modules: modules }));
        
        const response = await fetch('?/reorderCurriculum', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error('Failed to save module order');
        }
    }

    function handleDndConsiderLessons(moduleId: string, e: any) {
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex !== -1) {
            modules[moduleIndex].lessons = e.detail.items;
        }
    }

    async function handleDndFinalizeLessons(moduleId: string, e: any) {
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex !== -1) {
            modules[moduleIndex].lessons = e.detail.items;
            
            // Save order to server
            const formData = new FormData();
            formData.append('payload', JSON.stringify({ lessons: e.detail.items }));
            
            const response = await fetch('?/reorderLessons', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                console.error('Failed to save lesson order');
            }
        }
    }
</script>

<div class="flex gap-10 max-w-6xl mx-auto pb-20 pt-2">
    <!-- Sidebar -->
    <CourseAdminNav
        courseId={course.id}
        courseSlug={course.slug}
        courseTitle={course.title}
        isPublished={course.isPublished}
        {activeTab}
        onTabChange={(tab) => activeTab = tab}
    />

    <!-- Main content -->
    <div class="flex-1 min-w-0 space-y-6">

    <!-- Section header -->
    <div class="flex items-center justify-between pb-4 border-b border-border/40">
        <h2 class="text-lg font-serif font-semibold text-foreground capitalize">
            {activeTab === 'settings' ? 'Einstellungen' : activeTab === 'curriculum' ? 'Curriculum' : activeTab === 'community' ? 'Community' : 'Verkauf & Links'}
        </h2>
        {#if activeTab === 'settings'}
            <Button form="settings-form" type="submit" disabled={isSaving} size="sm">
                <Save class="w-4 h-4 mr-1.5" /> {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
        {/if}
    </div>

    {#if activeTab === 'settings'}
        <form id="settings-form" method="POST" action="?/updateSettings" use:enhance={() => {
            isSaving = true;
            return async ({ update }) => {
                await update();
                isSaving = false;
            }
        }} class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-6">
                    <div class="space-y-2">
                        <Label for="title">Title</Label>
                        <Input id="title" name="title" value={course.title} required />
                    </div>
                    <div class="space-y-2">
                        <Label for="slug">Slug</Label>
                        <Input id="slug" name="slug" value={course.slug} required />
                    </div>
                    <div class="space-y-2">
                        <Label for="price">Price (in cents)</Label>
                        <Input id="price" name="price" type="number" value={course.price} />
                    </div>

                    <div class="space-y-2">
                        <Label>Thumbnail</Label>
                        <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />
                        <MediaPicker bind:value={thumbnailUrl} label="Thumbnail hochladen" cropRatio="16:9" />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label for="accessType">Access Type</Label>
                            <FormSelect id="accessType" name="accessType" value={course.accessType} onchange={(e: any) => selectedAccessType = e.target.value}>
                                <option value="lifetime">Lifetime</option>
                                <option value="duration">Fixed Duration</option>
                                <option value="subscription">Subscription</option>
                            </FormSelect>
                        </div>
                        <div class="space-y-2">
                            <Label for="accessDuration">Duration / Interval (Days)</Label>
                            <Input id="accessDuration" name="accessDuration" type="number" value={course.accessDuration || 0} placeholder="e.g. 30 or 365" />
                             <p class="text-[10px] text-muted-foreground">For fixed duration or billing cycle.</p>
                        </div>
                    </div>

                    {#if selectedAccessType === 'subscription'}
                    <div class="space-y-2">
                        <Label for="trialDays">Testzeitraum (Tage)</Label>
                        <Input id="trialDays" name="trialDays" type="number" value={course.trialDays || 0} min="0" placeholder="0 = kein Testzeitraum" />
                        <p class="text-[10px] text-muted-foreground">Anzahl kostenloser Tage bevor die erste Zahlung beginnt.</p>
                    </div>
                    {/if}

                    <div class="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="communityEnabled" name="communityEnabled" class="w-4 h-4" checked={course.communityEnabled} />
                        <Label for="communityEnabled">Community aktivieren</Label>
                    </div>

                     <div class="flex items-center gap-2">
                        <input type="checkbox" id="isPublished" name="isPublished" class="w-4 h-4" checked={course.isPublished} />
                        <Label for="isPublished">Publish Course</Label>
                    </div>
                </div>
                <div class="space-y-6">
                    <div class="space-y-2">
                        <Label for="description">Short Description</Label>
                        <Textarea id="description" name="description" value={course.description} rows={4} />
                    </div>
                     <div class="space-y-2">
                        <Label>Full Description</Label>
                        <RichTextEditor bind:value={course.fullDescription} />
                        <input type="hidden" name="fullDescription" value={course.fullDescription} />
                    </div>
                </div>
            </div>
        </form>

    {:else if activeTab === 'curriculum'}
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex justify-end">
                <form method="POST" action="?/createModule" use:enhance>
                    <input type="hidden" name="title" value="New Module" />
                    <input type="hidden" name="order" value={modules.length + 1} />
                    <Button type="submit" variant="secondary" size="sm">
                        <Plus class="w-4 h-4 mr-2" /> Add Module
                    </Button>
                </form>
            </div>

            <section 
                use:dndzone={{items: modules, flipDurationMs: 300, dropTargetStyle: {}}} 
                onconsider={handleDndConsiderModules} 
                onfinalize={handleDndFinalizeModules}
                class="space-y-4"
            >
                {#each modules as module (module.id)}
                    <div class="bg-card border rounded-lg shadow-sm overflow-hidden" animate:flip={{duration: 300}}>
                        <div class="p-4 flex items-center gap-4 bg-muted/30 border-b group">
                            <div class="cursor-move p-1 -m-1 hover:bg-muted rounded transition-colors">
                                <GripVertical class="w-5 h-5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                            </div>
                            <div class="flex-1 font-medium font-serif">
                                {#if module.isEditing}
                                    <form action="?/updateModule" method="POST" use:enhance={() => {
                                        return async ({ update }) => {
                                            await update();
                                            module.isEditing = false;
                                        }
                                    }} class="flex items-center gap-2">
                                        <input type="hidden" name="id" value={module.id} />
                                        <Input name="title" value={module.title} class="h-8 max-w-sm" autofocus />
                                        <Button type="submit" size="sm" variant="secondary">Save</Button>
                                        <Button type="button" size="sm" variant="ghost" onclick={() => module.isEditing = false}>Cancel</Button>
                                    </form>
                                {:else}
                                    {module.title}
                                {/if}
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-muted-foreground">{module.lessons.length} Lessons</span>
                                {#if moduleRatingMap[module.id]?.count > 0}
                                    {@const mr = moduleRatingMap[module.id]}
                                    <span class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full" title="{mr.count} Bewertung{mr.count !== 1 ? 'en' : ''}">
                                        <Star class="w-3 h-3 fill-amber-400 text-amber-400" />
                                        {mr.avg.toFixed(1)}
                                        <span class="text-muted-foreground font-normal">({mr.count})</span>
                                    </span>
                                {/if}
                                {#if !module.isEditing}
                                    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => module.isEditing = true}>
                                        <Edit2 class="w-4 h-4" />
                                    </Button>
                                {/if}
                                    <form action="?/deleteModule" method="POST" use:enhance={({ cancel }) => {
                                        if (!confirm('Delete module?')) cancel();
                                        return async ({ update }) => await update();
                                    }} class="contents">
                                        <input type="hidden" name="id" value={module.id} />
                                        <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:bg-destructive/10">
                                            <Trash2 class="w-4 h-4" />
                                        </Button>
                                    </form>
                                    <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => module.expand = !module.expand}>
                                        {#if module.expand}
                                            <ChevronDown class="w-4 h-4" />
                                        {:else}
                                            <ChevronRight class="w-4 h-4" />
                                        {/if}
                                    </Button>
                                </div>
                            </div>
                        
                        {#if module.expand}
                            <div class="p-4 space-y-2 bg-card/50" transition:slide>
                                {#if module.lessons.length === 0}
                                    <div class="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                                        No lessons yet.
                                    </div>
                                {:else}
                                    <div 
                                        use:dndzone={{items: module.lessons, flipDurationMs: 300, dropTargetStyle: {}}} 
                                        onconsider={(e) => handleDndConsiderLessons(module.id, e)} 
                                        onfinalize={(e) => handleDndFinalizeLessons(module.id, e)}
                                        class="space-y-2"
                                    >
                                        {#each module.lessons as lesson (lesson.id)}
                                            <div class="flex items-center gap-3 p-3 rounded-md border bg-background hover:bg-muted/50 transition-colors" animate:flip={{duration: 300}}>
                                                <div class="cursor-move p-1 -m-1 hover:bg-muted rounded transition-colors group">
                                                    <GripVertical class="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground" />
                                                </div>
                                                {#if lesson.type === 'video'}
                                                    <Video class="w-4 h-4 text-blue-500" />
                                                {:else}
                                                    <FileText class="w-4 h-4 text-orange-500" />
                                                {/if}
                                                
                                                <span class="text-sm font-medium">{lesson.title}</span>

                                                <div class="ml-auto flex gap-2">
                                                    <Button variant="ghost" size="icon" class="h-6 w-6" href="/admin/courses/{course.id}/lessons/{lesson.id}">
                                                        <Edit2 class="w-3 h-3" />
                                                    </Button>
                                                    <form action="?/deleteLesson" method="POST" use:enhance={({ cancel }) => {
                                                        if (!confirm('Delete lesson?')) cancel();
                                                        return async ({ update }) => await update();
                                                    }} class="contents">
                                                        <input type="hidden" name="id" value={lesson.id} />
                                                        <Button type="submit" variant="ghost" size="icon" class="h-6 w-6 text-destructive hover:bg-destructive/10">
                                                            <Trash2 class="w-3 h-3" />
                                                        </Button>
                                                    </form>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                                <div class="pt-2 flex justify-center">
                                     <form method="POST" action="?/createLesson" use:enhance class="flex items-center gap-2 w-full max-w-md">
                                         <input type="hidden" name="moduleId" value={module.id} />
                                         <Input name="title" placeholder="New Lesson Title" class="h-8 text-sm" required />
                                         <FormSelect name="type" class="h-8 text-sm">
                                             <option value="video">Video</option>
                                             <option value="text">Text</option>
                                             <option value="quiz">Quiz</option>
                                         </FormSelect>
                                         <Button type="submit" size="sm" variant="secondary">
                                             <Plus class="w-3 h-3 mr-1" /> Add
                                         </Button>
                                     </form>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </section>
        </div>
    {:else if activeTab === 'community'}
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-medium">Community Channels</h3>
                    <p class="text-sm text-muted-foreground">Manage discussion channels for this course.</p>
                </div>
                <!-- Create Category Form -->
                <form method="POST" action="?/createCategory" use:enhance class="flex items-center gap-2">
                    <Input name="name" placeholder="New Channel Name" class="w-64" required />
                    <Button type="submit" size="sm">
                        <Plus class="w-4 h-4 mr-2" /> Add Channel
                    </Button>
                </form>
            </div>

            <div class="bg-card border rounded-lg shadow-sm divide-y">
                {#if course.communityCategories.length === 0}
                    <div class="p-8 text-center text-muted-foreground">
                        No channels created yet.
                    </div>
                {:else}
                    {#each course.communityCategories as category (category.id)}
                        <div class="p-4 flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <div class="p-2 bg-muted rounded">
                                    <Hash class="w-4 h-4 text-muted-foreground" />
                                </div>
                                <form action="?/updateCategory" method="POST" use:enhance={() => {
                                    return async ({ update }) => {
                                        await update();
                                    }
                                }} class="flex items-center gap-2">
                                    <input type="hidden" name="id" value={category.id} />
                                    <Input name="name" value={category.name} class="h-8 w-64 border-transparent hover:border-input focus:border-input bg-transparent" />
                                </form>
                            </div>
                            
                            <form action="?/deleteCategory" method="POST" use:enhance={({ cancel }) => {
                                if (!confirm('Delete this channel? All posts in it will be lost or orphaned.')) cancel();
                                return async ({ update }) => await update();
                            }}>
                                <input type="hidden" name="id" value={category.id} />
                                <Button type="submit" variant="ghost" size="icon" class="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 class="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {:else if activeTab === 'sell'}
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
             <div class="space-y-4">
                 <div>
                    <h3 class="text-lg font-medium">Sell Course</h3>
                    <p class="text-sm text-muted-foreground">Use these links to sell this course on other platforms.</p>
                 </div>

                 <!-- Direct Link -->
                 <div class="bg-card border rounded-lg p-6 space-y-4">
                    <div class="space-y-2">
                        <Label>Direct Purchase Link</Label>
                        <div class="flex items-center gap-2">
                            <Input readonly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout/${course.slug}`} />
                            <Button variant="outline" size="icon" onclick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/checkout/${course.slug}`);
                                alert('Copied!');
                            }}>
                                <Copy class="w-4 h-4" />
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">Share this link directly with students. It handles both signups and payments.</p>
                    </div>
                 </div>

                 <!-- Embed Code -->
                 <div class="bg-card border rounded-lg p-6 space-y-4">
                    <div class="space-y-2">
                        <Label>Embed Button Code</Label>
                         <div class="relative">
                            <Textarea readonly value={`<a href="${typeof window !== 'undefined' ? window.location.origin : ''}/checkout/${course.slug}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-family: sans-serif;">Buy ${course.title}</a>`} rows={4} class="font-mono text-xs" />
                            <Button variant="outline" size="icon" class="absolute top-2 right-2" onclick={() => {
                                const code = `<a href="${window.location.origin}/checkout/${course.slug}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-family: sans-serif;">Buy ${course.title}</a>`;
                                navigator.clipboard.writeText(code);
                                alert('Code Copied!');
                            }}>
                                <Copy class="w-4 h-4" />
                            </Button>
                         </div>
                         <p class="text-xs text-muted-foreground">Paste this HTML code into any website (Wordpress, Wix, etc.) to show a buy button.</p>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    </div><!-- /main content -->
</div><!-- /flex layout -->
