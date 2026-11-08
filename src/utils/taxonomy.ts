import type { TaxonomyTerm } from "emdash";

/**
 * 階層タクソノミー（category）は getTaxonomyTerms がツリーで返すため、
 * 子孫まで含めて slug で探す。フラットなタクソノミー（tag）にもそのまま使える。
 */
export function findTermBySlug(terms: TaxonomyTerm[], slug: string): TaxonomyTerm | null {
	for (const term of terms) {
		if (term.slug === slug) return term;
		const child = findTermBySlug(term.children ?? [], slug);
		if (child) return child;
	}
	return null;
}
