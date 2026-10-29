# 设计 skill 横评 · Chasen 个人介绍落地页 · 2026-10-29

## 用法
每个 skill 开一个空目录，把本目录里的 `avatar.jpg`、`chibi.jpg` 复制进去，再把下面「统一 prompt」整段丢给 Pi。裸 Pi 对照也用同一段。不要追加风格指令，让 skill 自己发挥。

数据核对时间：2026-10-29 上海时间，GitHub API + X 公开资料 + 现有个人站文案。

---

## 统一 prompt（整段复制）

```
帮我做一个个人介绍落地页，主角是 Chasen。

下面是真实资料，请基于这些信息来写文案和排版，不要编造经历、数字或公司名。风格不限，自己做有主见的设计选择，不要停下来问我选风格。需要做选择的地方一律选第一个方案。

【基本信息】
- 名字：Chasen / Chasen Liao，GitHub：Chasen-Liao
- 20 岁，计算机科学大四，广州
- 身份：AI 开发工程师 · AI 原住民 · 一边实习一边做 AI Agent 工具
- 名字取自 chase：不停追逐，无限进步
- 当前身份与想法：本职是 AI 开发工程师，正在认真考虑往 AI 产品经理方向尝试
- 求职意向：开放 AI 开发工程师 和 AI 产品经理，城市广州或深圳
- 常驻平台：X @chasen_liao（约 6k 粉丝），在上面写 Pi / Agent 工具实测、新模型上手、大四找工作，以及从开发转产品探索的真实记录

【一句话定位，可改写但别歪】
AI 开发工程师 × AI 原住民，做 Pi 桌面客户端和 Agent Skills，也想试试 AI 产品经理。

【精选项目，按重要程度】
1. pi-agent-desktop · 旗舰
   - Electron 桌面客户端，给 Pi 编程智能体用
   - 原生窗口、会话分叉、SSE 流式对话、模型中途切换、内置文件浏览器
   - TypeScript / Electron / React
   - GitHub 约 331 star
   - https://github.com/Chasen-Liao/pi-agent-desktop
2. resume-skills
   - 一句话让 Agent 生成精美简历，还能按 JD 匹配
   - 约 38 star · https://github.com/Chasen-Liao/resume-skills
3. Chasen-Skills
   - 自用 Agent Skills 合集，npx skills 安装，含并行编排、X 内容复盘、AI 热帖雷达、个人 IP 资产构建等
   - 约 33 star · https://github.com/Chasen-Liao/Chasen-Skills
4. Everything-claude-code-Doc
   - Everything Claude Code 使用指南，持续更新
   - 约 15 star · https://github.com/Chasen-Liao/Everything-claude-code-Doc
5. SuperMew
   - Agentic RAG，关注 Context Engineering 和三层记忆架构
   - https://github.com/Chasen-Liao/SuperMew

【技能信号，按日常强度，不要做成进度条百分比瞎编】
- 每天在用：Pi、Claude Code、Codex
- 主力：Python、TypeScript / React、Agent / RAG
- 做过：Electron、FastAPI、向量检索、HTML/CSS

【外链展示位，具体 URL 先留空】
页面里要做出这些入口的展示位置和文案标签，但链接先空着，不要填真实 URL，也不要编造假域名。可以用按钮、文字链或图标位，href 写成 # 或留空，文案旁标「链接待填」即可：
- 个人站
- 博客
- GitHub
- X（文案可用 @chasen_liao，但不要写死完整链接）
- Email（只显示「Email」标签，不要写具体邮箱地址）

【素材】
项目根目录里有：
- avatar.jpg：真人头像
- chibi.jpg：Q 版角色设定卡（浅棕短发、青蓝耳机、粉色点缀）
头像和角色图可以选用，也可以不用；不要依赖外网图片 URL。

【页面至少包含】
- 首屏：名字 + 一句话定位 + 主 CTA（去 X 或 Email，链接留空）和次 CTA（看作品 / GitHub，链接留空）
- About：简短自我介绍
- 精选作品：上面 5 个里至少放 3 个，项目仓库用上面给的 GitHub 链接；个人站/博客/X/Email 等外链仍按外链规则留空
- 技能或正在折腾的东西
- 联系 / 开放机会：AI 开发工程师、AI 产品经理
- 页脚

【交付要求】
- 只输出一个 index.html，纯 HTML、CSS、JS，不要构建工具，可以用 CDN 和 Google Fonts
- 桌面和手机都要适配
- 文案要像真人个人站，不要「赋能」「革命性」「深耕」这类空词
- 做完告诉我文件路径
```

---

## 素材说明（给你自己看，不用贴进 prompt）

### 已放进本目录的文件
- `avatar.jpg`：X / IP 头像原图
- `chibi.jpg`：Q 版角色设定卡
- 每次开跑复制进空项目根目录

### GitHub 快照（2026-10-29）
- 账号：https://github.com/Chasen-Liao
- 公开仓库 70，followers 128，bio：When wits fall short, repetition is the key to triumph.
- location：China · blog：https://chasenclog.vercel.app/（GitHub company 字段有学校名，prompt 里已去掉，不要写进页面）
- 已有个人介绍仓库：https://github.com/Chasen-Liao/chasen-intro → https://chasen-intro.vercel.app/
- 非 fork 高 star：pi-agent-desktop 331、resume-skills 38、Chasen-Skills 33、Everything-claude-code-Doc 15、pi-auto-compact 10、FinTrack 5

### X 快照（2026-10-29）
- @chasen_liao · 6014 followers
- bio：大四实习ing & AI 原住民 / Vibe Coding · AI Agent · 新工具实测 / 最近在用 Pi 串联 Agent 开发的一切 / 也在不断尝试 AI 产品经理 / “不停追逐”
- 个人介绍页链接已挂在 bio 里

### 现有个人站可参考的区块（不是要抄版式）
现网已有：首屏定位、About、技能台、作品档案、X 长文摘录、求职 CTA、邮箱。横评时**不要**让模型去打开现网再模仿，只给上面 prompt 里的文字资料，避免大家都抄成同一版。

### 刻意没写进 prompt 的
- Bot 团队分工、文件路径、内部工具链（隐私）
- 具体实习公司名（公开资料未确认）
- 硬性配色/字体/「必须赛博 / 必须极简」等风格限定

---

## 和原「省省」方案怎么接

| 项 | 建议 |
| --- | --- |
| 横评组主 prompt | 换成上面这段个人介绍页 |
| 裸 Pi 对照 | 同一段，不装 skill |
| 副赛仪表盘 | 仍可用 Pulse，或先跳过，个人页横评优先 |
| 评审组原料 | 用裸 Pi 做出的 Chasen 个人页 |
| 动效组 | 在个人页成品上加轻动效 |
| 截图 | 桌面 1440 首屏 + 手机 390 各一张 |
| 发帖叙事 | 「同一个我、同一份资料、不同 design skill，个人站能差到什么程度」 |

## 模型（2026-10-29）
横评锁定自费 **DeepSeek 1017**，不在 OpenRouter 免费池里跑。API key 由 Chasen 之后提供。其它分组提示词见 `../ai-design-skills-prompt-suites.md`。
