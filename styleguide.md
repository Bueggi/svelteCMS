 Dieses Dokument definiert alle visuellen und funktionalen Design-Regeln für die LUMIÈRE Skincare-Marke. Es dient als verbindliche Referenz für LLMs und Entwickler, um einen konsistenten, luxuriösen Look zu gewährleisten.
---
## 1. Markenidentität
### 1.1 Markenwerte
- **Luxus**: Hochwertig, exklusiv, premium
- **Natürlichkeit**: Reine Inhaltsstoffe, wissenschaftlich fundiert
- **Eleganz**: Zeitlos, raffiniert, nicht überladen
- **Vertrauen**: Transparent, wirksam, ergebnisorientiert
### 1.2 Tonalität & Sprache
- **Sprache**: Deutsch (formell aber warmherzig, respektvolles "Du")
- **Stil**: Poetisch-wissenschaftlich, nie marktschreierisch
- **Versprechen**: Konkret und messbar (z.B. "28 Tage Transformation", "98% zufriedene Kunden")
- **Vermeiden**: Übertreibungen, aggressive Sales-Sprache, Clickbait

---
## 2. Farbpalette
### 2.1 Primärfarben (HSL-Format)
| Name | HSL Light Mode | HSL Dark Mode | Verwendung |
|------|----------------|---------------|------------|
| **Rose-Gold** | `15 60% 65%` | `15 55% 60%` | CTAs, Akzente, Highlights |
| **Gold** | `38 70% 55%` | `38 60% 50%` | Premium-Elemente, Badges |
| **Gold-Light** | `42 60% 75%` | `42 50% 40%` | Gradienten-Endpunkt |
### 2.2 Neutrale Farben
| Name | HSL Light Mode | HSL Dark Mode | Verwendung |
|------|----------------|---------------|------------|
| **Background** | `40 33% 97%` | `30 15% 8%` | Seitenhintergrund |
| **Foreground** | `30 10% 15%` | `40 30% 95%` | Text |
| **Card** | `40 40% 98%` | `30 15% 10%` | Karten-Hintergrund |
| **Muted** | `40 20% 94%` | `30 15% 18%` | Deaktivierte Elemente |
| **Muted-Foreground** | `30 10% 45%` | `35 15% 60%` | Sekundärer Text |
| **Border** | `35 25% 88%` | `30 15% 20%` | Rahmen, Trennlinien |
### 2.3 Akzentfarben
| Name | HSL Light Mode | Verwendung |
|------|----------------|------------|
| **Cream** | `40 40% 96%` | Sanfte Hintergründe |
| **Rose** | `350 40% 85%` | Dekorative Blurs |
| **Champagne** | `35 35% 90%` | Gradient-Hintergründe |
| **Blush** | `10 50% 92%` | Warme Akzente |
| **Sage** | `140 20% 80%` | Natur-Akzente (sparsam) |
### 2.4 Gradienten
```css
/* Hero-Gradient (Hintergrund) */
background: linear-gradient(135deg, hsl(40 40% 96%), hsl(35 35% 90%));
/* Gold-Gradient (CTAs) */
background: linear-gradient(135deg, hsl(38 70% 55%), hsl(42 60% 75%));
/* Rose-Gradient (Akzente) */
background: linear-gradient(135deg, hsl(15 60% 65%), hsl(350 40% 85%));
/* Cream-Gradient (Sektionen) */
background: linear-gradient(180deg, hsl(40 40% 98%), hsl(40 33% 94%));
```
### 2.5 Farbregeln
- **NIEMALS** Hardcoded Colors in Komponenten (`text-white`, `bg-black`)
- **IMMER** semantische Tokens verwenden (`text-foreground`, `bg-background`)
- **Gradienten** nur für Hero-Bereiche und primäre CTAs
- **Blur-Effekte** in Rose/Gold für dekorative Kreise (opacity: 20-30%)
---
## 3. Typografie
### 3.1 Schriftfamilien
| Kategorie | Schrift | Fallback | Verwendung |
|-----------|---------|----------|------------|
| **Serif** | Cormorant Garamond | Georgia, serif | Headlines (H1-H6), Hero-Text |
| **Sans** | Inter | system-ui, sans-serif | Body, Buttons, Labels, Navigation |
### 3.2 Schriftgrößen & Gewichte
#### Headlines (font-serif)
```
H1: text-5xl md:text-6xl lg:text-7xl | font-medium (500)
H2: text-4xl md:text-5xl lg:text-6xl | font-medium (500)
H3: text-2xl md:text-3xl | font-semibold (600)
H4: text-xl md:text-2xl | font-semibold (600)
```
#### Body (font-sans)
```
Large: text-lg md:text-xl | font-normal (400)
Base: text-base | font-normal (400)
Small: text-sm | font-normal (400)
XSmall: text-xs | font-medium (500)
```
#### Spezial
```
Labels: text-sm tracking-widest uppercase | font-medium
Stats: text-3xl font-serif font-semibold
Prices: text-5xl md:text-6xl font-serif font-semibold
```
### 3.3 Typografie-Regeln
- Headlines: **Immer** `font-serif` (Cormorant Garamond)
- Body-Text: **Immer** `font-sans` (Inter)
- Uppercase nur für Labels/Tags mit `tracking-widest`
- `leading-tight` für Headlines, `leading-relaxed` für Body
- Maximale Zeilenbreite: `max-w-lg` bis `max-w-2xl`
---
## 4. Abstände & Layout
### 4.1 Spacing-System
| Token | Wert | Verwendung |
|-------|------|------------|
| `gap-2` | 0.5rem | Inline-Elemente |
| `gap-4` | 1rem | Button-Gruppen |
| `gap-6` | 1.5rem | Card-Inhalte |
| `gap-8` | 2rem | Abschnitte innerhalb von Sektionen |
| `gap-12` | 3rem | Grid-Spalten |
| `gap-20` | 5rem | Große Abstände zwischen Elementen |
### 4.2 Container
```css
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem; /* px-6 */
}
```
### 4.3 Sektions-Padding
```
Standard: py-20 md:py-24 lg:py-32
Hero: min-h-screen pt-20 (für Header)
CTA: py-24
Footer: py-16
```
### 4.4 Grid-Layouts
```
2-Spalten: grid lg:grid-cols-2 gap-12 lg:gap-20
3-Spalten: grid md:grid-cols-2 lg:grid-cols-3 gap-8
4-Spalten: grid grid-cols-2 md:grid-cols-4 gap-6
```
---
## 5. Schatten & Effekte
### 5.1 Schatten-Tokens
```css
/* Weicher Schatten (Standard-Karten) */
--shadow-soft: 0 4px 20px -2px hsl(30 20% 50% / 0.12);
/* Glow-Schatten (Hover-Effekte) */
--shadow-glow: 0 8px 40px -8px hsl(15 60% 65% / 0.25);
/* Luxury-Schatten (Premium-Elemente) */
--shadow-luxury: 0 20px 60px -15px hsl(30 30% 30% / 0.15);
```
### 5.2 Tailwind-Klassen
```
shadow-sm → Subtile Erhöhung
shadow-md → Standard-Buttons
shadow-lg → Hover-States
shadow-luxury → Hero-Produkte, Pricing-Cards
shadow-glow → Primäre CTAs
```
### 5.3 Blur-Effekte
```css
/* Dekorative Hintergrund-Kreise */
.decorative-blur {
  @apply absolute rounded-full blur-3xl;
  /* Größen: w-40 h-40 bis w-96 h-96 */
  /* Opacity: 20-30% */
}
/* Glass-Effekt */
.glass-card {
  @apply backdrop-blur-xl bg-card/80 border border-border/50;
}
```
---
## 6. Border Radius
| Token | Wert | Verwendung |
|-------|------|------------|
| `rounded-md` | 0.375rem | Inputs, kleine Buttons |
| `rounded-lg` | 0.75rem | Standard-Karten, Buttons |
| `rounded-xl` | 1rem | Feature-Cards |
| `rounded-2xl` | 1.5rem | Hero-Bilder, große Karten |
| `rounded-3xl` | 1.875rem | Pricing-Cards, Modals |
| `rounded-full` | 50% | Avatare, Badges, Blur-Kreise |
---
## 7. Animationen
### 7.1 Framer Motion Patterns
#### Fade-In beim Scrollen
```tsx
<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
  viewport={{ once: true }}
>
```
#### Staggered Children
```tsx
// Container
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true }}
  variants={{
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } }
  }}
>
// Child
<motion.div
  variants={{
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }}
>
```
#### Float-Animation (Produkte)
```tsx
<motion.div
  animate={{ y: [0, -15, 0] }}
  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
>
```
#### Scale-In
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  whileInView={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.5 }}
>
```
### 7.2 CSS Keyframe Animationen
```css
/* Fade-In */
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
/* Shimmer (Loading) */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
/* Float */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```
### 7.3 Transition-Regeln
- **Dauer**: 0.2s (Micro), 0.3s (Standard), 0.5-0.6s (Entrance)
- **Easing**: `ease-out` für Einblendungen, `ease-in-out` für Loops
- **Delay**: 0.1-0.2s Stagger zwischen Elementen
- `viewport={{ once: true }}` für Scroll-Animationen
---
## 8. Komponenten
### 8.1 Button-Varianten
| Variante | Verwendung | Styling |
|----------|------------|---------|
| `hero` | Primärer CTA | Gold-Gradient, shadow-glow, scale-hover |
| `heroOutline` | Sekundärer CTA | Border rose-gold, transparent bg |
| `luxury` | Premium-Aktionen | Foreground bg, luxury shadow |
| `gold` | Akzent-Buttons | Gold-Gradient, shadow-md |
| `default` | Standard | Primary color, shadow-md |
| `outline` | Tertiär | Border, transparent |
| `ghost` | Navigation | Nur Hover-Effekt |
### 8.2 Button-Größen
```
sm: h-9 px-3 rounded-md
default: h-10 px-4 rounded-lg
lg: h-12 px-8 text-base rounded-lg
xl: h-14 px-10 text-lg rounded-xl
```
### 8.3 Card-Patterns
```tsx
// Standard Feature Card
<div className="p-8 rounded-2xl bg-card border border-border/50 
                hover:shadow-lg transition-all duration-300">
