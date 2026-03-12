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
    systemPrompt: `You are an assistant that analyzes 1:1 meeting notes.
Analyze the given transcript and respond in the following JSON format.
Return only JSON.

{
  "summary": "Meeting summary (2-3 sentences)",
  "topics_discussed": ["topic1", "topic2"],
  "feedback": ["feedback1"],
  "growth_areas": ["area1"],
  "action_items": [{"item": "task", "owner": "person or empty"}],
  "next_meeting_topics": ["topic1"],
  "tone": "positive | neutral | tense",
  "estimated_duration_min": 0
}

Rules:
- Summarize feedback constructively
- Clearly identify growth areas`,
  },
};

/**
 * Get system prompt by template name
 */
export function getTemplate(templateName) {
  const template = TEMPLATES[templateName];
  if (!template) {
    const available = Object.keys(TEMPLATES).join(', ');
    throw new Error(`Unknown template: "${templateName}". Available: ${available}`);
  }
  return template;
}

/**
 * List available templates
 */
export function listTemplates() {
  return Object.entries(TEMPLATES).map(([key, val]) => ({
    key,
    name: val.name,
  }));
}
