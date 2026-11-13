/**
 * ai_engine.js
 * AI Stakeholder Simulator & Cross-Examination Engine
 * Grounded in Harvard Business School Case 9-122-051: Carlos Ghosn
 * 
 * Supported Models: gemini-2.5-flash via @google/generative-ai
 * Fallback: Deterministic context-aware offline generator with zero latency.
 */

let GoogleGenerativeAI = null;
try {
  const ggenai = require('@google/generative-ai');
  GoogleGenerativeAI = ggenai.GoogleGenerativeAI;
} catch (err) {
  console.warn('[AI Engine] @google/generative-ai not yet loaded, will use fallback until available.');
}

// Deterministic offline fallbacks grounded in verified HBS Case facts
const CASE_FALLBACKS = {
  // General challenges when no defense text is provided
  stay_general: "You believe staying in Japan is the best way to prove his innocence. But considering the potential 42-month legal process, the >99% conviction rate, 70+ boxes of withheld documents, and complete separation from his wife—while Greg Kelly waited nearly two years just for a hearing and Hiroto Saikawa resigned without charges—are you overlooking the human and procedural reality of this decision?",
  escape_general: "You believe leaving Japan is justified because Ghosn perceived the process as unfair. Yet Ghosn settled U.S. SEC fraud charges over $140M in concealed compensation (paying a $1M fine and accepting a 10-year officer ban) and faced allegations of transferring $17M in personal investment losses to Nissan. Does escaping in an audio box while on bail undermine his claim that he wants justice and destroy executive accountability?",

  // Keyword-triggered defenses for STAY decisions
  stay_keywords: [
    {
      keywords: ['innocen', 'clear', 'name', 'honor', 'truth', 'reput'],
      text: "You argue for clearing your name through the legal system, but with a >99% conviction rate, 130 days of detention without counsel, and judges facing career repercussions for acquittals, are you mistaking Japanese 'hostage justice' for an impartial trial?"
    },
    {
      keywords: ['saikawa', 'equity', 'double standard', 'referent', 'bias', 'unequal'],
      text: "Your appeal to Adams' Equity Theory highlights Hiroto Saikawa's $440k uncharged resignation, but does Saikawa's immunity justify Ghosn transferring $17M in personal swap losses to Nissan and concealing $140M in deferred compensation from shareholders?"
    },
    {
      keywords: ['kelly', 'greg', 'colleague', 'loyalty', 'stand together'],
      text: "Loyalty to Kelly is principled, but staying leaves you both trapped in 42 months of non-overlapping trials while Japanese executives who approved the compensation walked away with zero criminal charges."
    },
    {
      keywords: ['procedur', 'due process', 'law', 'court', 'rule of law', 'legal'],
      text: "While procedural justice demands fighting in court, prosecutors withheld 70+ boxes of exculpatory evidence and delayed trial scheduling past 14 months. How can due process exist when procedural rules are asymmetric?"
    },
    {
      keywords: ['carole', 'wife', 'family', 'human', 'isolation'],
      text: "You stayed despite complete court-ordered separation from Carole. Was enduring years of isolated pre-trial detention a rational executive calculation or martyrdom to pride?"
    }
  ],

  // Keyword-triggered defenses for ESCAPE decisions
  escape_keywords: [
    {
      keywords: ['carole', 'wife', 'family', 'reunit', 'home'],
      text: "Escaping reunited Ghosn with Carole, but within days Japanese prosecutors issued an arrest warrant for Carole herself and Interpol issued a Red Notice, turning Lebanon into an extradition-locked open-air prison."
    },
    {
      keywords: ['innocen', 'frame', 'coup', 'conspir', 'politic', 'merger', 'renault'],
      text: "Even if Nissan executives orchestrated a coup to derail the 2018 Renault merger, internal audits uncovered concrete shell companies and improper private jet usage. Can political motives by your accusers legally excuse fiduciary breach of trust?"
    },
    {
      keywords: ['fair', 'hostage', 'convict', '99%', 'rigged', 'trap'],
      text: "Ghosn argued the system was rigged, yet he settled SEC fraud charges for concealing $140M in compensation. Does fleeing in an audio equipment box exonerate executive misconduct, or does it permanently validate the prosecution's allegations?"
    },
    {
      keywords: ['kelly', 'greg', 'partner', 'friend'],
      text: "You chose escape to regain 70% personal freedom, but you abandoned your former director Greg Kelly to face the Tokyo District Court alone without a passport on $640k bail. What does that say about executive accountability?"
    },
    {
      keywords: ['comp', 'money', 'pay', 'salary', '16:1', 'stock', 'bonus'],
      text: "Ghosn defended his deferred compensation against global auto peer pay, ignoring Japan's 16:1 executive pay norm. Does fleeing to Lebanon prove his pay was earned leadership value, or does it confirm Western executive entitlement?"
    }
  ]
};

