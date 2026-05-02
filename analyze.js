// api/analyze.js — TikTok Analyzer Pro
// Utilise Claude (Anthropic) en priorité, OpenAI en fallback, Gemini en dernier recours
// Optimisé pour Vercel : timeout court, réponse rapide

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });

  try {
    const body = req.body || {};

    // Test de connexion rapide
    if (body.action === 'test') {
      return res.status(200).json({
        ok: true,
        provider: body.claudeKey ? 'claude' : body.openaiKey ? 'openai' : body.geminiKey ? 'gemini' : 'none'
      });
    }

    const report = await makeReport(body);
    return res.status(200).json({ ok: true, report });

  } catch (e) {
    console.error('Analyze error:', e.message);
    return res.status(200).json({ ok: false, error: e.message, report: fallback(req.body || {}) });
  }
}

// ─── PROMPT EXPERT TIKTOK ────────────────────────────────────────────────────
function buildPrompt(b) {
  return `Tu es un expert TikTok senior spécialisé dans la niche famille/lifestyle/drama. Tu analyses des vidéos avec une précision chirurgicale, seconde par seconde. Tu t'adresses à un créateur qui veut maximiser ses vues et sa monétisation TikTok.

VIDÉO À ANALYSER:
- Nom: ${b.videoName || 'sans nom'}
- Type: ${b.contentType || 'famille/drama'}
- Hook actuel: "${b.hook || 'non précisé'}"
- Durée: ~${b.duration || 90} secondes
- Frames analysées: ${Array.isArray(b.frames) ? b.frames.length : 0} images extraites

RÈGLES IMPORTANTES:
- Donne des scores DIFFÉRENTS selon la vidéo (utilise toute l'échelle 4-10, pas toujours 7-8)
- Sois PRÉCIS avec des timestamps: "à 0:03", "entre 0:15 et 0:22", etc.
- Donne des phrases EXACTES à dire, pas des conseils vagues
- Adapte l'analyse à la niche famille/drama/lifestyle
- Les vidéos >1min sont payées double sur TikTok → toujours le mentionner si pertinent

Réponds UNIQUEMENT en JSON valide, zéro texte autour, zéro backtick:
{
  "score": <entier 40-97>,
  "potential": "<une phrase courte sur le potentiel viral>",
  "summaryTitle": "<titre accrocheur du résumé>",
  "summaryText": "<résumé expert de 3-4 phrases, concret et pédagogique>",
  "scores": {
    "hook": <4-10>,
    "rhythm": <4-10>,
    "clarity": <4-10>,
    "cta": <4-10>,
    "emotion": <4-10>,
    "thumbnail": <4-10>
  },
  "hookScores": {
    "start": <4-10>,
    "middle": <4-10>,
    "end": <4-10>,
    "retention": <4-10>
  },
  "cards": {
    "hook": "<analyse du hook avec timestamp précis et phrase alternative prête>",
    "rhythm": "<analyse du rythme avec secondes précises où ça décroche>",
    "clarity": "<est-ce qu'on comprend sans contexte ? Quoi changer ?>",
    "cta": "<analyse du call-to-action avec proposition de phrase exacte>"
  },
  "deep": {
    "global": "<analyse globale experte, 3-4 phrases, comme Videlyze>",
    "hookStart": "<analyse 0-3s avec timestamp et réécriture proposée>",
    "hookMiddle": "<analyse du milieu avec timestamp et relance proposée>",
    "hookEnd": "<analyse fin avec timestamp et chute proposée>",
    "subtitles": "<analyse sous-titres: taille, couleur, timing, corrections>",
    "sound": "<analyse audio: voix, effets, musique, corrections>"
  },
  "timeline": [
    ["0–1 sec", "<ce qui se passe + conseil précis>"],
    ["1–3 sec", "<ce qui se passe + conseil précis>"],
    ["3–6 sec", "<ce qui se passe + conseil précis>"],
    ["6–10 sec", "<ce qui se passe + conseil précis>"],
    ["10–18 sec", "<ce qui se passe + conseil précis>"],
    ["18–30 sec", "<ce qui se passe + conseil précis>"],
    ["Milieu", "<relance émotionnelle + conseil>"],
    ["10 sec avant la fin", "<annonce chute + conseil>"],
    ["Dernières secondes", "<CTA exact à dire>"]
  ],
  "hooks": [
    "<hook viral 1 — prêt à utiliser>",
    "<hook viral 2>",
    "<hook viral 3>",
    "<hook viral 4>",
    "<hook viral 5>"
  ],
  "actions": [
    "<action prioritaire 1 — très concrète>",
    "<action 2>",
    "<action 3>",
    "<action 4>",
    "<action 5>"
  ],
  "rewrite": [
    "<réécriture hook>",
    "<réécriture milieu>",
    "<réécriture fin>",
    "<réécriture titre TikTok>"
  ],
  "titres": [
    "<titre TikTok viral 1 — max 80 chars>",
    "<titre 2>",
    "<titre 3>",
    "<titre 4>",
    "<titre 5>"
  ],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"],
  "pubHeure": "<ex: Vendredi 19h30>",
  "pubRaison": "<pourquoi cet horaire pour cette niche>",
  "miniature": {
    "texte": "<TEXTE EN GROS max 5 mots>",
    "couleurs": "<ex: fond rouge vif, texte blanc contour noir>",
    "scene": "<quelle scène exacte capturer>"
  },
  "checklist": [
    "<point à vérifier 1>",
    "<point 2>",
    "<point 3>",
    "<point 4>",
    "<point 5>"
  ],
  "errorsToAvoid": [
    "<erreur à éviter 1>",
    "<erreur 2>",
    "<erreur 3>"
  ],
  "beginner": {
    "do": ["<conseil 1>", "<conseil 2>", "<conseil 3>", "<conseil 4>", "<conseil 5>"],
    "dont": ["<à éviter 1>", "<à éviter 2>", "<à éviter 3>", "<à éviter 4>", "<à éviter 5>"]
  }
}`;
}