// Glass Card
<div className="backdrop-blur-xl bg-card/80 border border-border/50 
                rounded-3xl p-8 shadow-luxury">
// Testimonial Card
<div className="p-8 rounded-2xl bg-gradient-to-br from-card to-cream 
                border border-border/50">
```
### 8.4 Icon-Verwendung
- **Library**: Lucide React
- **Größen**: `w-5 h-5` (Standard), `w-6 h-6` (Feature), `w-8 h-8` (Hero-Icons)
- **Farben**: `text-rose-gold`, `text-gold`, `text-muted-foreground`
- **Containers**: Icon in `rounded-full bg-gradient-gold p-3` für Feature-Icons
---
## 9. Bilder & Medien
### 9.1 Bild-Styling
```tsx
// Hero-Produkt
<img className="w-full max-w-lg mx-auto rounded-2xl shadow-luxury" />
// Feature-Bild
<img className="rounded-2xl shadow-lg object-cover" />
// Testimonial-Avatar
<img className="w-12 h-12 rounded-full object-cover border-2 border-rose-gold/30" />
```
### 9.2 Bild-Anforderungen
- **Format**: WebP bevorzugt, JPG als Fallback
- **Hero-Bilder**: 800-1200px Breite
- **Produkt-Bilder**: Weißer/cremefarbener Hintergrund
- **Portraits**: Natürliches Licht, professionelle Qualität
### 9.3 Dekorative Elemente
```tsx
// Blur-Kreis (hinter Produkten)
<div className="absolute -top-10 -right-10 w-40 h-40 
                bg-rose/30 rounded-full blur-3xl" />
