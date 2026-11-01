// 展示站用的中文标注与本地化配置。
// 原始数据（runs/ 下的 _metrics.json、meta.json）保持英文不动，
// 构建时按 id / 原文精确匹配替换；匹配不到会在构建时告警并原样显示。

// 轮次 id → 页面显示名。未列出的直接用 meta.json 里的 skill 名。
export const SKILL_LABEL = {
  '00-bare': '00-bare (裸对照)',
  '01-frontend-design': 'frontend-design',
  '02-ui-ux-pro-max': 'ui-ux-pro-max',
  '03-baoyu-design': 'baoyu-design',
  '04-oil-ui': 'oil-ui',
  '05-ai-design-skills': 'landing-page-design',
  '06-huashu-design': 'huashu-design',
  '07-hallmark': 'hallmark',
  '08-taste-skill': 'design-taste-frontend',
  '09-awesome-design-md': 'DESIGN.md (claude)',
};

// 5 大使用任务分类标签映射（F02）
export const TASK_LABELS = {
  all: '全部任务',
  portfolio: '个人站 / 作品集',
  landing: '营销落地页',
  admin: '后台与产品界面',
  prototype: '原型演示',
  'style-ref': '已有风格参考',
};

// 5 大使用任务使用场景导向说明
export const TASK_DESCRIPTIONS = {
  all: '查看全部 9 个设计项目与 1 个裸对照基准',
  portfolio: '适合个人主页、作品集陈列、求职简历与个人品牌展示',
  landing: '适合 SaaS 官网、商业产品发布页、线索收集与活动宣传',
  admin: '适合企业后台、控制台、数据看板、工作台与高密度工具界面',
  prototype: '适合交互验证、高保真功能演示、UI 组件 Demo 与幻灯片',
  'style-ref': '适合注入既有设计系统（Design Tokens）与多风格探索比选',
};

// 来源与评价状态三重分级标注（F04）
export const PROVENANCE_TAGS = {
  author_doc: {
    tag: '作者文档描述',
    cssClass: 'provenance-author',
    desc: '引自 Skill 自身 SKILL.md 或官方说明文档',
  },
  actual_obs: {
    tag: '本次实测观察',
    cssClass: 'provenance-observed',
    desc: '基于本次 A1 个人介绍页实测生成的客观表现与日志',
  },
  pending_review: {
    tag: '待确认编辑建议',
    cssClass: 'provenance-pending',
    desc: '根据实测与产物特征提炼的建议，待作者 Chasen 最终确认',
  },
  confirmed: {
    tag: '已确认基线/事实',
    cssClass: 'provenance-confirmed',
    desc: '已核实确认的基线设定或客观事实',
  },
};

// 指标口径与字段中文说明（F06, F08, F09）
export const METRIC_LABELS = {
  duration_cumulative: {
    label: '各组耗时累计',
    note: '各跑次单次执行时间累加求和，非并发执行的整批墙上经过时间',
  },
  batch_wall_time: {
    label: '整批实际经过时间',
    note: '并发执行下整批任务实际起止时间跨度（V2: 71 分钟 / V3: 23.5 分钟）',
  },
  input_tokens: {
    label: '未缓存输入 (input)',
    note: '模型实际处理的新增/未缓存 prompt token',
  },
  cache_read_tokens: {
    label: '缓存读取 (cacheRead)',
    note: '模型命中的 KV 提示词缓存 token（占总输入的 90% 以上）',
  },
  output_tokens: {
    label: '输出 (output)',
    note: '大模型生成的新 token 数量',
  },
  read_skill_fixed_00: {
    label: '未安装 / 不适用',
    note: '00-bare 为裸对照基准，日志中的 bash find 探测被分析脚本误标，已在此客观修正',
  },
};

// 页面通用展示文案与修正说明（F01, F05, F07, F08, F10）
export const BENCHMARK_COPY = {
  heroHeadline: '设计 Skill 怎么选？先看同题做出的页面',
  heroLede:
    '9 个设计项目 + 1 个裸对照，在同一提示词族与同一模型（DeepSeek V4.1 Flash 1017）下的同题页面实测。不打分、不排名，只看做出的真实版面、执行开销与任务取舍。本横评仅个人页实测，其他任务建议来自作者文档。',
  sampleCountWording: '9 个设计项目 + 1 个裸对照',
  v3ExecutionBlurb:
    'V3 约束提示词要求「一次成版交付」，但 04-oil-ui、06-huashu-design、08-taste-skill 实测中仍有多轮编辑或无头浏览器探测；06 仍保留方向审查记录。',
  bareReadSkillNote:
    '00-bare 为未安装任何 Skill 的裸对照。因分析器将 bash 探测 SKILL.md/DESIGN.md 误判为 read_skill=true，此处已客观纠正。',
  tasteSkillInterruptNote:
    '中途断过但有页面：V2 在第 56 次调用由于 30 分钟超时在无头检查中被中止，但 HTML 已写入且成功截图；V3 在一次成版约束下以 515 秒正常退出（exit 0）。',
};

// meta.note 原文 → 中文备注。
export const NOTE_ZH = {
  'interrupted-but-html-ok: session ends mid inspect after last toolResult; run.log has START only; index.html present and screenshotted':
    '中途断过但有页面：会话在最后一次工具结果后的检查循环里中断；run.log 只有 START；index.html 已在磁盘并完成截图。耗时与 token 以 _metrics.json 的会话统计为准。',
};
