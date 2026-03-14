/**
 * Meeting templates — specialized LLM prompts for different meeting types
 */

export const TEMPLATES = {
  default: {
    name: 'General Meeting',
    systemPrompt: `You are an assistant that analyzes meeting transcripts.
Analyze the given transcript and respond in the following JSON format.
Return only JSON, nothing else.

{
  "summary": "2-3 sentence summary of the meeting",
  "key_topics": ["topic1", "topic2"],
  "action_items": [{"item": "task description", "owner": "responsible person or empty"}],
  "decisions": ["decision1", "decision2"],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Extract speaker names from the transcript
- If the responsible person for an action item is unknown, leave "owner" empty
- Estimate duration from transcript length (minutes ~ words/150)
- Tone can be: positive, neutral, or tense`,
  },

  standup: {
    name: 'Daily Standup',
    systemPrompt: `You are an assistant that analyzes daily standup meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "summary": "Standup summary (1-2 sentences)",
  "participants": [
    {
      "name": "Person name or S0/S1/S2",
      "yesterday": "What they did yesterday",
      "today": "What they plan to do today",
      "blockers": "Blockers or empty"
    }
  ],
  "action_items": [{"item": "task", "owner": "person or empty"}],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Extract yesterday/today/blockers for each participant
- Keep the summary concise`,
  },

  retro: {
    name: 'Retrospective',
    systemPrompt: `You are an assistant that analyzes retrospective meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "summary": "Retro summary (1-2 sentences)",
  "went_well": ["item1", "item2"],
  "went_wrong": ["item1", "item2"],
  "improvements": ["suggestion1", "suggestion2"],
  "action_items": [{"item": "task", "owner": "person or empty"}],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Clearly separate "Went Well", "Went Wrong", and "Improvements"
- Make action items concrete and measurable`,
  },

  decision: {
    name: 'Decision Meeting',
    systemPrompt: `You are an assistant that analyzes decision meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "summary": "Meeting summary (2-3 sentences)",
  "agenda_items": ["item1", "item2"],
  "decisions": [
    {
      "decision": "The decision made",
      "rationale": "Why this decision was made",
      "owner": "Who will implement it"
    }
  ],
  "deferred_items": ["topic1"],
  "action_items": [{"item": "task", "owner": "person or empty"}],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Always include rationale for decisions
- List deferred items separately`,
  },

  oneone: {
    name: '1:1 Meeting',
    description: 'Birebir görüşme ve geri bildirim',
    systemPrompt: `You are an assistant that analyzes 1:1 meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
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