// Gold-Akzent
<div className="absolute -bottom-10 -left-10 w-60 h-60 
                bg-gold/20 rounded-full blur-3xl" />
```
---
## 10. Responsive Design
### 10.1 Breakpoints
```
sm: 640px   → Mobile Landscape
md: 768px   → Tablet
lg: 1024px  → Desktop
xl: 1280px  → Large Desktop
2xl: 1400px → Container Max-Width
```
### 10.2 Mobile-First Patterns
```tsx
// Text-Größen
className="text-4xl md:text-5xl lg:text-6xl"
// Layouts
className="grid md:grid-cols-2 lg:grid-cols-3"
// Abstände
className="py-16 md:py-20 lg:py-24"
// Button-Gruppen
className="flex flex-col sm:flex-row gap-4"
```
### 10.3 Mobile-Anpassungen
- Navigation: Hamburger-Menu ab `lg:`
- Hero: Single-Column unter `lg:`
- Stats: Horizontal Scroll oder Stack unter `md:`
- Footer: 2-Spalten unter `md:`
---
## 11. Accessibility
### 11.1 Kontrast-Anforderungen
- Text auf Background: Mindestens 4.5:1
- Große Headlines: Mindestens 3:1
- Interaktive Elemente: Sichtbarer Focus-Ring
### 11.2 Focus-States
```css
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```
### 11.3 Semantisches HTML
```tsx
<header>  → Navigation
<main>    → Hauptinhalt
<section> → Thematische Abschnitte
<article> → Testimonials
<footer>  → Footer
<nav>     → Navigation-Listen
```
---
## 12. Code-Struktur

```
### 12.2 Naming Conventions
- **Komponenten**: PascalCase (`HeroSection.tsx`)
- **Dateien**: kebab-case oder PascalCase
- **CSS-Klassen**: Tailwind-Utilities
- **Variablen**: camelCase
- **Konstanten**: SCREAMING_SNAKE_CASE
### 12.3 Import-Reihenfolge
```tsx
// 1. React & Frameworks
import { motion } from "framer-motion";
// 2. UI Components
import { Button } from "@/components/ui/button";
// 3. Icons
import { Check, Star } from "lucide-react";
// 4. Assets
import heroImage from "@/assets/hero-product.jpg";
// 5. Utilities
import { cn } from "@/lib/utils";
```
---
## 13. Checkliste für neue Komponenten
- [ ] Verwendet semantische Farb-Tokens
- [ ] Responsive von Mobile aufwärts
- [ ] Framer Motion für Einblendungen
- [ ] Konsistente Abstände (Gap/Padding-System)
- [ ] Korrekte Typografie (Serif für Headlines)
- [ ] Hover/Focus-States definiert
- [ ] Accessibility geprüft
- [ ] Dark Mode kompatibel
---
## 14. Prompt-Template für LLMs
```
Anforderungen:
- Verwende die Farbpalette aus dem Style Guide (Rose-Gold, Gold, Cream)
- Headlines in Cormorant Garamond (font-serif), Body in Inter (font-sans)
- Animationen mit Framer Motion (fade-in, stagger)
- Responsive Design (Mobile-First)
- Semantische Tailwind-Tokens (keine hardcoded Farben)
- Luxuriöser, eleganter Stil ohne übertriebene Effekte
Verfügbare Button-Varianten: hero, heroOutline, luxury, gold
Verfügbare Gradient-Klassen: bg-gradient-hero, bg-gradient-gold, text-gradient-gold
Verfügbare Schatten: shadow-luxury, shadow-glow
```
---