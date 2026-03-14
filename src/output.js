import fs from 'fs';
import path from 'path';

/**
 * Generate meeting Markdown file
 */
export function generateMarkdown(transcriptLines, analysis, startTime, lang = 'tr') {
  const now = startTime || new Date();
  const dateStr = formatDate(now);
  const durMin = analysis?.estimated_duration_min || '?';
  const tone = analysis?.tone || 'neutral';

  const t = (key) => {
    const texts = {
      tr: {
        title: 'Toplantı Notları',
        date: 'Tarih',
        duration: 'Süre',
        tone: 'Ton',
        transcript: '📝 Transkript',
        summary: '📌 Özet',
        topics: '🗂 Konular',
        participants: '👥 Katılımcılar',
        yesterday: 'Dün',
        today: 'Bugün',
        blockers: 'Engeller',
        well: '😊 İyi Giden',
        wrong: '😟 Kötü Giden',
        improvements: '💡 İyileştirmeler',
        agenda: '📋 Gündem Maddeleri',
        decisions: '⚖️ Kararlar',
        rationale: 'Gerekçe',
        owner: 'Sorumlu',
        deferred: '⏳ Ertelenenler',
        actions: '✅ Aksiyon Kalemleri',
        feedback: '💬 Geri Bildirim',
        growth: '📈 Gelişim Alanları',
        next: '📅 Gelecek Toplantı Konuları'
      },
      en: {
        title: 'Meeting Transcript',
        date: 'Date',
        duration: 'Duration',
        tone: 'Tone',
        transcript: '📝 Transcript',
        summary: '📌 Summary',
        topics: '🗂 Key Topics',
        participants: '👥 Participants',
        yesterday: 'Yesterday',
        today: 'Today',
        blockers: 'Blockers',
        well: '😊 Went Well',
        wrong: '😟 Went Wrong',
        improvements: '💡 Improvements',
        agenda: '📋 Agenda Items',
        decisions: '⚖️ Decisions',
        rationale: 'Rationale',
        owner: 'Owner',
        deferred: '⏳ Deferred Items',
        actions: '✅ Action Items',
        feedback: '💬 Feedback',
        growth: '📈 Growth Areas',
        next: '📅 Next Meeting Topics'
      }
    };
    return texts[lang]?.[key] || texts.tr[key] || key;
  };

  let md = `# ${t('title')}\n\n`;
  md += `**${t('date')}:** ${dateStr}\n`;
  md += `**${t('duration')}:** ~${durMin} min\n`;
  md += `**${t('tone')}:** ${tone}\n\n`;
  md += `---\n\n## ${t('transcript')}\n\n`;

  // Transcript lines
  if (Array.isArray(transcriptLines)) {
    for (const line of transcriptLines) {
      md += `${line}\n`;
    }
  } else {
    md += transcriptLines + '\n';
  }

  // Analysis sections
  if (analysis) {
    md += renderAnalysis(analysis, t);
  }

  md += '\n';
  return md;
}

/**
 * Render analysis into Markdown sections
 * Supports all field types from different templates.
 */
function renderAnalysis(analysis, t) {
  let md = '';

  // Summary (present in all templates)
  md += renderSection(t('summary'), analysis.summary);

  // Key topics / topics discussed
  md += renderList(t('topics'), analysis.key_topics || analysis.topics_discussed);

  // Standup: Participants
  if (analysis.participants?.length > 0) {
    md += `\n---\n\n## ${t('participants')}\n\n`;
    for (const p of analysis.participants) {
      md += `### ${p.name}\n`;
      md += `- **${t('yesterday')}:** ${p.yesterday || '—'}\n`;
      md += `- **${t('today')}:** ${p.today || '—'}\n`;
      if (p.blockers) md += `- **${t('blockers')}:** ${p.blockers}\n`;
      md += '\n';
    }
  }

  // Retro: Went Well / Went Wrong / Improvements
  md += renderList(t('well'), analysis.went_well);
  md += renderList(t('wrong'), analysis.went_wrong);
  md += renderList(t('improvements'), analysis.improvements);

  // Decision: Agenda + detailed decisions
  md += renderList(t('agenda'), analysis.agenda_items);

  if (analysis.decisions?.length > 0) {
    md += `\n---\n\n## ${t('decisions')}\n\n`;
    for (const d of analysis.decisions) {
      if (typeof d === 'string') {
        md += `- ${d}\n`;
      } else {
        md += `- **${d.decision}**`;
        if (d.rationale) md += `\n  - ${t('rationale')}: ${d.rationale}`;
        if (d.owner) md += `\n  - ${t('owner')}: ${d.owner}`;
        md += '\n';
      }
    }
  }

  md += renderList(t('deferred'), analysis.deferred_items);

  // Action items (present in all templates)
  if (analysis.action_items?.length > 0) {
    md += `\n---\n\n## ${t('actions')}\n\n`;
    for (const a of analysis.action_items) {
      const ownerLabel = t('owner');
      const owner = a.owner ? ` → ${a.owner}` : '';
      md += `- [ ] ${a.item}${owner}\n`;
    }
  }

  // 1:1: Feedback, growth areas, next topics
  md += renderList(t('feedback'), analysis.feedback);
  md += renderList(t('growth'), analysis.growth_areas);
  md += renderList(t('next'), analysis.next_meeting_topics);

  return md;
}

/**
 * Simple text section
 */
function renderSection(title, content) {
  if (!content) return '';
  return `\n---\n\n## ${title}\n\n${content}\n`;
}

/**
 * List section (hidden if empty)
 */
function renderList(title, items) {
  if (!items || items.length === 0) return '';
  let md = `\n---\n\n## ${title}\n\n`;
  for (const item of items) {
    md += `- ${item}\n`;
  }
  return md;
}

/**
 * Save Markdown file to disk
 */
export function saveMarkdown(content, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `meeting_${getTimestamp()}.md`;
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Markdown → HTML conversion and save
 */
export function saveHtml(markdownContent, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `meeting_${getTimestamp()}.html`;
  const filePath = path.join(outputDir, filename);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Notes</title>
  <style>
    :root { --bg: #0d1117; --fg: #c9d1d9; --accent: #58a6ff; --border: #30363d; --green: #3fb950; --yellow: #d29922; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h2 { color: var(--fg); margin-top: 2rem; }
    hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    strong { color: #f0f6fc; }
    ul { padding-left: 1.5rem; }
    li { margin: 0.3rem 0; }
    code { background: #161b22; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    .transcript { background: #161b22; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); font-family: monospace; font-size: 0.85em; white-space: pre-wrap; }
    .checkbox { color: var(--green); }
    @media (max-width: 600px) { body { padding: 1rem; } }
  </style>
</head>
<body>
${markdownToHtml(markdownContent)}
</body>
</html>`;

  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

/**
 * Simple Markdown → HTML converter
 */
function markdownToHtml(md) {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\*\*(.+?):\*\*\s*(.+)$/gm, '<p><strong>$1:</strong> $2</p>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^- \[ \] (.+)$/gm, '<li><span class="checkbox">☐</span> $1</li>')
    .replace(/^- \[x\] (.+)$/gm, '<li><span class="checkbox">☑</span> $1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n{2,}/g, '\n')
    .replace(/^(?!<[hpuol]|<hr|<li)(.+)$/gm, '<p>$1</p>');
}

/**
 * Timestamp for filenames
 */
function getTimestamp() {
  return new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '');
}

/**
 * Date format: 2025-01-15 14:30
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}
