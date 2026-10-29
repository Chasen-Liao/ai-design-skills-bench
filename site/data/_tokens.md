# A1 per-run tokens (ZenMux Logs, deepseek/deepseek-v4.1-flash, key "design", 2026-10-29)
Source: ZenMux console Logs page, read manually; log time = Shanghai - 12h (minute precision). Boundary minutes counted in both adjacent runs.
Input includes cached tokens (cache read mostly 97-99%).

| Run | Requests | Input | Output |
|---|---|---|---|
| 00-bare | 25 | 1,033,850 | 47,555 |
| 01-frontend-design | 38 | 1,854,350 | 89,014 |
| 02-ui-ux-pro-max | 51 | 2,651,067 | 142,055 |
| 03-baoyu-design | 46 | 2,685,909 | 70,098 |
| 04-oil-ui | 82 | 11,049,291 | 127,083 |
| 05-ai-design-skills (interrupted) | 9 | 171,950 | 20,585 |
| 06-huashu-design | 58 | 3,714,218 | 92,163 |
| 07-hallmark | 66 | 6,888,210 | 116,277 |
| 08-taste-skill (interrupted) | 61 | 7,403,252 | 124,187 |
| 09-awesome-design-md | 34 | 1,997,053 | 63,688 |

Deduped total through 16:53 Shanghai: 438 requests, 38,342,205 input, 822,249 output.
Shared minutes: 03:03 (01/02) 7 req 196,083/25,246; 03:12 (02/03) 9 req 355,214/20,263; 03:19 (03/04) 5 req 71,952/9,969; 03:54 (06/07) 11 req 425,770/6,784; 04:08 (07/08) 8 req 284,656/13,885.
Gap 15:43 (between 05 and 06): 7 req 226,694/5,677. Later ~17:34-17:36 Shanghai: 31 req on same key, not part of runs.
