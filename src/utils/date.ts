// Workers の実行環境は UTC なので、表示用のタイムゾーンを明示する
const TIME_ZONE = "Asia/Tokyo";

const formatter = new Intl.DateTimeFormat("ja-JP", {
	timeZone: TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** 例: 2026年11月02日（月・日は 2 桁にそろえる） */
export function formatDate(date: Date): string {
	const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
	return `${parts.year}年${parts.month}月${parts.day}日`;
}
