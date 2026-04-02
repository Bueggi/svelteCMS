export interface BlockStyle {
  bgType?: 'none' | 'color' | 'gradient' | 'image';
  bgColor?: string;
  bgGradientFrom?: string;
  bgGradientTo?: string;
  bgGradientDir?: 'to-right' | 'to-bottom' | 'to-bottom-right' | 'to-bottom-left';
  bgImage?: string;
  bgImageOverlay?: number; // 0–1 dark overlay opacity
  textColor?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  headlineColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  headlineFontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  bodyFontWeight?: 'light' | 'normal' | 'medium';
  headlineFont?: string;
  bodyFont?: string;
}

export interface HeroBlock {
  id: string; type: 'hero';
  variant?: 'centered' | 'left' | 'split' | 'fullscreen' | 'minimal';
  blockStyle?: BlockStyle;
  headline: string; subheadline?: string; imageUrl?: string; ctaText?: string;
  layout?: 'centered' | 'left' | 'split'; // deprecated – use variant
}

export interface FeaturesItem { id: string; icon?: string; title: string; description?: string; }
export interface FeaturesBlock {
  id: string; type: 'features';
  variant?: 'grid' | 'list' | 'checkmarks' | 'numbered';
  blockStyle?: BlockStyle;
  title?: string; items: FeaturesItem[];
  layout?: 'grid' | 'list'; // deprecated – use variant
}

export interface TestimonialItem { id: string; name: string; role?: string; avatarUrl?: string; text: string; rating?: number; }
export interface TestimonialsBlock {
  id: string; type: 'testimonials';
  variant?: 'cards' | 'minimal' | 'featured';
  blockStyle?: BlockStyle;
  title?: string; items: TestimonialItem[];
}

export interface FaqItem { id: string; question: string; answer: string; }
export interface FaqBlock {
  id: string; type: 'faq';
  variant?: 'accordion' | 'two-col' | 'cards';
  blockStyle?: BlockStyle;
  title?: string; items: FaqItem[];
}

export interface RichTextBlock {
  id: string; type: 'richtext';
  variant?: 'default' | 'centered' | 'wide';
  blockStyle?: BlockStyle;
  content: string;
}

export interface CtaBlock {
  id: string; type: 'cta';
  variant?: 'centered' | 'dark' | 'bordered' | 'minimal';
  blockStyle?: BlockStyle;
  headline?: string; subtext?: string; buttonText?: string; guaranteeText?: string;
}

export interface InstructorBlock {
  id: string; type: 'instructor';
  variant?: 'horizontal' | 'centered' | 'card';
  blockStyle?: BlockStyle;
  name: string; bio: string; imageUrl?: string; credentials?: string[];
}

export interface VideoBlock {
  id: string; type: 'video';
  variant?: 'default' | 'fullwidth' | 'side-by-side';
  blockStyle?: BlockStyle;
  url: string; title?: string; description?: string;
}

export interface GuaranteeBlock {
  id: string; type: 'guarantee';
  variant?: 'badge' | 'banner' | 'centered';
  blockStyle?: BlockStyle;
  days: number; headline?: string; text?: string;
}

export interface BulletsBlock {
  id: string; type: 'bullets';
  variant?: 'checkmarks' | 'numbered' | 'icons' | 'two-col';
  blockStyle?: BlockStyle;
  title?: string; items: string[];
}

export interface SocialProofBlock {
  id: string; type: 'social_proof';
  variant?: 'inline' | 'centered' | 'cards';
  blockStyle?: BlockStyle;
  count?: number; text?: string; rating?: number; reviewCount?: number;
}

export interface UrgencyBlock {
  id: string; type: 'urgency';
  variant?: 'banner' | 'badge' | 'card';
  blockStyle?: BlockStyle;
  text: string; subtext?: string;
  style?: 'banner' | 'badge'; // deprecated – use variant
}

export interface CustomHtmlBlock {
  id: string; type: 'custom_html';
  html: string;
}

export interface CustomCssBlock {
  id: string; type: 'custom_css';
  css: string;
}

export interface CheckoutBlock {
  id: string; type: 'checkout';
  variant?: 'default' | 'split' | 'minimal';
  blockStyle?: BlockStyle;
  headline?: string;
  subtext?: string;
}

export interface OrderSummaryBlock {
  id: string; type: 'order_summary';
  variant?: 'default' | 'compact';
  blockStyle?: BlockStyle;
  headline?: string;
  subtext?: string;
  ctaText?: string;
}

export interface ImageTextBlock {
  id: string; type: 'image_text';
  variant?: 'image-left' | 'image-right' | 'image-large-left' | 'image-large-right' | 'image-cover-left' | 'image-cover-right' | 'image-top' | 'image-sticky';
  blockStyle?: BlockStyle;
  imageUrl?: string;
  imageAlt?: string;
  headline?: string;
  subheadline?: string;
  body?: string; // HTML
  ctaText?: string;
  ctaUrl?: string; // custom URL; falls back to /checkout/{courseSlug}
}

export type Block = HeroBlock | FeaturesBlock | TestimonialsBlock | FaqBlock | RichTextBlock | CtaBlock | InstructorBlock | VideoBlock | GuaranteeBlock | BulletsBlock | SocialProofBlock | UrgencyBlock | ImageTextBlock | CheckoutBlock | OrderSummaryBlock | CustomHtmlBlock | CustomCssBlock;
export type BlockType = Block['type'];

export const ALL_BLOCK_TYPES: BlockType[] = ['hero', 'features', 'testimonials', 'faq', 'richtext', 'cta', 'instructor', 'video', 'guarantee', 'bullets', 'social_proof', 'urgency', 'image_text', 'checkout', 'order_summary', 'custom_html', 'custom_css'];

// Kept for backwards compatibility
export const LANDING_BLOCK_TYPES = ALL_BLOCK_TYPES;
export const CHECKOUT_BLOCK_TYPES = ALL_BLOCK_TYPES;
