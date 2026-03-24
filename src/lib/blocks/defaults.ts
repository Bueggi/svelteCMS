import type { Block, BlockType } from './types';

export function createBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case 'hero': return { id, type, variant: 'centered', headline: 'Deine Headline hier', subheadline: 'Ein überzeugender Untertitel', ctaText: 'Jetzt anmelden' };
    case 'features': return { id, type, variant: 'grid', title: 'Was du lernen wirst', items: [{ id: crypto.randomUUID(), icon: '✨', title: 'Feature', description: 'Kurze Beschreibung' }] };
    case 'testimonials': return { id, type, variant: 'cards', title: 'Das sagen Teilnehmerinnen', items: [{ id: crypto.randomUUID(), name: 'Maria M.', role: 'Kundin', text: 'Absolut empfehlenswert!', rating: 5 }] };
    case 'faq': return { id, type, variant: 'accordion', title: 'Häufige Fragen', items: [{ id: crypto.randomUUID(), question: 'Wie lange habe ich Zugang?', answer: 'Du erhältst lebenslangen Zugang zu allen Materialien.' }] };
    case 'richtext': return { id, type, variant: 'default', content: '<p>Dein Text hier...</p>' };
    case 'cta': return { id, type, variant: 'centered', headline: 'Bereit für den nächsten Schritt?', subtext: 'Tritt noch heute bei', buttonText: 'Jetzt kaufen', guaranteeText: '30 Tage Geld-zurück-Garantie' };
    case 'instructor': return { id, type, variant: 'horizontal', name: 'Dein Name', bio: 'Kurze Biografie...', credentials: ['Zertifizierung 1', 'Zertifizierung 2'] };
    case 'video': return { id, type, variant: 'default', url: '', title: 'Kurzvideo zur Einführung', description: '' };
    case 'guarantee': return { id, type, variant: 'badge', days: 30, headline: '30-Tage Geld-zurück-Garantie', text: 'Keine Fragen gestellt. Einfach anfragen und du bekommst dein Geld zurück.' };
    case 'bullets': return { id, type, variant: 'checkmarks', title: 'Inklusive im Kurs', items: ['Sofortiger Zugang nach Kauf', 'Alle zukünftigen Updates kostenlos', 'Private Community-Gruppe'] };
    case 'social_proof': return { id, type, variant: 'inline', count: 0, text: 'Teilnehmerinnen vertrauen uns bereits', rating: 4.9, reviewCount: 0 };
    case 'urgency': return { id, type, variant: 'banner', text: 'Nur noch heute zum Einführungspreis', subtext: 'Preis steigt nach diesem Angebot an' };
    case 'image_text': return { id, type, variant: 'image-left', imageUrl: '', imageAlt: '', headline: 'Deine Überschrift', subheadline: 'Ein überzeugender Untertitel', body: '<p>Beschreibe hier, was du sagen möchtest.</p>', ctaText: '', ctaUrl: '' };
    case 'checkout': return { id, type, variant: 'default', headline: '', subtext: '' };
    case 'order_summary': return { id, type, variant: 'default', headline: 'Vielen Dank für deinen Kauf!', subtext: 'Du hast sofortigen Zugang zu deinem Kurs.', ctaText: 'Jetzt zum Kurs' };
    default: throw new Error(`Unknown block type: ${type}`);
  }
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: 'Hero',
  features: 'Features',
  testimonials: 'Bewertungen',
  faq: 'FAQ',
  richtext: 'Text',
  cta: 'Call to Action',
  instructor: 'Trainer-Profil',
  video: 'Video',
  guarantee: 'Garantie',
  bullets: 'Enthaltene Leistungen',
  social_proof: 'Social Proof',
  urgency: 'Dringlichkeit',
  image_text: 'Bild + Text',
  checkout: 'Checkout',
  order_summary: 'Bestellübersicht',
};

export const BLOCK_VARIANTS: Record<BlockType, Array<{ id: string; label: string }>> = {
  hero: [
    { id: 'centered', label: 'Zentriert' },
    { id: 'left', label: 'Links' },
    { id: 'split', label: 'Geteilt' },
    { id: 'fullscreen', label: 'Fullscreen' },
    { id: 'minimal', label: 'Minimal' },
  ],
  features: [
    { id: 'grid', label: 'Grid' },
    { id: 'list', label: 'Liste' },
    { id: 'checkmarks', label: 'Häkchen' },
    { id: 'numbered', label: 'Nummeriert' },
  ],
  testimonials: [
    { id: 'cards', label: 'Karten' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'featured', label: 'Featured' },
  ],
  faq: [
    { id: 'accordion', label: 'Akkordeon' },
    { id: 'two-col', label: '2 Spalten' },
    { id: 'cards', label: 'Karten' },
  ],
  richtext: [
    { id: 'default', label: 'Standard' },
    { id: 'centered', label: 'Zentriert' },
    { id: 'wide', label: 'Breit' },
  ],
  cta: [
    { id: 'centered', label: 'Zentriert' },
    { id: 'dark', label: 'Dunkel' },
    { id: 'bordered', label: 'Umrandet' },
    { id: 'minimal', label: 'Minimal' },
  ],
  instructor: [
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'centered', label: 'Zentriert' },
    { id: 'card', label: 'Karte' },
  ],
  video: [
    { id: 'default', label: 'Standard' },
    { id: 'fullwidth', label: 'Breit' },
    { id: 'side-by-side', label: 'Mit Text' },
  ],
  guarantee: [
    { id: 'badge', label: 'Badge' },
    { id: 'banner', label: 'Banner' },
    { id: 'centered', label: 'Zentriert' },
  ],
  bullets: [
    { id: 'checkmarks', label: 'Häkchen' },
    { id: 'numbered', label: 'Nummeriert' },
    { id: 'icons', label: 'Icons' },
    { id: 'two-col', label: '2 Spalten' },
  ],
  social_proof: [
    { id: 'inline', label: 'Inline' },
    { id: 'centered', label: 'Zentriert' },
    { id: 'cards', label: 'Karten' },
  ],
  urgency: [
    { id: 'banner', label: 'Banner' },
    { id: 'badge', label: 'Badge' },
    { id: 'card', label: 'Karte' },
  ],
  image_text: [
    { id: 'image-left', label: 'Bild links' },
    { id: 'image-right', label: 'Bild rechts' },
    { id: 'image-large-left', label: 'Groß links' },
    { id: 'image-large-right', label: 'Groß rechts' },
    { id: 'image-cover-left', label: 'Cover links' },
    { id: 'image-cover-right', label: 'Cover rechts' },
    { id: 'image-top', label: 'Bild oben' },
    { id: 'image-sticky', label: 'Sticky' },
  ],
  checkout: [
    { id: 'default', label: 'Standard' },
    { id: 'split', label: 'Geteilt' },
    { id: 'minimal', label: 'Minimal' },
  ],
  order_summary: [
    { id: 'default', label: 'Standard' },
    { id: 'compact', label: 'Kompakt' },
  ],
};
