import fetch from 'node-fetch';
import chalk from 'chalk';

/**
 * Zulip'e mesaj gönder
 */
export async function sendToZulip(config, content) {
  if (!config.zulipUrl || !config.zulipEmail || !config.zulipApiKey) {
    throw new Error('Zulip ayarları eksik. zulipUrl, zulipEmail ve zulipApiKey gerekli.');
  }

  const url = `${config.zulipUrl.replace(/\/+$/, '')}/api/v1/messages`;
  const stream = config.zulipStream || 'general';
  const topic = config.zulipTopic || 'Toplantı Notları';

  const body = new URLSearchParams({
    type: 'stream',
    to: stream,
    topic: topic,
    content: content,
  });

  const auth = Buffer.from(`${config.zulipEmail}:${config.zulipApiKey}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zulip API hatası (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Generic webhook'a POST gönder
 */
export async function sendToWebhook(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook hatası (${response.status}): ${errorText}`);
  }

  return true;
}

/**
 * Toplantı sonuçlarını bildirim olarak gönder (Zulip ve/veya webhook)
 */
export async function sendNotifications(config, analysis, markdownContent) {
  const results = [];

  // Zulip
  if (config.zulipUrl) {
    try {
      const zulipContent = formatForZulip(analysis);
      await sendToZulip(config, zulipContent);
      console.log(chalk.green('✓ Zulip mesajı gönderildi'));
      results.push({ type: 'zulip', success: true });
    } catch (err) {
      console.error(chalk.yellow(`⚠ Zulip hatası: ${err.message}`));
      results.push({ type: 'zulip', success: false, error: err.message });
    }
  }

  // Webhook
  if (config.webhook) {
    try {
      const payload = {
        event: 'meeting_completed',
        timestamp: new Date().toISOString(),
        analysis,
        markdown: markdownContent,
      };
      await sendToWebhook(config.webhook, payload);
      console.log(chalk.green('✓ Webhook gönderildi'));
      results.push({ type: 'webhook', success: true });
    } catch (err) {
      console.error(chalk.yellow(`⚠ Webhook hatası: ${err.message}`));
      results.push({ type: 'webhook', success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Zulip için formatlı mesaj oluştur
 */
function formatForZulip(analysis) {
  if (!analysis) return '📝 Yeni toplantı transkripti kaydedildi (özet oluşturulamadı).';

  let msg = `## 📝 Toplantı Özeti\n\n`;
  msg += `${analysis.ozet || 'Özet yok'}\n\n`;

  if (analysis.ton) {
    msg += `**Ton:** ${analysis.ton}\n\n`;
  }

  if (analysis.ana_konular?.length > 0) {
    msg += `### 🗂 Ana Konular\n`;
    for (const konu of analysis.ana_konular) {
      msg += `- ${konu}\n`;
    }
    msg += '\n';
  }

  if (analysis.aksiyonlar?.length > 0) {
    msg += `### ✅ Aksiyon Maddeleri\n`;
    for (const a of analysis.aksiyonlar) {
      const sahip = a.sahip ? ` → **${a.sahip}**` : '';
      msg += `- [ ] ${a.madde}${sahip}\n`;
    }
    msg += '\n';
  }

  if (analysis.kararlar?.length > 0) {
    msg += `### ⚖️ Kararlar\n`;
    for (const k of analysis.kararlar) {
      const text = typeof k === 'string' ? k : k.karar;
      msg += `- ${text}\n`;
    }
  }

  return msg;
}
