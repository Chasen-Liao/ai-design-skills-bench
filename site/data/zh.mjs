// 站点展示用中文译文。原始数据（runs/ 下的 _metrics.md、meta.json）保持英文不动，
// 构建时按原文精确匹配替换；找不到译文会在构建时告警并原样显示。

export const WEIGHT_ZH = {
  'light': '轻',
  'light-medium': '轻到中',
  'medium': '中',
  'medium-heavy': '中到重',
  'heavy': '重',
  'very heavy': '很重',
  'light (truncated wall clock)': '轻（计时被截断）',
};

export const NOTES_ZH = {
  'none observed': '未发现问题',
  'none observed (completed exit=0); workdir .oil-ui not committed':
    '未发现问题（正常完成，退出码 0）；工作目录 .oil-ui 未提交到仓库',
  'Pi interrupted after html written; meta/log finalized without rerun; leftover chrome/pi later killed before 06':
    '写出页面文件后 Pi 被中断；没有重跑，直接补全 meta.json 和日志；残留的 chrome / pi 进程在 06 开跑前被结束',
  'none observed; direction*.md left untracked': '未发现问题；direction*.md 未纳入版本管理',
  'none observed (completed exit=0); .hallmark not committed':
    '未发现问题（正常完成，退出码 0）；.hallmark 未提交到仓库',
  'Pi process exited mid-inspect loop after ~23m wall; remaining WARN findings size-count/no-footage/blank-gap; finalized without rerun; .taste-skill not committed':
    '约 23 分钟后 Pi 进程在检查循环中途退出；剩余警告项 size-count / no-footage / blank-gap；没有重跑，直接收尾；.taste-skill 未提交到仓库',
};

export const LOOP_ZH = {
  'bare Pi; write index + headless multi-width check': '裸 Pi；写出 index.html，再用无头浏览器按多种宽度检查',
  'single skill + write + viewport check': '单个 skill；写页面，再做视口检查',
  'skill-guided write; wall clock ~9m': '按 skill 指引写页面；总用时约 9 分钟',
  'skill-guided write + verify': '按 skill 指引写页面，再校验',
  'long run (~22m); .oil-ui evidence/views/design-notes; multi-viewport verify; GSAP/CDN':
    '长时间运行（约 22 分钟）；在 .oil-ui 下生成 evidence / views / design-notes；多视口校验；通过 CDN 使用 GSAP',
  'landing-page-design; html appeared quickly': 'landing-page-design；页面文件很快就写出来了',
  'directions.md → direction-approved.md → large single-file html (images inlined); axe/lint mentions in log':
    'directions.md → direction-approved.md → 体积较大的单文件页面（图片内联）；日志里提到 axe / lint 检查',
  '.hallmark salt/tokens/measure/shots + sloplint --render; multi device shots':
    '在 .hallmark 下做 salt / tokens / measure / shots，并运行 sloplint --render；多设备截图',
  'design-taste-frontend inspect loop (desktop/tablet/mobile shots + report.json + CSS probe iterations)':
    'design-taste-frontend 检查循环（桌面 / 平板 / 手机截图 + report.json + 多轮 CSS 探测调整）',
  '--no-skills + root DESIGN.md; QA/check scripts then polish': '--no-skills，加根目录 DESIGN.md；先跑质检和检查脚本，再打磨',
};
