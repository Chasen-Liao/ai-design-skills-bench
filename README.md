# AI Design Skills Benchmark

用**同一段 prompt、同一个模型、极简 Pi（4 工具）**横评常见设计类 Agent Skills。每个子目录是一次独立实测。

## 控制变量

- Harness：Pi（`read` / `bash` / `edit` / `write`）
- 模型：DeepSeek V4.1 Flash 1017（经 ZenMux Pay-As-You-Go）
- 每目录只装**一个**被测 skill（裸对照不装）
- 主赛题：Chasen 个人介绍落地页（见 `prompt/a1-chasen-intro.md`）
- 单次结果，有随机性；结论等截图和数据齐了再写

## 目录约定

```
runs/<日期>/
  00-bare/                 # 裸 Pi 对照
  01-frontend-design/
  02-ui-ux-pro-max/
  …
  _log.md                  # 耗时、exit code、产物路径
```

每个 run 目录内通常有：`index.html`、素材副本、`run.log`，可选截图。

## 状态

进行中。本仓库只存产物与日志，不替 skill 排名。
