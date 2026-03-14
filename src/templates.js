/**
 * Meeting templates — specialized LLM prompts for different meeting types
 */

export const TEMPLATES = {
  default: {
    name: 'General Meeting',
    description: 'Genel toplantı özeti, konular ve aksiyon kalemleri',
    systemPrompt: `You are a professional secretary. Analyze the meeting transcript and respond in the following JSON format.
Return only JSON.

{
  "meeting_title": "Short descriptive title (e.g., Q1 Marketing Planning)",
  "summary": "Meeting summary (2-3 sentences)",
  "key_topics": ["topic1", "topic2"],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "decisions": ["decision1", "decision2"],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Be concise and objective
- Identify speakers if possible`,
  },

  standup: {
    name: 'Daily Standup',
    description: 'Dün/Bugün/Engel takibi',
    systemPrompt: `You are an assistant that analyzes daily standups.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "meeting_title": "Short descriptive title (e.g., Frontend Team Standup - March 15)",
  "summary": "Brief standup summary",
  "participants": [
    { "name": "Name", "yesterday": "Done", "today": "Doing", "blockers": "None/Text" }
  ],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "estimated_duration_min": 0
}`,
  },

  retro: {
    name: 'Retrospective',
    description: 'İyi/Kötü/Gelişim takibi',
    systemPrompt: `You are an assistant that analyzes retrospective meetings.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "meeting_title": "Short descriptive title (e.g., Sprint 12 Retrospective)",
  "summary": "Retro summary",
  "went_well": ["item1"],
  "went_wrong": ["item1"],
  "improvements": ["item1"],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "estimated_duration_min": 0
}`,
  },

  decision: {
    name: 'Decision Meeting',
    description: 'Alınan kararlar ve nedenleri',
    systemPrompt: `You are an assistant that analyzes high-stakes decision meetings.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "meeting_title": "Short descriptive title (e.g., New Tech Stack Decision)",
  "summary": "Decision summary",
  "agenda_items": ["item1"],
  "decisions": [
    { "decision": "Text", "rationale": "Text", "owner": "Name" }
  ],
  "deferred_items": ["item1"],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "estimated_duration_min": 0
}`,
  },

  oneone: {
    name: '1:1 Meeting',
    description: 'Birebir görüşme ve geri bildirim',
    systemPrompt: `You are an assistant that analyzes 1:1 meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "meeting_title": "Short descriptive title (e.g., Mustafa & Manager 1:1)",
  "summary": "Meeting summary (2-3 sentences)",
  "topics_discussed": ["topic1", "topic2"],
  "feedback": ["feedback1"],
  "growth_areas": ["area1"],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "next_meeting_topics": ["topic1"],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Summarize feedback constructively
- Clearly identify growth areas`,
  },
};

const LOCALIZATIONS = {
  tr: {
    names: {
      default: 'Genel Toplantı',
      standup: 'Günlük Standup',
      retro: 'Retrospektif',
      decision: 'Karar Toplantısı',
      oneone: '1:1 Görüşme'
    },
    descriptions: {
      default: 'Genel toplantı özeti, konular ve aksiyon kalemleri',
      standup: 'Dün/Bugün/Engel takibi',
      retro: 'İyi/Kötü/Gelişim takibi',
      decision: 'Alınan kararlar ve nedenleri',
      oneone: 'Birebir görüşme ve geri bildirim'
    }
  },
  en: {
    names: {
      default: 'General Meeting',
      standup: 'Daily Standup',
      retro: 'Retrospective',
      decision: 'Decision Meeting',
      oneone: '1:1 Meeting'
    },
    descriptions: {
      default: 'General meeting summary, topics and action items',
      standup: 'Daily standup: yesterday, today, blockers',
      retro: 'Retrospective: went well, went wrong, improvements',
      decision: 'Decision meeting: agenda, decisions, rationale',
      oneone: '1:1 meeting feedback and growth areas'
    }
  }
};

/**
 * Get system prompt by template name
 */
export function getTemplate(templateName, lang = 'tr') {
  const baseTemplate = TEMPLATES[templateName];
  if (!baseTemplate) {
    const available = Object.keys(TEMPLATES).join(', ');
    throw new Error(`Unknown template: "${templateName}". Available: ${available}`);
  }

  // Clone to avoid mutating original
  const template = { ...baseTemplate };

  const langText = lang === 'en' ? 'ENGLISH' : 'TURKISH (Türkçe)';
  template.systemPrompt += `\n\nCRITICAL: All generated content (summary, items, topics) MUST be in ${langText}. Do not use any other language for the values in the JSON.`;

  // Localize name for the return object
  const loc = LOCALIZATIONS[lang] || LOCALIZATIONS.tr;
  template.name = loc.names[templateName] || template.name;

  return template;
}

/**
 * List available templates
 */
export function listTemplates(lang = 'tr') {
  const loc = LOCALIZATIONS[lang] || LOCALIZATIONS.tr;
  
  return Object.entries(TEMPLATES).map(([key, val]) => {
    return {
      key,
      name: loc.names[key] || val.name,
      description: loc.descriptions[key] || val.description || '',
      icon: getIcon(key)
    };
  });
}

function getIcon(key) {
  const icons = {
    default: '📋',
    standup: '🌅',
    retro: '🔄',
    decision: '⚖️',
    oneone: '👥'
  };
  return icons[key] || '📝';
}
