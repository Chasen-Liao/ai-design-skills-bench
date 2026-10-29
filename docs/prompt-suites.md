# 设计 skill 分组提示词 · 2026-10-29

模型：DeepSeek 1017（自费，API key 待 Chasen 提供）  
Harness：极简 Pi，默认 4 工具；每个空目录只装**一个**被测 skill + 个人页用的 avatar/chibi  
主赛题个人介绍页：见 `ai-design-skills-chasen-intro/prompt-and-materials.md`

---

## 0. 先搞清：不是所有 skill 都该做落地页

| 组 | 测什么 | 谁进这组 | 主提示词 |
| --- | --- | --- | --- |
| A 从零出站 | 有没有设计主见、去 AI 味、版式 | frontend-design、ui-ux-pro-max、taste、hallmark、huashu、baoyu、ai-design-skills、oil-ui、awesome-design-md | A1 个人介绍页（主）/ A2 压力题 |
| B 工具型界面 | 信息密度、表格图表、侧栏 | interface-design；可加跑 ui-ux-pro-max、frontend-design | B1 |
| C 评审打磨 | 改丑页的能力，不做新站 | impeccable、vercel web-design-guidelines、apple-design-skill、designer-skills、jakubkrehel | C1 |
| D 动效 | 交互手感，必须真机点 | emilkowalski、gsap、scroll-craft、motion-design | D1 |
| E Logo / 品牌符号 | 标志识别度 | logo-design-skill | E1 |
| 跳过或一笔带过 | 不出页 / 强依赖外部服务 | design.md 规范类、stitch、superdesign、过重的 ux-ui-agent | — |

小白选型口诀（发帖结尾可用）：
1. 只会做站、怕紫渐变 → 先装 frontend-design，再配 impeccable 体检  
2. 完全没风格想法 → ui-ux-pro-max 或 hallmark / taste 二选一做落地页  
3. 已经有一版很丑 → 别换 skill 重做，丢给评审组打磨  
4. 要按钮弹窗顺滑 → 动效组，别指望落地页 skill 顺带搞定  
5. 要 Logo → 单独跑 Logo skill，别跟个人站混测

---

## 共用尾巴（A/B/E 都贴）

```
要求：
- 只输出一个 index.html，纯 HTML、CSS、JS，不要构建工具，可以用 CDN 和 Google Fonts
- 不要用外部图片 URL；需要图用 CSS / SVG / 项目里已有的本地文件
- 桌面和手机都要适配
- 需要我做选择的地方一律选第一个方案，不要停下来问我
- 做完告诉我文件路径
```

---

## A 组 · 从零出站

### A1 主赛 · Chasen 个人介绍页
完整版见 `ai-design-skills-chasen-intro/prompt-and-materials.md`。  
测：真实人物资料下的主见、作品卡、求职双意向、外链留空位。

### A2 压力题 ·「反模板」个人站（更新颖，更能拉开差距）
同一人设，但故意加约束，逼 skill 跳出 Inter + 紫渐变 + 三卡片：

```
还是做 Chasen 的个人介绍页，资料和 A1 相同。额外硬约束：

- 禁止：紫色或靛蓝渐变背景、Inter / Roboto / Arial 作为主字体、每个区块居中三等分卡片、标题里单独一个彩色词、页脚邮箱订阅框
- 版式必须有不对称：例如一侧大字一侧作品列表，或首屏文字压在色块边缘
- 至少一处用大号中文做视觉锚点，不要整站英文装酷
- 作品区不要做成一模一样的卡片栅格，三项之间要有主次
- 个人站 / 博客 / X / Email 只留展示位，链接空着；项目 GitHub 用资料里的真链接

（后面贴共用尾巴）
```

建议：同组 skill 先跑 A1 出拼图；差距不够再抽 2～3 个代表 skill 加跑 A2。

### A3 备选新颖题 ·「夜班便利店」品牌小站（非 SaaS）
专门打「只会出 AI 工具站」的 skill：

