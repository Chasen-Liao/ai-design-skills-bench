# 设计 skill 横评实测方案 · 2026-10-28

## 1. 不是 25 个都能用同一个 prompt
- 同题横评组，用 prompt A 做落地页：frontend-design、ui-ux-pro-max、taste-skill、hallmark、huashu-design、ai-design-skills、baoyu-design、oil-ui、awesome-design-md（挑一份 DESIGN.md 放根目录）
- 后台组，用 prompt B：interface-design（README 写明不适合营销站），也可以让 ui-ux-pro-max、frontend-design 加跑一次
- 评审组，不做新页面，拿裸 Pi 做出来的那一版去改：impeccable、vercel web-design-guidelines、jakubkrehel/skills、apple-design-skill、designer-skills。看改前和改后的对比
- 动效组，用 prompt C：emilkowalski、gsap-skills、scroll-craft、motion-design-skill、oil-motion（要接 AI 视频生成，成本高，可以跳过）
- Logo：logo-design-skill 单独一个 prompt
- 建议跳过或只提一句：design.md 是格式规范不出页面，stitch-skills 需要 Google Stitch MCP，superdesign 依赖它家的在线服务，ux-ui-agent-skills 偏重

## 2. 控制变量
- 对照组：同一个 prompt，裸 Pi 不装任何 skill 先跑一遍。这张图是整篇最重要的
- 同一个模型、同一个 Pi 版本，每个 skill 用一个新的空目录，只装这一个 skill
- 每个只跑一次，正文里说明是单次结果，有随机性
- 不追加人工指令。skill 中途要你选方案的，统一选第一个，在 prompt 里提前写好
- 每个记录：耗时、token 或花费、对话轮数、有没有报错或要手动修
- 截图统一：桌面 1440 宽首屏一张，手机 390 宽一张
- Claude Code 专用的 /plugin 安装方式在 Pi 里用不了，要手动把 SKILL.md 放进 Pi 读 skill 的目录，先确认 Pi 能识别再跑

## 3. 固定 prompt 草稿
### prompt A 落地页
帮我做一个产品官网落地页。产品叫「省省」，是一个给大学生用的 AI 记账 App，拍照小票就能自动记账，每周给一份花钱复盘
要求：
- 只输出一个 index.html，纯 HTML、CSS、JS，不要构建工具，可以用 CDN
- 包含首屏、三个核心功能、使用流程、价格、FAQ、页脚
- 桌面和手机都要适配
- 需要我做选择的地方一律选第一个方案，不要停下来问我
- 做完告诉我文件路径

### prompt B 后台
用同样的规则，做「省省」的运营后台首页，单个 index.html：顶部数据卡片、近 30 天用户增长折线图、最近记账记录表格、侧边导航，数据用假数据

### prompt C 动效
在 prompt A 做出来的页面基础上，给首屏、按钮、卡片悬停、滚动进入加上动效，保持轻量

## 4. 帖子结构
- 标题沿用「这25个 skills 让你彻底告别 AI Slop！🔥」，或者改成实测向
- 开头：同一个 prompt、同一个模型、裸 Pi，先放没装 skill 的对照图
- 一张大拼图：落地页组 9 张首屏并排
- 每个 skill：截图 + 耗时和 token + 一句结论，全部【待 Chasen 填写】
- 评审组放改前改后对比
- 结尾：按场景给推荐，依据是实测
- 文末：链接和安装命令，沿用现在的清单

## 5. 2026-10-29 更新
横评组主 prompt 改为 **Chasen 个人介绍落地页**，完整资料和可复制 prompt 见 `ai-design-skills-chasen-intro/prompt-and-materials.md`。「省省」不再当主赛题。

## 6. 2026-10-29 晚些
- 模型改为自费 DeepSeek 1017，API key 待提供
- 分组提示词与小白选型见 `ai-design-skills-prompt-suites.md`（含 A2 反模板、A3 便利店、B1 课表后台、C/D/E）
