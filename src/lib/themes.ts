export interface ThemeVars {
    radius: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
}

export interface Theme {
    id: string;
    name: string;
    description: string;
    preview: { bg: string; primary: string; secondary: string; accent: string };
    vars: ThemeVars;
    // For backward compat with color pickers
    colors: { primary: string; secondary: string; accent: string; background: string; foreground: string };
}

export const themes: Theme[] = [
    {
        id: 'modern',
        name: 'Modern',
        description: 'Flat & crisp — keine Glaseffekte, feste Ränder, alles scharf.',
        preview: { bg: '0 0% 100%', primary: '239 84% 67%', secondary: '240 5% 96%', accent: '239 84% 67%' },
        vars: {
            radius: '0.5rem',
            background: '0 0% 100%',
            foreground: '240 10% 4%',
            card: '0 0% 100%',
            cardForeground: '240 10% 4%',
            popover: '0 0% 100%',
            popoverForeground: '240 10% 4%',
            primary: '239 84% 67%',
            primaryForeground: '0 0% 100%',
            secondary: '240 5% 96%',
            secondaryForeground: '240 6% 10%',
            muted: '240 5% 96%',
            mutedForeground: '240 4% 46%',
            accent: '240 5% 96%',
            accentForeground: '240 6% 10%',
            border: '240 6% 90%',
            input: '240 6% 90%',
            ring: '239 84% 67%',
            sidebar: '240 5% 98%',
            sidebarForeground: '240 6% 10%',
            sidebarPrimary: '239 84% 67%',
            sidebarPrimaryForeground: '0 0% 100%',
            sidebarAccent: '240 5% 93%',
            sidebarAccentForeground: '240 6% 10%',
            sidebarBorder: '240 6% 90%',
        },
        colors: { primary: '239 84% 67%', secondary: '240 5% 96%', accent: '239 84% 67%', background: '0 0% 100%', foreground: '240 10% 4%' },
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Zero Dekoration — reine Typografie, Whitespace, kein einziger Schatten.',
        preview: { bg: '0 0% 100%', primary: '0 0% 9%', secondary: '0 0% 96%', accent: '0 0% 9%' },
        vars: {
            radius: '0rem',
            background: '0 0% 100%',
            foreground: '0 0% 4%',
            card: '0 0% 100%',
            cardForeground: '0 0% 4%',
            popover: '0 0% 100%',
            popoverForeground: '0 0% 4%',
            primary: '0 0% 9%',
            primaryForeground: '0 0% 98%',
            secondary: '0 0% 96%',
            secondaryForeground: '0 0% 9%',
            muted: '0 0% 96%',
            mutedForeground: '0 0% 45%',
            accent: '0 0% 96%',
            accentForeground: '0 0% 9%',
            border: '0 0% 89%',
            input: '0 0% 89%',
            ring: '0 0% 9%',
            sidebar: '0 0% 97%',
            sidebarForeground: '0 0% 9%',
            sidebarPrimary: '0 0% 9%',
            sidebarPrimaryForeground: '0 0% 98%',
            sidebarAccent: '0 0% 93%',
            sidebarAccentForeground: '0 0% 9%',
            sidebarBorder: '0 0% 89%',
        },
        colors: { primary: '0 0% 9%', secondary: '0 0% 96%', accent: '0 0% 9%', background: '0 0% 100%', foreground: '0 0% 4%' },
    },
    {
        id: 'dark-pro',
        name: 'Dark Pro',
        description: 'Glasmorphismus — starker Blur, Glow-Effekte, tiefe Schatten.',
        preview: { bg: '222 47% 7%', primary: '158 64% 52%', secondary: '222 47% 15%', accent: '158 64% 52%' },
        vars: {
            radius: '0.5rem',
            background: '222 47% 7%',
            foreground: '210 20% 92%',
            card: '222 47% 10%',
            cardForeground: '210 20% 92%',
            popover: '222 47% 10%',
            popoverForeground: '210 20% 92%',
            primary: '158 64% 52%',
            primaryForeground: '222 47% 7%',
            secondary: '222 47% 15%',
            secondaryForeground: '210 20% 92%',
            muted: '222 47% 13%',
            mutedForeground: '215 16% 55%',
            accent: '222 47% 18%',
            accentForeground: '210 20% 92%',
            border: '222 47% 18%',
            input: '222 47% 16%',
            ring: '158 64% 52%',
            sidebar: '222 47% 6%',
            sidebarForeground: '210 20% 92%',
            sidebarPrimary: '158 64% 52%',
            sidebarPrimaryForeground: '222 47% 7%',
            sidebarAccent: '222 47% 13%',
            sidebarAccentForeground: '210 20% 92%',
            sidebarBorder: '222 47% 15%',
        },
        colors: { primary: '158 64% 52%', secondary: '222 47% 15%', accent: '158 64% 52%', background: '222 47% 7%', foreground: '210 20% 92%' },
    },
    {
        id: 'warm-luxe',
        name: 'Warm Luxe',
        description: 'Editorial — Serifen-Headlines, schwebende Cards, federnde Animationen.',
        preview: { bg: '37 33% 97%', primary: '15 58% 60%', secondary: '38 65% 55%', accent: '38 65% 55%' },
        vars: {
            radius: '0.75rem',
            background: '37 33% 97%',
            foreground: '30 12% 15%',
            card: '37 25% 99%',
            cardForeground: '30 12% 15%',
            popover: '37 25% 99%',
            popoverForeground: '30 12% 15%',
            primary: '15 58% 60%',
            primaryForeground: '0 0% 100%',
            secondary: '38 65% 55%',
            secondaryForeground: '30 12% 15%',
            muted: '36 25% 93%',
            mutedForeground: '30 8% 45%',
            accent: '38 65% 55%',
            accentForeground: '30 12% 15%',
            border: '36 20% 87%',
            input: '36 20% 87%',
            ring: '15 58% 60%',
            sidebar: '36 28% 95%',
            sidebarForeground: '30 12% 15%',
            sidebarPrimary: '15 58% 60%',
            sidebarPrimaryForeground: '0 0% 100%',
            sidebarAccent: '36 20% 90%',
            sidebarAccentForeground: '30 12% 15%',
            sidebarBorder: '36 20% 87%',
        },
        colors: { primary: '15 58% 60%', secondary: '38 65% 55%', accent: '38 65% 55%', background: '37 33% 97%', foreground: '30 12% 15%' },
    },
    {
        id: 'verdant',
        name: 'Verdant',
        description: 'Neo-Brutal — 2px Outlines, Offset-Schatten, alles kantig & grafisch.',
        preview: { bg: '90 15% 97%', primary: '150 55% 28%', secondary: '145 18% 93%', accent: '150 55% 28%' },
        vars: {
            radius: '0.625rem',
            background: '90 15% 97%',
            foreground: '150 25% 10%',
            card: '90 10% 99%',
            cardForeground: '150 25% 10%',
            popover: '90 10% 99%',
            popoverForeground: '150 25% 10%',
            primary: '150 55% 28%',
            primaryForeground: '0 0% 100%',
            secondary: '145 18% 93%',
            secondaryForeground: '150 25% 10%',
            muted: '145 15% 93%',
            mutedForeground: '150 10% 45%',
            accent: '145 18% 93%',
            accentForeground: '150 25% 10%',
            border: '145 12% 88%',
            input: '145 12% 88%',
            ring: '150 55% 28%',
            sidebar: '145 15% 95%',
            sidebarForeground: '150 25% 10%',
            sidebarPrimary: '150 55% 28%',
            sidebarPrimaryForeground: '0 0% 100%',
            sidebarAccent: '145 12% 90%',
            sidebarAccentForeground: '150 25% 10%',
            sidebarBorder: '145 12% 88%',
        },
        colors: { primary: '150 55% 28%', secondary: '145 18% 93%', accent: '150 55% 28%', background: '90 15% 97%', foreground: '150 25% 10%' },
    },
];

export const DEFAULT_THEME = themes[3]; // warm-luxe
