---
name: refreshing-preview-data
description: Refresh the PR previews' shared data (Neon `preview` branch + R2 `imeankenshin-media-preview`) from production. Use when the user wants production EmDash content copied into the preview/test environment, or previews show stale posts or missing images.
---

# Refreshing preview data

All PR previews share one DB, R2 bucket and KV, separate from production (README「プレビューのデータ」).
A refresh makes them a fresh **snapshot** of production: the DB rows and the media files they reference.
Both halves move together — a reset DB points at R2 keys that only exist once the media is copied.

| | Production | Preview |
|---|---|---|
| Neon (project `young-scene-04976765`) | branch `production` | branch `preview` = `br-lingering-wind-a1tcw2eo`, behind Hyperdrive `imeankenshin-com-preview-db` |
| R2 | `imeankenshin-media` | `imeankenshin-media-preview` |

KV holds only sessions; leave it alone.

## Steps

1. **Logins.** Run `neon me` and `cf auth whoami`. If either fails, stop and tell the user this needs their
   workstation logins.
   Done when both show `omurakenshin@gmail.com`.

2. **Reset the DB.** The reset discards anything written only on the preview, so preserve it as a dated backup:

   ```bash
   neon branches reset preview --parent --preserve-under-name preview-backup-$(date +%Y%m%d) \
     --project-id young-scene-04976765
   neon branches list --project-id young-scene-04976765
   ```

   If today's backup name is taken, append `-2`.
   Done when `preview` is `ready` with ID `br-lingering-wind-a1tcw2eo`. A different ID means Hyperdrive now
   points at nothing; stop and report it.

3. **Copy the media.** Run `pnpm install --frozen-lockfile` if `node_modules` is missing, then:

   ```bash
   python3 .agents/skills/refreshing-preview-data/copy-media.py
   ```

   It copies every production object whose ETag/size differs in the preview bucket and re-lists both to verify.
   `--dry-run` prints the plan only. Preview-only objects are reported and left in place.
   Done when it exits 0 with `mismatch 0`.

4. **Check a preview.** `gh pr list --state open`. If a same-repo PR is open, take its URL from the comment
   starting `Cloudflareプレビュー:` and `curl` `/posts` plus one image URL from that page: both 200, latest
   production post listed. With no open PR, report this check as pending.

5. **Report:** the backup branch name with its delete command
   (`neon branches delete <name> --project-id young-scene-04976765`), every older `preview-backup-*` branch
   still listed, the object counts copied, and that later production edits need another refresh.
   Delete backups only when the user asks.
