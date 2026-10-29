# A1 metrics · 2026-10-29

控制变量：zenmux / `deepseek/deepseek-v4.1-flash` · 极简 Pi（read,bash,edit,write）· `--no-session` · 统一 prompt。

## Token / cost availability

- Per-run tokens：**不可得**。`run-one.sh` 使用 `--no-session`，Pi session jsonl 未保留；`run.log` 无 usage 字段。
- ZenMux Management Usage/Cost API 需要 `sk-mg-v1-*` Management Key；当前 vault 只有 PAYG inference key（`sk-payg-…`），无法拉账户级 usage。
- 价目（models.json list price，仅供参考，非实测账单）：`deepseek/deepseek-v4.1-flash` input **$0.075 / 1M tok**，output **$0.30 / 1M tok**（cacheRead/Write 0）。
- 下表 `tokens` / `cost_usd` 一律记 `n/a`，避免假数。

## Summary table

| run | skill | duration_s | exit | html_bytes | tokens | cost_usd | process_weight | shot | notes / issues |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 00-bare | none | 296 | 0 | 58247 | n/a | n/a | light | `runs/2026-10-29/00-bare/shot-desktop.png` | none observed |
| 01-frontend-design | frontend-design | 433 | 0 | 40735 | n/a | n/a | light-medium | `runs/2026-10-29/01-frontend-design/shot-desktop.png` | none observed |
| 02-ui-ux-pro-max | ui-ux-pro-max | 550 | 0 | 66080 | n/a | n/a | medium | `runs/2026-10-29/02-ui-ux-pro-max/shot-desktop.png` | none observed |
| 03-baoyu-design | baoyu-design | 385 | 0 | 39956 | n/a | n/a | light-medium | `runs/2026-10-29/03-baoyu-design/shot-desktop.png` | none observed |
| 04-oil-ui | oil-ui | 1307 | 0 | 45407 | n/a | n/a | heavy | `runs/2026-10-29/04-oil-ui/shot-desktop.png` | none observed (completed exit=0); workdir .oil-ui not committed |
| 05-ai-design-skills | landing-page-design | 98 | 0 | 38819 | n/a | n/a | light (truncated wall clock) | `runs/2026-10-29/05-ai-design-skills/shot-desktop.png` | Pi interrupted after html written; meta/log finalized without rerun; leftover chrome/pi later killed before 06 |
| 06-huashu-design | huashu-design | 601 | 0 | 178290 | n/a | n/a | medium-heavy | `runs/2026-10-29/06-huashu-design/shot-desktop.png` | none observed; direction*.md left untracked |
| 07-hallmark | hallmark | 839 | 0 | 27836 | n/a | n/a | heavy | `runs/2026-10-29/07-hallmark/shot-desktop.png` | none observed (completed exit=0); .hallmark not committed |
| 08-taste-skill | design-taste-frontend | 1408 | 0 | 42485 | n/a | n/a | very heavy | `runs/2026-10-29/08-taste-skill/shot-desktop.png` | Pi process exited mid-inspect loop after ~23m wall; remaining WARN findings size-count/no-footage/blank-gap; finalized without rerun; .taste-skill not committed |
| 09-awesome-design-md | DESIGN.md(claude) | 486 | 0 | 54239 | n/a | n/a | medium | `runs/2026-10-29/09-awesome-design-md/shot-desktop.png` | none observed |

## Process weight detail (observational)

| run | weight | what happened in the loop |
| --- | --- | --- |
| 00-bare | light | bare Pi; write index + headless multi-width check |
| 01-frontend-design | light-medium | single skill + write + viewport check |
| 02-ui-ux-pro-max | medium | skill-guided write; wall clock ~9m |
| 03-baoyu-design | light-medium | skill-guided write + verify |
| 04-oil-ui | heavy | long run (~22m); .oil-ui evidence/views/design-notes; multi-viewport verify; GSAP/CDN |
| 05-ai-design-skills | light (truncated wall clock) | landing-page-design; html appeared quickly |
| 06-huashu-design | medium-heavy | directions.md → direction-approved.md → large single-file html (images inlined); axe/lint mentions in log |
| 07-hallmark | heavy | .hallmark salt/tokens/measure/shots + sloplint --render; multi device shots |
| 08-taste-skill | very heavy | design-taste-frontend inspect loop (desktop/tablet/mobile shots + report.json + CSS probe iterations) |
| 09-awesome-design-md | medium | --no-skills + root DESIGN.md; QA/check scripts then polish |

## Interrupt / failure notes

- **05-ai-design-skills**：上一轮执行器中断；目录已有 `index.html`（38819 B）。未重跑 Pi；按 START→html mtime 估 98s；exit 记 0；notes 标明 finalized without rerun。残留 Pi/chrome 在开 06 前已杀。
- **08-taste-skill**：inspect 多轮改 CSS 后 Pi 进程消失（终端仍 running 但 pi pid 已死）；有有效 html；按 START→最后 html mtime 记 1408s；未重跑。
- **06–09 skill 就位**：huashu / hallmark / design-taste-frontend / DESIGN.md 均已预置；无装 skill 失败。
- **Hallmark / taste 浏览器**：本机有 `/usr/bin/google-chrome`，二者均能起 headless；未因缺浏览器失败（故无重试）。
- 不在本文件对 skill 做质量排名或结论。

