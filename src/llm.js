import fetch from 'node-fetch';
import { getTemplate } from './templates.js';

/**
 * Analyze meeting transcript with LLM
 * Uses template system to apply different prompts for different meeting types.
 */
export async function summarizeTranscript(transcript, config) {
  const template = getTemplate(config.template || 'default', config.lang || 'tr');
  const url = `${config.baseUrl}/chat/completions`;

  const body = {
    model: config.llmModel,
    messages: [
      { role: 'system', content: template.systemPrompt },
      { role: 'user', content: `Analyze the following meeting transcript:\n\n${transcript}` },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(content);
  } catch {
    // If JSON parsing fails, put raw text in summary field
    return {
      summary: content,
      key_topics: [],
      action_items: [],
      decisions: [],
      tone: 'neutral',
      estimated_duration_min: 0,
    };
  }
}
