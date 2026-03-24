<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import {
        Chart,
        LineElement,
        PointElement,
        LineController,
        CategoryScale,
        LinearScale,
        Filler,
        Tooltip,
        type ChartConfiguration,
    } from 'chart.js';

    Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip);

    interface DataPoint {
        month: string;   // 'YYYY-MM'
        revenue: number; // cents
    }

    let { data }: { data: DataPoint[] } = $props();

    let canvas: HTMLCanvasElement;
    let chart: Chart | null = null;

    function fmtRevenue(cents: number) {
        if (cents === 0) return '€ 0';
        return (cents / 100).toLocaleString('de-DE', {
            style: 'currency', currency: 'EUR',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        });
    }

    function fmtMonth(yyyyMM: string) {
        const [y, m] = yyyyMM.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    }

    // Read the CSS variable colour so the chart matches the theme
    function getCssVar(name: string, fallback: string) {
        if (typeof window === 'undefined') return fallback;
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        // CSS vars are HSL channel values like "352 80% 60%" — wrap them
        return raw ? `hsl(${raw})` : fallback;
    }

    function buildChart() {
        if (!canvas) return;
        if (chart) { chart.destroy(); chart = null; }

        const primary    = getCssVar('--primary', '#e11d48');
        const mutedFg    = getCssVar('--muted-foreground', '#71717a');
        const border     = getCssVar('--border', '#e4e4e7');

        const labels  = data.map(d => fmtMonth(d.month));
        const values  = data.map(d => d.revenue / 100);

        const cfg: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values,
                    fill: true,
                    tension: 0.4,
                    borderColor: primary,
                    borderWidth: 2.5,
                    pointBackgroundColor: primary,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    backgroundColor: (ctx) => {
                        const { ctx: c, chartArea } = ctx.chart;
                        if (!chartArea) return 'transparent';
                        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        // Extract hsl channels from CSS var (format: "352 80% 60%")
                        const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
                        gradient.addColorStop(0, `hsl(${raw} / 0.18)`);
                        gradient.addColorStop(1, `hsl(${raw} / 0.01)`);
                        return gradient;
                    },
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 3,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: getCssVar('--card', 'hsl(0 0% 100%)'),
                        borderColor: border,
                        borderWidth: 1,
                        titleColor: mutedFg,
                        bodyColor: getCssVar('--foreground', 'hsl(0 0% 4%)'),
                        bodyFont: { weight: 'bold', size: 13 },
                        titleFont: { size: 11 },
                        padding: 10,
                        callbacks: {
                            label: (ctx) => fmtRevenue(ctx.parsed.y * 100),
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: mutedFg,
                            font: { size: 11 },
                        },
                    },
                    y: {
                        grid: {
                            color: border,
                            // @ts-ignore
                            borderDash: [4, 4],
                        },
                        border: { display: false, dash: [4, 4] },
                        ticks: {
                            color: mutedFg,
                            font: { size: 11 },
                            maxTicksLimit: 5,
                            callback: (v) => fmtRevenue(Number(v) * 100),
                        },
                    },
                },
            },
        };

        chart = new Chart(canvas, cfg);
    }

    let mounted = false;
    onMount(() => { mounted = true; buildChart(); });
    onDestroy(() => chart?.destroy());

    // Rebuild when data changes (skip the initial mount, already handled above)
    $effect(() => {
        data; // track
        if (mounted) buildChart();
    });
</script>

<div class="w-full">
    <canvas bind:this={canvas}></canvas>
</div>
