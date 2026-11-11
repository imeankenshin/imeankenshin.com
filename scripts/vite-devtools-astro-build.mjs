// Vite DevTools の Rolldown パネルにある「Run build」は `vite build` を固定で実行する。
// このサイトは Astro なので、同じ RPC を差し替えて `astro build` を実行させる。
// 開発サーバー専用（Vite DevTools は apply: "serve"）。本番ビルドには影響しない。

const BUILD_COMMAND = {
	command: "astro",
	args: ["build"],
	env: {
		NODE_ENV: "production",
		// Rolldown のログ（node_modules/.rolldown/）だけを出す。DevTools 本体は dist に書き出さない
		VITE_DEVTOOLS_ROLLDOWN: "true",
	},
};

/** @returns {import("vite").Plugin} */
export function viteDevtoolsAstroBuild() {
	let current;
	let currentSessionId;
	let runCount = 0;

	const getBuildCommand = (ctx) => ({ ...BUILD_COMMAND, cwd: ctx.cwd ?? process.cwd() });

	async function startBuild(ctx) {
		if (currentSessionId && ctx.terminals.sessions.get(currentSessionId)?.status === "running") {
			return { sessionId: currentSessionId, alreadyRunning: true };
		}
		if (current) await current.terminate().catch(() => {});
		const sessionId = `astro:rolldown:build-${++runCount}`;
		current = await ctx.terminals.startChildProcess(getBuildCommand(ctx), {
			id: sessionId,
			title: `astro build #${runCount}`,
			icon: "ph:terminal-window-duotone",
		});
		currentSessionId = sessionId;
		return { sessionId, alreadyRunning: false };
	}

	async function waitForBuild() {
		if (!current) return { exitCode: null };
		try {
			return { exitCode: (await current.getResult()).exitCode ?? null };
		} catch {
			return { exitCode: null };
		}
	}

	return {
		name: "imeankenshin:devtools-astro-build",
		apply: "serve",
		// Rolldown パネル（@vitejs/devtools-rolldown）が RPC を登録した後に差し替えるため post にする
		enforce: "post",
		devtools: {
			setup(ctx) {
				const overrides = [
					{ name: "vite:rolldown:get-build-command", type: "query", handler: async () => getBuildCommand(ctx) },
					{ name: "vite:rolldown:run-build", type: "action", handler: () => startBuild(ctx) },
					{ name: "vite:rolldown:wait-for-build", type: "action", handler: () => waitForBuild() },
				];
				for (const { handler, ...def } of overrides) {
					// Rolldown パネルが入っていない環境では何もしない
					if (ctx.rpc.has(def.name)) ctx.rpc.update({ ...def, setup: () => ({ handler }) });
				}
			},
		},
	};
}
