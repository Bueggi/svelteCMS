<script lang="ts">
	import GradientHeading from "$lib/components/ui/gradient-heading/GradientHeading.svelte";
	import GlassCard from "$lib/components/ui/glass-card/GlassCard.svelte";
	import ShinyButton from "$lib/components/ui/shiny-button/ShinyButton.svelte";
	import FadeIn from "$lib/components/ui/motion/FadeIn.svelte";
	import SlideIn from "$lib/components/ui/motion/SlideIn.svelte";
	import { Button } from "$lib/components/ui/button";
</script>

<div class="min-h-screen w-full bg-background p-8 md:p-12 space-y-12">
	
	<FadeIn y={-20} duration={800}>
		<div class="text-center space-y-4">
			<GradientHeading level="h1" variant="sunset" size="xxl">
				Modern UI Components
			</GradientHeading>
			<p class="text-muted-foreground text-lg max-w-2xl mx-auto">
				A collection of beautiful, reusable components built with Svelte 5 and Tailwind CSS.
			</p>
		</div>
	</FadeIn>

	<section class="space-y-8">
		<SlideIn delay={200}>
			<GradientHeading level="h2" variant="brand" size="xl">Gradient Headings</GradientHeading>
		</SlideIn>
		<div class="grid gap-8 p-6 rounded-xl border bg-card/30">
			<GradientHeading level="h3" variant="default">Default Variant</GradientHeading>
			<GradientHeading level="h3" variant="sunset">Sunset Variant</GradientHeading>
			<GradientHeading level="h3" variant="ocean">Ocean Variant</GradientHeading>
			<GradientHeading level="h3" variant="brand">Brand Variant</GradientHeading>
			<GradientHeading level="h3" variant="gold">Gold Variant</GradientHeading>
			<GradientHeading level="h3" variant="feature">Feature Variant</GradientHeading>
		</div>
	</section>

	<section class="space-y-8">
		<SlideIn delay={400} direction="right">
			<GradientHeading level="h2" variant="ocean" size="xl">Glass Cards</GradientHeading>
		</SlideIn>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<GlassCard variant="default" class="p-6 space-y-4">
				<h3 class="font-bold text-xl">Default Glass</h3>
				<p class="text-muted-foreground">Standard glassmorphism with a subtle border and blur.</p>
				<Button variant="outline">Action</Button>
			</GlassCard>

			<GlassCard variant="neo" class="p-6 space-y-4">
				<h3 class="font-bold text-xl">Neo Glass</h3>
				<p class="text-muted-foreground">Cleaner, lighter look with white/black transparency.</p>
				<Button>Action</Button>
			</GlassCard>

			<GlassCard variant="ghost" class="p-6 space-y-4">
				<h3 class="font-bold text-xl">Ghost Glass</h3>
				<p class="text-muted-foreground">Minimalist, only shows background on hover.</p>
				<Button variant="secondary">Action</Button>
			</GlassCard>
		</div>
	</section>

	<section class="space-y-8">
		<FadeIn delay={600} y={20}>
			<GradientHeading level="h2" variant="gold" size="xl">Shiny Buttons</GradientHeading>
		</FadeIn>
		<div class="flex flex-wrap gap-4 p-6 rounded-xl border bg-card/30 items-center">
			<ShinyButton>Get Started</ShinyButton>
			<ShinyButton variant="outline">Learn More</ShinyButton>
			<ShinyButton variant="ghost">Contact Us</ShinyButton>
		</div>
	</section>

    <section class="space-y-8 pb-20">
		<FadeIn delay={800} y={20}>
			<GradientHeading level="h2" variant="feature" size="xl">Combined Example</GradientHeading>
		</FadeIn>
        <div class="relative w-full max-w-4xl mx-auto">
            <div class="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full -z-10"></div>
            <GlassCard variant="neo" class="p-12 text-center space-y-6 border-white/50 dark:border-white/20">
                <GradientHeading level="h2" size="xl" variant="sunset">Ready to Build?</GradientHeading>
                <p class="text-lg text-muted-foreground max-w-lg mx-auto">
                    Start creating stunning user interfaces with these reusable components today.
                </p>
                <div class="flex justify-center gap-4 pt-4">
                    <ShinyButton class="h-12 px-8 text-lg">Join Community</ShinyButton>
                    <Button variant="outline" size="lg" class="h-12">Documentation</Button>
                </div>
            </GlassCard>
        </div>
    </section>

</div>
