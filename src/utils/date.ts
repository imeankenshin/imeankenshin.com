// Workers の実行環境は UTC なので、表示用のタイムゾーンを明示する
const TIME_ZONE = "Asia/Tokyo";

export function formatDate(date: Date): string {
	return date.toLocaleDateString("ja-JP", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