// ─── MAKE REPORT ─────────────────────────────────────────────────────────────
async function makeReport(b) {
  const prompt = buildPrompt(b);

  // 1. CLAUDE (Anthropic) — priorité absolue
  if (b.claudeKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': b.claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          temperature: 0,
          system: 'Tu es expert TikTok senior. Tu réponds UNIQUEMENT en JSON valide, sans backticks, sans texte avant ou après.',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      const txt = data.content?.[0]?.text;
      if (txt) {
        const cleaned = txt.replace(/```json|```/g, '').trim();
        return normalize(JSON.parse(cleaned), fallback(b));
      }
    } catch (e) {
      console.warn('Claude error:', e.message);
    }
  }

  // 2. OPENAI — fallback
  if (b.openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${b.openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Expert TikTok senior. JSON uniquement.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await r.json();
      const txt = data.choices?.[0]?.message?.content;
      if (txt) return normalize(JSON.parse(txt), fallback(b));
    } catch (e) {
      console.warn('OpenAI error:', e.message);
    }
  }

  // 3. GEMINI — dernier recours
  if (b.geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${b.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' }
          })
        }
      );
      const data = await r.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return normalize(JSON.parse(txt), fallback(b));
    } catch (e) {
      console.warn('Gemini error:', e.message);
    }
  }

  // Aucune API disponible → fallback local
  return fallback(b);
}

