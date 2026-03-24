/**
 * Returns src, srcset, sizes and a CSS style string for progressive-loading images.
 *
 * Works with both local uploads (/uploads/…) and external URLs.
 * For local uploads, derives the -400 / -800 variants from the naming convention
 * produced by the upload API.
 */
export interface ImgAttrs {
	src: string;
	srcset: string;
	sizes: string;
	/** Inline style string: blurred placeholder as CSS background-image */
	style: string;
}

/**
 * Build imgAttrs from explicit DB variant URLs (from media_files).
 * Only call this when you have the url400 / url800 from the DB —
 * i.e. the file was uploaded with the new API that generates variants.
 */
export function imgAttrsFromVariants(
	url: string | null | undefined,
	url400: string | null | undefined,
	url800: string | null | undefined,
	blurDataUrl?: string | null,
	sizesOverride?: string
): ImgAttrs {
	const src = url ?? '';
	let srcset = '';
	if (url400 && url800) {
		srcset = `${url400} 400w, ${url800} 800w, ${src} 1920w`;
	}
	const sizes = sizesOverride ?? '(max-width: 640px) 400px, (max-width: 1280px) 800px, 1920px';
	const style = blurDataUrl
		? `background-image:url("${blurDataUrl}");background-size:cover;background-position:center`
		: '';
	return { src, srcset, sizes, style };
}

export function imgAttrs(
	url: string | null | undefined,
	blurDataUrl?: string | null,
	sizesOverride?: string
): ImgAttrs {
	const src = url ?? '';

	// No srcset here — we don't know whether the variants exist for this URL.
	// Use imgAttrsFromVariants() when you have explicit url400/url800 from the DB.
	const srcset = '';

	const sizes =
		sizesOverride ?? '(max-width: 640px) 400px, (max-width: 1280px) 800px, 1920px';

	// Blur-up style: show LQIP as background while the real image loads
	const style = blurDataUrl
		? `background-image:url("${blurDataUrl}");background-size:cover;background-position:center`
		: '';

	return { src, srcset, sizes, style };
}
