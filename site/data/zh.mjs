// 展示站用的中文标注。原始数据（runs/ 下的 _metrics.json、meta.json）保持英文不动，
// 构建时按 id / 原文精确匹配替换；匹配不到会在构建时告警并原样显示。
// 注：旧版按 ZenMux 时间段估算的 _tokens.md 已弃用，构建不再读取。

// 轮次 id → 页面显示名。未列出的直接用 meta.json 里的 skill 名。
export const SKILL_LABEL = {
  '00-bare': '裸 Pi（不装 skill）',
  '05-ai-design-skills': 'landing-page-design',
  '09-awesome-design-md': 'DESIGN.md（claude）',
};

// meta.note 原文 → 中文备注。
export const NOTE_ZH = {
  'interrupted-but-html-ok: session ends mid inspect after last toolResult; run.log has START only; index.html present and screenshotted':
    '中途断过但有页面：会话在最后一次工具结果后的检查循环里中断；run.log 只有 START；index.html 已在磁盘并完成截图。耗时与 token 以 _metrics.json 的会话统计为准。',
};
