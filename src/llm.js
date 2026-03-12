import fetch from 'node-fetch';
import { getTemplate } from './templates.js';

/**
 * LLM ile toplantı transkriptini analiz et
 * Template desteği ile farklı toplantı türleri için farklı prompt kullanır.
 */
export async function summarizeTranscript(transcript, config) {
  const template = getTemplate(config.template || 'default');
  const url = `${config.baseUrl}/chat/completions`;

  const body = {
    model: config.llmModel,
    messages: [
      { role: 'system', content: template.systemPrompt },
      { role: 'user', content: `Aşağıdaki toplantı transkriptini analiz et:\n\n${transcript}` },
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
    throw new Error(`LLM API hatası (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(content);
  } catch {
    // JSON parse hata verirse ham metni özet alanına koy
    return {
      ozet: content,
      ana_konular: [],
      aksiyonlar: [],
      kararlar: [],
      ton: 'nötr',
      tahmini_sure_dk: 0,
    };
  }
}
