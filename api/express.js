const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.json({
      ok: true,
      service: 'TikTok Analyzer Pro - ANALYSE EXPRESS V2026',
      geminiKey: Boolean(process.env.GEMINI_API_KEY),
      activeModels: GEMINI_MODELS,
      requiredEnv: ['GEMINI_API_KEY'],
      mode: 'express'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Methode non autorisee' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Cle Gemini manquante dans Vercel : GEMINI_API_KEY');
    }

    const body = req.body || {};
    const maxFrames = 12;
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, maxFrames) : [];

    console.log('BODY RECU EXPRESS:', {
      hasBody: Boolean(req.body),
      framesType: Array.isArray(body.frames),
      framesLength: body.frames?.length,
      firstFrameKeys: body.frames?.[0] ? Object.keys(body.frames[0]) : null
    });

    if (!frames.length) {
      throw new Error('Aucune image video recue. Reessaie avec une video plus legere.');
    }

    const report = await analyzeWithGemini({
      frames,
      fileName: body.fileName,
      durationGoal: body.durationGoal,
      postRhythm: body.postRhythm,
      manualTranscript: body.manualTranscript,
      channel: body.channel
    });

    const normalized = normalizeAndScore(report);
    return res.json({ ok: true, report: normalized });

  } catch (err) {
    console.error('ERREUR ANALYSE EXPRESS:', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

// =========================================================================
// ANALYSE EXPRESS V2026
// =========================================================================

async function analyzeWithGemini({ frames, fileName, durationGoal, postRhythm, manualTranscript, channel }) {
  const systemPrompt = buildExpressSystemPrompt();
  const userPrompt = buildExpressUserPrompt({ fileName, durationGoal, postRhythm, manualTranscript, channel });
  const parts = buildGeminiParts(systemPrompt, userPrompt, frames);

  let lastError = '';

  for (const model of GEMINI_MODELS) {
    try {
      const firstText = await callGemini(model, parts);
      let report = parseJsonLoose(firstText);

      if (!isGoodAnalysis(report)) {
        const retryPrompt = `
REFAIS L'ANALYSE.

Tu as répondu trop court ou incomplet.

Obligation :
- chaque bloc d'analyse doit faire au minimum 8 lignes utiles ;
- pas seulement des scores ;
- analyse réellement les images reçues ;
- parle des secondes précises ;
- donne un vrai plan d'action ;
- donne une vraie nouvelle proposition de speech complète ;
- JSON valide uniquement.
`;

        const retryParts = buildGeminiParts(systemPrompt, userPrompt + '\n\n' + retryPrompt, frames);
        const secondText = await callGemini(model, retryParts);
        const secondReport = parseJsonLoose(secondText);

        if (isGoodAnalysis(secondReport)) {
          report = secondReport;
        }
      }

      return report;

    } catch (e) {
      lastError = e.message;
      console.warn('Gemini model failed:', e.message);
    }
  }

  throw new Error('Gemini impossible : ' + lastError);
}

function buildExpressSystemPrompt() {
  return `
TU ES LE CONSEIL DES AGENTS EXPERTS STYLE VIDELYZE PRO, VERSION MARSEILLAISE.

L'ÉQUIPE :

1. L'AGENT PSYCHO-SCROLL :
Il analyse pourquoi l'œil s'arrête ou repart.
Il explique ce que le cerveau comprend dans les 3 premières secondes.

2. L'AGENT RÉTENTION :
Il analyse le rythme, les blancs, les changements visuels, les zooms, les coupures, les moments faibles.
Il déteste les longueurs.

3. L'AGENT STORYTELLING :
Il analyse la narration, la tension, la chute, le comique, le conflit, l'émotion.

4. L'AGENT COACH :
Il parle cash au créateur.
Il donne des actions concrètes, simples, prêtes à appliquer.

TON STYLE :
Marseillais, humain, direct, professionnel, ultra-précis.
Tu dois produire une analyse de haut niveau, comme un vrai rapport premium.

OBLIGATION ABSOLUE :
Tu ne dois jamais répondre seulement avec des scores.
Tu dois écrire une vraie analyse longue.
Chaque section d'analyse doit contenir au minimum 8 lignes utiles.
Chaque section doit être précise, argumentée, humaine et exploitable.

STRUCTURE OBLIGATOIRE DANS CHAQUE GRAND BLOC :

🎯 CE QU'ON VOIT :
Décris précisément ce qui apparaît dans la vidéo, avec les secondes.

🧠 CE QUE LE CERVEAU COMPREND :
Explique l'effet psychologique sur le spectateur.

⚠️ LE PROBLÈME :
Explique ce qui peut faire décrocher ou scroller.

✅ L'ACTION :
Donne une action concrète : couper, zoomer, ajouter texte, raccourcir, déplacer, renforcer.

💡 POURQUOI ÇA MARCHE :
Explique pourquoi cette correction améliore la rétention ou la viralité.

RÈGLES DE SCORING :
- Chaque vidéo doit avoir ses propres scores.
- Ne recopie jamais les scores d'exemple.
- N'utilise jamais 8.1 par défaut.
- Les sous-scores doivent être variés.
- Interdiction de mettre tous les scores identiques.
- Si la vidéo est faible : 3 à 6.
- Si la vidéo est correcte : 6 à 7.5.
- Si la vidéo est très bonne : 7.6 à 9.
- Si elle est exceptionnelle : au-dessus de 9, mais rarement.

INTERDICTIONS :
- Ne jamais utiliser le mot "vz-time".
- Ne jamais utiliser de balises HTML.
- Ne jamais utiliser "<u>".
- Ne pas utiliser Hook, dire Accroche.
- Ne pas utiliser CTA, dire Appel à l'action.
- Répondre uniquement en JSON valide.
`;
}

function buildExpressUserPrompt({ fileName, durationGoal, postRhythm, manualTranscript, channel }) {
  return `
Fichier : ${fileName || 'video'}
Style chaîne : ${channel?.style || 'Drama / Humour'}
Objectif durée : ${durationGoal || 'Non précisé'}
Rythme publication : ${postRhythm || 'Non précisé'}
Transcription fournie : ${manualTranscript || 'Aucune transcription fournie. Analyse les images clés.'}

MISSION :
Tu dois produire un vrai rapport d'analyse vidéo complet, proche d'un rapport Videlyze Pro.

IMPORTANT :
- Ne fais pas une réponse courte.
- Ne fais pas seulement du scoring.
- Chaque analyse doit être longue, précise et utile.
- Tu dois parler des secondes visibles dans les images clés.
- Tu dois proposer une nouvelle version de speech complète.
- Les scores doivent être réalistes selon CETTE vidéo.

Réponds exactement avec ce JSON :

{
  "score": "nombre réel entre 1 et 10",
  "score_global": "nombre réel entre 1 et 10",

  "verdict": "Verdict humain, cash, détaillé, 5 à 8 lignes minimum.",
  "potentiel": "Analyse du potentiel réel de la vidéo, 6 à 10 lignes minimum.",

  "scores": {
    "hook": "nombre réel",
    "visual": "nombre réel",
    "virality": "nombre réel",
    "coherence": "nombre réel",
    "retention": "nombre réel",
    "emotion": "nombre réel"
  },

  "analyse_hook": "Analyse longue de l'accroche 0-3 secondes. Minimum 8 lignes. Utilise 🎯 CE QU'ON VOIT, 🧠 CE QUE LE CERVEAU COMPREND, ⚠️ LE PROBLÈME, ✅ L'ACTION, 💡 POURQUOI ÇA MARCHE.",
  
  "dynamisme_visuel": "Analyse longue du rythme visuel. Minimum 8 lignes. Analyse les changements, zooms, textes, mouvements, plans faibles et plans forts.",
  
  "script_storytelling": "Analyse longue du script et de la narration. Minimum 8 lignes. Explique le conflit, la tension, la chute, ce qu'il faut réécrire.",
  
  "potentiel_viral": "Analyse longue du potentiel viral. Minimum 8 lignes. Explique partage, commentaires, émotion, humour, polémique, curiosité.",
  
  "audio_ambiance": "Analyse longue de l'audio et de l'ambiance. Minimum 8 lignes. Explique voix, bruitages, silences, rythme sonore.",
  
  "call_to_action": "Analyse longue de l'appel à l'action. Minimum 8 lignes. Explique comment pousser à commenter, s'abonner, voir la suite.",
  
  "analyse_coherence": "Analyse longue de la cohérence globale. Minimum 8 lignes.",
  
  "analyse_retention": "Analyse longue de la rétention. Minimum 8 lignes. Donne les moments où le spectateur peut décrocher.",
  
  "analyse_emotion": "Analyse longue du magnétisme émotionnel. Minimum 8 lignes. Explique colère, humour, surprise, drame, curiosité.",

  "plan_action": {
    "structure": "Plan structurel complet avec au moins 4 actions concrètes.",
    "technique": "Plan technique complet avec au moins 4 actions concrètes de montage.",
    "strategie": "Plan stratégique complet avec au moins 4 actions concrètes pour publier, titrer, commenter, faire une suite."
  },

  "hooks": [
    "Accroche courte prête à copier",
    "Accroche courte prête à copier",
    "Accroche courte prête à copier"
  ],

  "titres": [
    "Titre TikTok court",
    "Titre TikTok court",
    "Titre TikTok court"
  ],

  "hashtags": [
    "#hashtag",
    "#hashtag",
    "#hashtag",
    "#hashtag",
    "#hashtag"
  ],

  "description": "Description prête à publier.",

  "bestDay": "Jour conseillé",
  "bestTime": "Heure conseillée",
  "bestTimeReason": "Explication détaillée du meilleur moment de publication.",

  "optimizedScript": "Nouvelle proposition de speech complète, longue, naturelle, marseillaise, prête à copier-coller. Minimum 20 lignes ou un vrai paragraphe complet.",

  "thumbnailConcept": "Concept de miniature détaillé.",
  "thumbnailIdeas": [
    "Idée miniature 1",
    "Idée miniature 2",
    "Idée miniature 3"
  ],

  "monetizationScore": "nombre réel entre 1 et 10",
  "viralPercent": "nombre réel entre 1 et 100",
  "watchRateEstimate": "nombre réel entre 1 et 100 (% de spectateurs qui regarderont plus de 50%)",
  "completionRateEstimate": "nombre réel entre 1 et 100 (% qui regarderont jusqu'à la fin)",
  "saveRatePotential": "nombre réel entre 1 et 10 (contenu qui donne envie de sauvegarder)",
  "commentBaitScore": "nombre réel entre 1 et 10 (contenu qui pousse à commenter)",
  "cliffhangerScore": "nombre réel entre 1 et 10 (donne envie de voir la suite)",
  "algorithmBoosts": ["action concrète 1 pour maximiser le FYP", "action concrète 2", "action concrète 3"],
  "competitive_edge": "En quoi cette vidéo se démarque (ou non) des autres créateurs du même style en France en 2025",
  "next_episode_hook": "Proposition de phrase parfaite pour finir la vidéo et donner envie de voir l'épisode suivant",

  "weakMoments": [
    {
      "time": "00:00 à 00:03",
      "problem": "Problème précis",
      "fix": "Correction précise"
    },
    {
      "time": "00:04 à 00:08",
      "problem": "Problème précis",
      "fix": "Correction précise"
    },
    {
      "time": "00:09 à 00:15",
      "problem": "Problème précis",
      "fix": "Correction précise"
    }
  ],

  "timeline": "Analyse chronologique longue de la vidéo, zone par zone, avec secondes précises.",

  "beginner_tips": [
    "Conseil simple 1",
    "Conseil simple 2",
    "Conseil simple 3",
    "Conseil simple 4",
    "Conseil simple 5"
  ],

  "transcription": "Transcription ou résumé détaillé de ce qui est vu et entendu dans la vidéo. Si aucune transcription audio n'est disponible, fais un résumé visuel très détaillé."
}
`;
}

// =========================================================================
// LOGIQUE TECHNIQUE PARTAGÉE
// =========================================================================

function buildGeminiParts(systemPrompt, userPrompt, frames) {
  const parts = [{ text: systemPrompt + '\n\n' + userPrompt }];

  for (const f of frames) {
    const base64 = String(f.image || '').split(',')[1];
    if (!base64) continue;

    parts.push({
      text: `Image clé vers ${Number(f.time || 0).toFixed(1)} secondes.`
    });

    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: base64
      }
    });
  }

  return parts;
}

