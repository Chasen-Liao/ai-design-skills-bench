# 设计 skill 横评 A1 · 运行日志 · 2026-10-29

控制变量：zenmux / deepseek/deepseek-v4.1-flash · 极简 Pi 四工具 · 统一 prompt · 每 run 空目录单 skill

仓库：https://github.com/Chasen-Liao/ai-design-skills-bench

| run | skill | start (CST) | end (CST) | duration | index.html | bytes | exit | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00-bare | none | 2026-10-29 14:50:10 CST | 2026-10-29 14:55:06 CST | 296s | runs/2026-10-29/00-bare/index.html | 58247 | 0 | bare 对照；纸张暖色杂志式 |
| 01-frontend-design | frontend-design | 2026-10-29 14:56:00 CST | 2026-10-29 15:03:13 CST | 433s | runs/2026-10-29/01-frontend-design/index.html | 40735 | 0 | see run.log |
| 02-ui-ux-pro-max | ui-ux-pro-max | 2026-10-29 15:03:19 CST | 2026-10-29 15:12:29 CST | 550s | runs/2026-10-29/02-ui-ux-pro-max/index.html | 66080 | 0 | see run.log |
| 03-baoyu-design | baoyu-design | 2026-10-29 15:12:37 CST | 2026-10-29 15:19:02 CST | 385s | runs/2026-10-29/03-baoyu-design/index.html | 39956 | 0 | see run.log |
| 04-oil-ui | oil-ui | 2026-10-29 15:19:09 CST | 2026-10-29 15:40:56 CST | 1307s | runs/2026-10-29/04-oil-ui/index.html | 45407 | 0 | see run.log |
| 05-ai-design-skills | landing-page-design | 2026-10-29 15:41:15 CST | 2026-10-29 15:42:53 CST | 98s | runs/2026-10-29/05-ai-design-skills/index.html | 38819 | 0 | interrupted after html written, finalized without rerun |
| 06-huashu-design | huashu-design | 2026-10-29 15:44:10 CST | 2026-10-29 15:54:11 CST | 601s | runs/2026-10-29/06-huashu-design/index.html | 178290 | 0 | see run.log |
| 07-hallmark | hallmark | 2026-10-29 15:54:17 CST | 2026-10-29 16:08:16 CST | 839s | runs/2026-10-29/07-hallmark/index.html | 27836 | 0 | see run.log |
| 08-taste-skill | design-taste-frontend | 2026-10-29 16:08:21 CST | 2026-10-29 16:31:49 CST | 1408s | runs/2026-10-29/08-taste-skill/index.html | 42485 | 0 | interrupted after html written (pi exited mid-inspect loop), finalized without rerun |
| 09-awesome-design-md | DESIGN.md(claude) | 2026-10-29 16:45:59 CST | 2026-10-29 16:54:05 CST | 486s | runs/2026-10-29/09-awesome-design-md/index.html | 54239 | 0 | see run.log |

## Desktop shots

各成功 run 已用 Playwright + Chrome headless（viewport 1440, fullPage）写出 `shot-desktop.png`。绝对路径队列见 `SHOT_QUEUE.md`。
