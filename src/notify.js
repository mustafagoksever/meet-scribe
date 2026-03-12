import fetch from 'node-fetch';
import chalk from 'chalk';

/**
 * Send message to Zulip
 */
export async function sendToZulip(config, content) {
  if (!config.zulipUrl || !config.zulipEmail || !config.zulipApiKey) {
    throw new Error('Zulip config incomplete. zulipUrl, zulipEmail, and zulipApiKey are required.');
  }

  const url = `${config.zulipUrl.replace(/\/+$/, '')}/api/v1/messages`;
  const stream = config.zulipStream || 'general';
  const topic = config.zulipTopic || 'Meeting Notes';

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
    throw new Error(`Zulip API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Send generic webhook POST
 */
export async function sendToWebhook(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook error (${response.status}): ${errorText}`);
  }

  return true;
}

/**
 * Send meeting results as notifications (Zulip and/or webhook)
 */
export async function sendNotifications(config, analysis, markdownContent) {
  const results = [];

  // Zulip
  if (config.zulipUrl) {
    try {
      const zulipContent = formatForZulip(analysis);
      await sendToZulip(config, zulipContent);
      console.log(chalk.green('✓ Zulip message sent'));
      results.push({ type: 'zulip', success: true });
    } catch (err) {
      console.error(chalk.yellow(`⚠ Zulip error: ${err.message}`));
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
      console.log(chalk.green('✓ Webhook sent'));
      results.push({ type: 'webhook', success: true });
    } catch (err) {
      console.error(chalk.yellow(`⚠ Webhook error: ${err.message}`));
      results.push({ type: 'webhook', success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Format analysis for Zulip message
 */
function formatForZulip(analysis) {
  if (!analysis) return '📝 New meeting transcript saved (no summary generated).';

  let msg = `## 📝 Meeting Summary\n\n`;
  msg += `${analysis.summary || 'No summary available'}\n\n`;

  if (analysis.tone) {
    msg += `**Tone:** ${analysis.tone}\n\n`;
  }

  if (analysis.key_topics?.length > 0) {
    msg += `### 🗂 Key Topics\n`;
    for (const t of analysis.key_topics) {
      msg += `- ${t}\n`;
    }
    msg += '\n';
  }

  if (analysis.action_items?.length > 0) {
    msg += `### ✅ Action Items\n`;
    for (const a of analysis.action_items) {
      const owner = a.owner ? ` → **${a.owner}**` : '';
      msg += `- [ ] ${a.item}${owner}\n`;
    }
    msg += '\n';
  }

  if (analysis.decisions?.length > 0) {
    msg += `### ⚖️ Decisions\n`;
    for (const d of analysis.decisions) {
      const text = typeof d === 'string' ? d : d.decision;
      msg += `- ${text}\n`;
    }
  }

  return msg;
}