async function callGemini(model, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 14000,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(`${model}: ${data.error?.message || r.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();

  if (!text) {
    throw new Error(`${model}: reponse vide`);
  }

  return text;
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {}

  const m = String(text || '').match(/\{[\s\S]*\}/);

  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }

  return {
    raw: text,
    score: null,
    score_global: null,
    verdict: 'Réponse reçue, mais JSON incomplet.'
  };
}

function isGoodAnalysis(r) {
  if (!r || typeof r !== 'object') return false;
  if (!r.scores || typeof r.scores !== 'object') return false;

  const longFields = [
    r.analyse_hook,
    r.dynamisme_visuel,
    r.script_storytelling,
    r.potentiel_viral,
    r.audio_ambiance,
    r.call_to_action,
    r.optimizedScript
  ];

  const validLongFields = longFields.filter(v => typeof v === 'string' && v.length > 350);

  return Boolean(r.analyse_hook && r.analyse_emotion && validLongFields.length >= 4);
}

function normalizeAndScore(report) {
  const r = report || {};
  const rawScores = r.scores || {};

  const s = {
    hook: cleanScore(rawScores.hook, 7.2),
    visual: cleanScore(rawScores.visual, 7.0),
    virality: cleanScore(rawScores.virality, 7.4),
    coherence: cleanScore(rawScores.coherence, 6.9),
    retention: cleanScore(rawScores.retention, 7.1),
    emotion: cleanScore(rawScores.emotion, 7.5)
  };

  const uniqueValues = new Set(Object.values(s).map(v => Number(v).toFixed(1)));

  if (uniqueValues.size <= 2) {
    s.hook = cleanScore(s.hook + 0.3, 7.2);
    s.visual = cleanScore(s.visual - 0.2, 7.0);
    s.virality = cleanScore(s.virality + 0.4, 7.4);
    s.coherence = cleanScore(s.coherence - 0.1, 6.9);
    s.retention = cleanScore(s.retention + 0.2, 7.1);
    s.emotion = cleanScore(s.emotion - 0.3, 7.5);
  }

  const finalScore = weightedScore(s);

  r.score = finalScore;
  r.score_global = finalScore;
  r.scores = s;

  r.monetizationScore = cleanScore(r.monetizationScore, finalScore);
  r.viralPercent = cleanPercent(r.viralPercent, Math.round(finalScore * 10));

  for (const k in r) {
    if (typeof r[k] === 'string') {
      r[k] = cleanTechnicalText(r[k]);
    }
  }

  return r;
}

function cleanTechnicalText(value) {
  if (typeof value !== 'string') return String(value);

  return value
    .replace(/"?vz[-_\s]?time"?\s?[:=>]+\s?/gi, '')
    .replace(/vz[-_\s]?time/gi, '')
    .replace(/rp[-_\s]?mot[-_\s]?cl[eé]/gi, '')
    .replace(/rp[-_\s]?time/gi, '')
    .replace(/\bVZ\b/gi, '')
    .replace(/\bhook\b/gi, 'accroche')
    .replace(/\bcta\b/gi, 'appel à l\'action')
    .replace(/\btimestamp\b/gi, 'seconde')
    .replace(/\bkeyword\b/gi, 'mot-clé')
    .replace(/<\/?u>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

function cleanScore(value, fallback = null) {
  if (typeof value === 'string') {
    value = value.replace(',', '.').replace('/10', '').trim();
  }

  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(1, Math.min(10, Number(n.toFixed(1))));
}

function cleanPercent(value, fallback = 70) {
  if (typeof value === 'string') {
    value = value.replace('%', '').trim();
  }

  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(1, Math.min(100, Math.round(n)));
}

function weightedScore(s) {
  return Number(
    (
      s.hook * 0.20 +
      s.visual * 0.15 +
      s.virality * 0.15 +
      s.coherence * 0.15 +
      s.retention * 0.20 +
      s.emotion * 0.15
    ).toFixed(1)
  );
}
