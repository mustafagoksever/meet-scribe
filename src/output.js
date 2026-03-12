import fs from 'fs';
import path from 'path';

/**
 * Markdown toplantı dosyası üret
 */
export function generateMarkdown(transcriptLines, analysis, startTime) {
  const now = startTime || new Date();
  const dateStr = formatDateTR(now);
  const sureDk = analysis?.tahmini_sure_dk || '?';
  const ton = analysis?.ton || 'nötr';

  let md = `# Toplantı Transkripti

**Tarih:** ${dateStr}
**Süre:** ~${sureDk} dk
**Ton:** ${ton}

---

## 📝 Transkript

`;

  // Transkript satırları
  if (Array.isArray(transcriptLines)) {
    for (const line of transcriptLines) {
      md += `${line}\n`;
    }
  } else {
    md += transcriptLines + '\n';
  }

  // Analiz bölümleri
  if (analysis) {
    md += renderAnalysis(analysis);
  }

  md += '\n';
  return md;
}

/**
 * Analiz sonuçlarını Markdown bölümlerine dönüştür
 * Farklı şablonlardan gelen tüm alan türlerini destekler.
 */
function renderAnalysis(analysis) {
  let md = '';

  // Özet (tüm şablonlarda var)
  md += renderSection('📌 Özet', analysis.ozet || 'Özet oluşturulamadı.');

  // Ana konular / tartışılan konular
  md += renderList('🗂 Ana Konular', analysis.ana_konular || analysis.tartisilan_konular);

  // Standup: Katılımcılar
  if (analysis.katilimcilar?.length > 0) {
    md += '\n---\n\n## 👥 Katılımcılar\n\n';
    for (const k of analysis.katilimcilar) {
      md += `### ${k.isim}\n`;
      md += `- **Dün:** ${k.dun_yapilan || '—'}\n`;
      md += `- **Bugün:** ${k.bugun_planli || '—'}\n`;
      if (k.engeller) md += `- **Engel:** ${k.engeller}\n`;
      md += '\n';
    }
  }

  // Retro: İyi/Kötü/İyileştirme
  md += renderList('😊 İyi Gidenler', analysis.iyi_gidenler);
  md += renderList('😟 Kötü Gidenler', analysis.kotu_gidenler);
  md += renderList('💡 İyileştirmeler', analysis.iyilestirmeler);

  // Decision: Gündem + detaylı kararlar
  md += renderList('📋 Gündem Maddeleri', analysis.gundem_maddeleri);

  if (analysis.kararlar?.length > 0) {
    md += '\n---\n\n## ⚖️ Alınan Kararlar\n\n';
    for (const karar of analysis.kararlar) {
      if (typeof karar === 'string') {
        md += `- ${karar}\n`;
      } else {
        md += `- **${karar.karar}**`;
        if (karar.gerekce) md += `\n  - Gerekçe: ${karar.gerekce}`;
        if (karar.sorumlu) md += `\n  - Sorumlu: ${karar.sorumlu}`;
        md += '\n';
      }
    }
  }

  md += renderList('⏳ Ertelenen Konular', analysis.ertelenen_konular);

  // Aksiyon maddeleri (tüm şablonlarda var)
  if (analysis.aksiyonlar?.length > 0) {
    md += '\n---\n\n## ✅ Aksiyon Maddeleri\n\n';
    for (const aksiyon of analysis.aksiyonlar) {
      const sahip = aksiyon.sahip ? ` → ${aksiyon.sahip}` : '';
      md += `- [ ] ${aksiyon.madde}${sahip}\n`;
    }
  }

  // 1:1: Geri bildirimler, gelişim, sonraki konular
  md += renderList('💬 Geri Bildirimler', analysis.geri_bildirimler);
  md += renderList('📈 Gelişim Alanları', analysis.gelisim_alanlari);
  md += renderList('📅 Sonraki Görüşme Konuları', analysis.sonraki_gorusme_konulari);

  return md;
}

/**
 * Basit metin bölümü
 */
function renderSection(title, content) {
  if (!content) return '';
  return `\n---\n\n## ${title}\n\n${content}\n`;
}

/**
 * Liste bölümü (boşsa göstermez)
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
 * Markdown dosyasını diske kaydet
 */
export function saveMarkdown(content, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `toplanti_${getTimestamp()}.md`;
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Markdown → HTML dönüşümü ve kaydetme
 */
export function saveHtml(markdownContent, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `toplanti_${getTimestamp()}.html`;
  const filePath = path.join(outputDir, filename);

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toplantı Notu</title>
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
 * Basit Markdown → HTML dönüştürücü
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
 * Dosya adı için timestamp
 */
function getTimestamp() {
  return new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '');
}

/**
 * Türkçe tarih formatı: 15.01.2025 14:30
 */
function formatDateTR(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${d}.${m}.${y} ${h}:${min}`;
}
