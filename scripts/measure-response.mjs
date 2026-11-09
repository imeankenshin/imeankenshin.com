import { execFileSync } from "node:child_process";

// Repeated GETs, without cache-busting: measures the path visitors actually use.
const url = new URL(process.argv[2] ?? "https://imeankenshin.com/");
const count = Number(process.env.SAMPLES ?? 10);
const budget = Number(process.env.MAX_P95_MS ?? 500);
if (!Number.isInteger(count) || count < 1 || !Number.isFinite(budget) || budget <= 0) {
	throw new Error("SAMPLES must be a positive integer; MAX_P95_MS must be positive");
}
const samples = [];
for (let i = 0; i < count; i++) {
	const output = execFileSync("curl", [
		"--silent", "--show-error", "--max-time", "20",
		"--dump-header", "-", "--output", "/dev/null",
		"--write-out", '\n{"status":%{http_code},"ttfb":%{time_starttransfer},"tls":%{time_appconnect},"total":%{time_total}}',
		url.href,
	], { encoding: "utf8" });
	const lines = output.trim().split(/\r?\n/);
	const timing = JSON.parse(lines.pop());
	const headers = new Headers();
	for (const line of lines) {
		const colon = line.indexOf(":");
		if (colon > 0) headers.set(line.slice(0, colon), line.slice(colon + 1).trim());
	}
	const sample = {
		status: timing.status,
		ttfbMs: Math.round(timing.ttfb * 1000),
		// Includes transport after TLS, placement, Worker startup, and rendering.
		afterTlsMs: Math.round((timing.ttfb - timing.tls) * 1000),
		cache: headers.get("cf-cache-status"),
		age: headers.get("age"),
		placement: headers.get("cf-placement"),
		serverTiming: headers.get("server-timing"),
	};
	samples.push(sample);
	console.log(JSON.stringify({ sample: i + 1, ...sample }));
}
const sorted = samples.map((s) => s.ttfbMs).sort((a, b) => a - b);
const percentile = (p) => sorted[Math.ceil(sorted.length * p) - 1];
const summary = {
	url: url.href,
	samples: count,
	p50Ms: percentile(0.5),
	p95Ms: percentile(0.95),
	maxMs: sorted.at(-1),
	budgetMs: budget,
	pass: samples.every((s) => s.status === 200) && percentile(0.95) <= budget,
};
console.log(JSON.stringify({ summary }));
if (!summary.pass) process.exitCode = 1;