```
帮我做一个深夜便利店的品牌小站。店名「两点半」，开在大学城，卖关东煮、加热便当和关灯后才有的自制三明治。客群是写作业写到崩溃的学生和下班骑车路过的人。

页面要有：首屏氛围、今晚热卖 3 样、怎么到店、一句店主的话、页脚。
气质要像晚上 2:30 的日光灯和微波炉声，不要科技公司官网，不要紫渐变。
（贴共用尾巴）
```

适合 hallmark / taste / huashu / baoyu 加赛；frontend-design 也可跑看它还会不会出 SaaS 脸。

---

## B 组 · 工具型界面

### B1 ·「课表冲突雷达」学生教务小后台（比电商仪表盘更新）

```
帮我做一个给大学生用的「课表冲突雷达」后台首页。单页 index.html。

要有：
- 左侧导航：总览、我的课表、冲突列表、同学共享、设置
- 顶部四张卡：本周课程数、未解决冲突、今日下一节倒计时、共享中的课表数
- 主区：一张「本周冲突」列表，至少 5 行假数据，字段含两门课名、冲突时段、严重程度
- 侧旁或下方：简易周视图色块示意，不要真日历库
- 视觉要像天天打开的工具，不要营销落地页

（贴共用尾巴）
```

测：表格对齐、密度、侧栏、工具感。interface-design 主测；落地页组里夸「万能」的 skill 可加跑打脸。

---

## C 组 · 评审打磨（不做新站）

### C1
1. 用**裸 Pi + A1** 做出一版丑的或平庸的个人页，存成 `baseline/index.html`  
2. 每个评审 skill 新目录，只拷入这份 baseline + 该 skill  
3. Prompt：

```
这是一份已经做好的个人介绍页 index.html。请按你的设计规范体检并直接改文件。
目标：去掉 AI 味、加强层次和手机可读性，保持是 Chasen 的个人站，不要改成别的产品。
不要重做一版全新视觉主题，优先在现有结构上 polish。
改完列出你改了哪几处，然后告诉我文件路径。
```

测：audit / polish 词汇、会不会真改文件、改前改后首屏对比。

---

## D 组 · 动效

### D1
在 **A1 某一成品**（建议用裸 Pi 或 frontend-design 那版）上：

```
不要重做页面结构。只在现有 index.html 上加轻量动效：
- 首屏标题进入
- 主按钮 hover / press
- 作品卡片悬停
- 向下滚动时 About 或作品区一次进入动画
不要用沉重的整页视差，不要自动播放吵闹循环动画，要照顾 prefers-reduced-motion。
改完告诉我文件路径。
```

评估必须浏览器里真的移上去点，不能只截静图。

---

## E 组 · Logo

### E1 · 给「两点半」便利店做标志（和 A3 可串）

```
为深夜便利店「两点半」设计一个 Logo，输出一个 index.html：
- 页面上方是 Logo 主视觉（SVG）
- 下方给出：横版、竖版、单色、反白四套用法示意
- 说明为什么这样画，两三句人话即可
不要写成科技 SaaS 图标，不要紫渐变球体。
（贴共用尾巴）
```

---

## 实测顺序建议（省钱、故事完整）

1. 裸 Pi + A1 → 对照图（必做）  
2. A 组各 skill + A1 → 首屏大拼图（核心）  
3. 差距糊的 2～3 个 + A2 或 A3 → 证明「不是只会做一种站」  
4. 裸 Pi 的 A1 丢给 C 组 → 改前改后  
5. 有余力：B1 打后台、D1 打手感、E1 打 Logo  

发帖主线给小白：  
「同一份我的资料、同一个 DeepSeek 1017、极简 Pi，只换 skill —— 你会看到谁在设计，谁只是换皮。」

---

## 和旧方案对照

| 旧 | 新 |
| --- | --- |
| 省省落地页 | A1 个人介绍页 |
| Pulse 电商后台 | B1 课表冲突雷达 |
| 泛动效 C | D1 基于个人页成品 |
| 无反模板题 | A2 禁止紫渐变/三卡片 |
| 无消费品牌压力 | A3 两点半便利店 |