/**
 * Deterministic Fallback Generator
 */
function getDeterministicFallback({ decision, majorityDecision, defenseText }) {
  const chosenDecision = (decision || majorityDecision || 'STAY').toUpperCase();
  const textLower = (defenseText || '').toLowerCase().trim();

  if (textLower.length > 0) {
    const list = chosenDecision === 'ESCAPE' ? CASE_FALLBACKS.escape_keywords : CASE_FALLBACKS.stay_keywords;
    for (const item of list) {
      if (item.keywords.some(kw => textLower.includes(kw))) {
        return item.text;
      }
    }
  }

  // General fallback by decision
  if (chosenDecision === 'ESCAPE') {
    return CASE_FALLBACKS.escape_general;
  }
  return CASE_FALLBACKS.stay_general;
}

/**
 * Call Gemini 2.5 Flash with timeout
 */
async function callGeminiFlash({ prompt, apiKey, timeoutMs = 4500 }) {
  if (!GoogleGenerativeAI) {
    const ggenai = require('@google/generative-ai');
    GoogleGenerativeAI = ggenai.GoogleGenerativeAI;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: 
      "You are a Skeptical Nissan Board Member and Japanese Corporate Governance Realist challenging an MBA student's strategic choice in the Carlos Ghosn case (Harvard Business School Case 9-122-051). " +
      "Deliver a sharp, intellectually rigorous 2-3 sentence cross-examination. Ground your rebuttal directly in Organizational Behavior theory (Distributive Justice, Adams' Equity Theory, Procedural Justice, Interactional Justice, or Prospect Theory/Loss Aversion) " +
      "and precise case evidence (such as Hiroto Saikawa's $440k uncharged resignation, Greg Kelly's 2-year pre-trial detention on $640k bail, Japan's >99% conviction rate, 70+ withheld boxes of evidence, 42-month non-overlapping trials, SEC $140M settlement, or Japan's 16:1 CEO pay norm). " +
      "Do NOT use markdown headers or bullet points; write as direct, spoken executive dialogue."
  });

  const generatePromise = model.generateContent(prompt).then(res => res.response.text());

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini API request timed out')), timeoutMs);
  });

  return Promise.race([generatePromise, timeoutPromise]);
}

/**
 * Main AI Challenge Entry Point
 * @param {Object} params
 * @param {string} [params.decision] - 'STAY' | 'ESCAPE'
 * @param {string} [params.majorityDecision] - 'STAY' | 'ESCAPE'
 * @param {string} [params.defenseText] - 1-sentence defense submitted by student
 * @param {string} [params.apiKey] - Optional presenter-supplied runtime key
 * @returns {Promise<{ challengeText: string, source: 'gemini' | 'fallback', model: string, timestamp: string }>}
 */
async function generateAiChallenge({ decision, majorityDecision, defenseText, apiKey } = {}) {
  const effectiveDecision = (decision || majorityDecision || 'STAY').toUpperCase();
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (key && key.trim().length > 0) {
    try {
      let prompt = `The student chose '${effectiveDecision}'. `;
      if (defenseText && defenseText.trim().length > 0) {
        prompt += `The student's 1-sentence defense is: "${defenseText.trim()}". `;
      } else {
        prompt += `Challenge this decision based on the HBS Carlos Ghosn case facts and OB organizational justice theories. `;
      }
      prompt += `Cross-examine this stance from the perspective of a Skeptical Nissan Board Member in 2 to 3 sharp sentences.`;

      const responseText = await callGeminiFlash({ prompt, apiKey: key.trim() });
      if (responseText && responseText.trim().length > 0) {
        return {
          challengeText: responseText.trim(),
          source: 'gemini',
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('[AI Engine] Gemini API call failed or timed out:', err.message, '- Switching to deterministic HBS fallback.');
    }
  }

  // Deterministic Fallback
  const fallbackText = getDeterministicFallback({
    decision: effectiveDecision,
    majorityDecision,
    defenseText
  });

  return {
    challengeText: fallbackText,
    source: 'fallback',
    model: 'hbs-deterministic-engine',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  generateAiChallenge,
  getDeterministicFallback,
  CASE_FALLBACKS
};