// ─── NORMALIZE ───────────────────────────────────────────────────────────────
function normalize(r, base) {
  return {
    ...base, ...r,
    scores: { ...base.scores, ...(r.scores || {}) },
    hookScores: { ...base.hookScores, ...(r.hookScores || {}) },
    cards: { ...base.cards, ...(r.cards || {}) },
    deep: { ...base.deep, ...(r.deep || {}) },
    beginner: { ...base.beginner, ...(r.beginner || {}) },
    miniature: { ...base.miniature, ...(r.miniature || {}) },
    timeline: (r.timeline?.length) ? r.timeline : base.timeline,
    hooks: (r.hooks?.length) ? r.hooks : base.hooks,
    titres: (r.titres?.length) ? r.titres : base.titres,
    hashtags: (r.hashtags?.length) ? r.hashtags : base.hashtags,
    actions: (r.actions?.length) ? r.actions : base.actions,
    rewrite: (r.rewrite?.length) ? r.rewrite : base.rewrite,
    checklist: (r.checklist?.length) ? r.checklist : base.checklist,
    errorsToAvoid: (r.errorsToAvoid?.length) ? r.errorsToAvoid : base.errorsToAvoid,
  };
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────
function fallback(b) {
  return {
    score: 72,
    potential: 'Potentiel correct — analyse partielle (API non disponible)',
    summaryTitle: 'Configure une clé API pour obtenir une analyse réelle',
    summaryText: 'Cette analyse est générée localement car aucune clé API n\'a répondu. Pour une analyse précise seconde par seconde, assure-toi que ta clé Claude ou OpenAI est bien configurée dans les paramètres.',
    scores: { hook: 7, rhythm: 7, clarity: 7, cta: 6, emotion: 7, thumbnail: 6 },
    hookScores: { start: 6, middle: 7, end: 6, retention: 7 },
    cards: {
      hook: 'Configure ta clé API pour obtenir une analyse précise du hook.',
      rhythm: 'Configure ta clé API pour l\'analyse du rythme.',
      clarity: 'Configure ta clé API pour l\'analyse de la clarté.',
      cta: 'Configure ta clé API pour l\'analyse du call-to-action.'
    },
    deep: {
      global: 'Analyse locale — clé API non disponible. Va dans les paramètres et vérifie que ta clé Claude est bien enregistrée.',
      hookStart: 'Non analysé — clé API requise.',
      hookMiddle: 'Non analysé — clé API requise.',
      hookEnd: 'Non analysé — clé API requise.',
      subtitles: 'Non analysé — clé API requise.',
      sound: 'Non analysé — clé API requise.'
    },
    timeline: [
      ['0–1 sec', 'Commence par le moment le plus fort immédiatement.'],
      ['1–3 sec', 'Présente le contexte en une seule phrase.'],
      ['3–6 sec', 'Relance visuelle : zoom, texte ou bruitage.'],
      ['6–10 sec', 'Micro-hook : empêche le scroll.'],
      ['10–18 sec', 'Coupe les longueurs inutiles.'],
      ['18–30 sec', 'Prépare la suite.'],
      ['Milieu', 'Relance émotionnelle.'],
      ['10 sec avant la fin', 'Annonce la chute.'],
      ['Dernières secondes', 'Question commentaire.']
    ],
    hooks: [
      'Ça a dégénéré direct…',
      'Attends sa réaction, elle change tout…',
      'Personne n\'avait prévu cette réponse.',
      'Tu aurais fait quoi à sa place ?',
      'S1 EP2 : tu veux voir la suite ?'
    ],
    titres: [
      'Ça a dégénéré direct… (résultat inattendu)',
      'Elle pensait avoir raison… jusqu\'à là',
      'La réaction que personne n\'attendait',
      'Il a dit ça devant tout le monde 😱',
      'Suite de l\'épisode qui a choqué tout le monde'
    ],
    hashtags: ['#famille', '#drama', '#tiktokfr', '#couple', '#reaction', '#viral', '#lifestyle', '#humour'],
    pubHeure: 'Vendredi 19h30',
    pubRaison: 'Audience maximale en soirée semaine pour niche famille/drama',
    miniature: { texte: 'ÇA A DÉGÉNÉRÉ', couleurs: 'Fond rouge, texte blanc, contour noir', scene: 'Expression de surprise ou dispute' },
    actions: [
      'Renforcer la première phrase.',
      'Ajouter une relance toutes les 6-10 secondes.',
      'Couper les blancs et hésitations.',
      'Mettre des sous-titres gros et lisibles.',
      'Terminer par une question simple.'
    ],
    rewrite: [
      'Hook : "Là, ça devait être calme… mais ça a dégénéré."',
      'Milieu : "Et là, tout le monde bloque."',
      'Fin : "Tu aurais répondu quoi ?"',
      'Titre : "Il pensait avoir raison… jusqu\'à cette réponse."'
    ],
    checklist: [
      'Hook dans les 3 premières secondes ?',
      'Relance avant 10 secondes ?',
      'Sous-titres lisibles sur mobile ?',
      'Fin avec une question ?',
      'Miniature claire en 1 seconde ?'
    ],
    errorsToAvoid: ['Intro trop lente.', 'Texte trop petit.', 'Fin sans CTA.'],
    beginner: {
      do: ['Commence fort.', 'Explique simplement.', 'Relance souvent.', 'Sous-titres gros.', 'Finis par une question.'],
      dont: ['Ne commence pas lentement.', 'Ne surcharge pas.', 'Ne laisse pas de blanc.', 'Ne fais pas miniature chargée.', 'Ne termine pas sans CTA.']
    }
  };
}
