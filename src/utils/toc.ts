/**
 * 記事・固定ページの目次。
 *
 * Portable Text のトップレベルの見出しブロック（h2〜h4）から目次を作り、
 * 本文の見出しに付ける id（アンカー）も同じ関数で決める。
 * 本文は emdash の PortableText が描画するので、見出しの描画（AnchoredBlock.astro）には
 * リクエストごとの WeakMap で「ブロックの _key → id」を渡す。
 */

export interface TocHeading {
	/** Portable Text ブロックの _key */
	key: string;
	/** 本文の見出しに付ける id（URL の # 以降） */
	id: string;
	text: string;
	/** 見出しのレベル（2 = h2） */
	level: number;
	/** 目次での字下げ。いちばん上のレベルの見出しが 0 */
	depth: number;
}

const TOC_LEVELS: Record<string, number> = { h2: 2, h3: 3, h4: 4 };

interface SpanLike {
	_type?: unknown;
	text?: unknown;
}

interface BlockLike {
	_type?: unknown;
	_key?: unknown;
	style?: unknown;
	children?: unknown;
}

function blockText(block: BlockLike): string {
	if (!Array.isArray(block.children)) return "";
	return (block.children as SpanLike[])
		.map((child) => (child?._type === "span" && typeof child.text === "string" ? child.text : ""))
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * 見出しの文字列を URL の # に使える形にする。日本語はそのまま残す（ブラウザが表示時にデコードする）。
 * 例: "1年目〜3年目" → "1年目-3年目"、"My skill set" → "my-skill-set"
 */
export function slugifyHeading(text: string): string {
	const slug = text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}\s_〜~-]/gu, "")
		.trim()
		.replace(/[\s_〜~-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "section";
}

/** Portable Text の値から目次の見出しを取り出す。同じ文字列の見出しは id に -2, -3… を付けて区別する。 */
export function getTocHeadings(value: unknown): TocHeading[] {
	if (!Array.isArray(value)) return [];
	const found: Omit<TocHeading, "id" | "depth">[] = [];
	for (const block of value as BlockLike[]) {
		if (block?._type !== "block" || typeof block.style !== "string") continue;
		const level = TOC_LEVELS[block.style];
		if (!level || typeof block._key !== "string") continue;
		const text = blockText(block);
		if (text) found.push({ key: block._key, text, level });
	}

	const minLevel = Math.min(...found.map((h) => h.level));
	const used = new Set<string>();
	return found.map((heading) => {
		const base = slugifyHeading(heading.text);
		let id = base;
		for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
		used.add(id);
		return { ...heading, id, depth: heading.level - minLevel };
	});
}

// リクエストごとに「ブロックの _key → id」を持つ。レスポンスが終われば Request ごと回収される。
const anchorsByRequest = new WeakMap<Request, Map<string, string>>();

/** ページで目次を作ったあと、本文の見出しに同じ id を付けられるよう登録する */
export function provideHeadingAnchors(request: Request, headings: TocHeading[]): void {
	anchorsByRequest.set(request, new Map(headings.map((h) => [h.key, h.id])));
}

/** 本文の見出しブロックに付ける id。目次に載らない見出しは undefined */
export function getHeadingAnchor(request: Request, key: unknown): string | undefined {
	return typeof key === "string" ? anchorsByRequest.get(request)?.get(key) : undefined;
}
