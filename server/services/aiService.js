/**
 * AI Service - Uses Google Gemini API to auto-categorize and prioritize complaints.
 *
 * Why Gemini? Free tier (~15 RPM, 1,500/day) is plenty for a civic reporter app.
 * Get your key at: https://aistudio.google.com/app/apikey
 *
 * Default model is `gemini-2.0-flash` (fastest free model).
 * Override via env var GEMINI_MODEL if needed.
 */

const VALID_CATEGORIES = ['pothole', 'garbage', 'water_leak', 'streetlight', 'other'];

const classifyComplaint = async (title, description) => {
  const fallback = {
    category: 'other',
    severity: 3,
    severityReason: 'Default severity assigned (AI classification unavailable)',
    isDuplicate: false,
    priorityNote: 'Please review manually'
  };

  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set; skipping AI classification');
    return fallback;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const promptText = `You are a civic issue classifier. Analyze this complaint and respond ONLY with a valid JSON object, no markdown, no explanation.
Complaint title: ${title}
Complaint description: ${description}
Respond with exactly this JSON structure:
{
  "category": "pothole" | "garbage" | "water_leak" | "streetlight" | "other",
  "severity": 1-5,
  "severityReason": "one sentence explaining severity",
  "isDuplicate": false,
  "priorityNote": "one sentence for admin"
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API non-OK status:', response.status, errText);
      return fallback;
    }

    const data = await response.json();

    let text = '';
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text
    ) {
      text = data.candidates[0].content.parts[0].text.trim();
    }

    if (!text) return fallback;

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (innerErr) {
          console.error('Could not parse Gemini AI response JSON:', cleaned);
          return fallback;
        }
      } else {
        return fallback;
      }
    }

    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
    let severity = parseInt(parsed.severity, 10);
    if (Number.isNaN(severity) || severity < 1 || severity > 5) severity = 3;

    return {
      category,
      severity,
      severityReason: typeof parsed.severityReason === 'string' ? parsed.severityReason : '',
      isDuplicate: !!parsed.isDuplicate,
      priorityNote: typeof parsed.priorityNote === 'string' ? parsed.priorityNote : ''
    };
  } catch (err) {
    console.error('AI classification error:', err.message);
    return fallback;
  }
};

module.exports = { classifyComplaint };
