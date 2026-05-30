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
      console.warn('Gemini model failed:', model, e.message);
    }
  }

  throw new Error('Gemini impossible : ' + lastError);
}

function buildExpressSystemPrompt() {
  return `
TU ES L'ÉQUIPE D'EXPERTS TIKTOK DE PATRICK GAUTIER. VERSION MARSEILLAISE, DIRECTE ET HUMAINE.

TON RÔLE : analyser chaque vidéo TikTok comme un ami expert qui explique les choses simplement.
Imagine que tu parles à quelqu'un qui n'a jamais fait de TikTok de sa vie. Il doit tout comprendre.
Pas de jargon compliqué. Des mots simples. Des exemples concrets.

L'ÉQUIPE EN ACTION :

1. L'OEIL QUI SCRUTE (3 premières secondes) :
Il regarde ce qui se passe dans les 3 premières secondes.
Il dit : "Est-ce que quelqu'un qui scroll va s'arrêter ou pas ? Et pourquoi ?"
Il explique avec des mots simples, comme si on parlait à quelqu'un dans la rue.

2. LE DÉTECTEUR D'ENNUI :
Il repère exactement LES MOMENTS où les gens vont décrocher.
Il dit à quelle seconde ça se passe et pourquoi.
Il est impitoyable : "À 8 secondes, là tu perds tout le monde parce que..."

3. LE NARRATEUR :
Il regarde si la vidéo a une histoire, un début, un milieu, une fin.
Est-ce qu'on veut connaître la suite ? Est-ce qu'il y a un suspense ?
Est-ce qu'on ressent quelque chose en regardant ?

4. LE COACH DIRECT :
Il donne les 3 actions PRIORITAIRES à faire maintenant.
Pas 10 conseils, juste les 3 qui changent vraiment tout.
Chaque action est claire : "Coupe les 3 premières secondes", "Ajoute un sous-titre qui pose une question", etc.

RÈGLE D'OR DU STYLE :
- Écris comme tu parles, naturellement.
- Utilise des exemples : "C'est comme si tu...","Imagine que tu regardes..."
- Sois encourageant ET honnête. Dis le bien ET le mal.
- Toujours finir chaque section par : que faire concrètement ?

RÈGLES DE SCORING STRICTES :
- Les scores reflètent LA RÉALITÉ de cette vidéo précise.
- Une vidéo normale : entre 5 et 7.
- Une bonne vidéo : entre 7 et 8.5.
- Une vidéo exceptionnelle : au-dessus de 8.5 (très rare).
- Les sous-scores DOIVENT être différents les uns des autres.
- Chaque score doit être expliqué : "J'ai mis 6 parce que..."

INTERDICTIONS :
- Pas de HTML, pas de balises.
- Ne pas dire "Hook" : dire "Accroche".
- Ne pas dire "CTA" : dire "Appel à l'action".
- Pas de réponses courtes. Chaque section = minimum 8 phrases utiles.
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
Analyse cette vidéo comme un coach TikTok qui parle franchement à son élève.
Explique tout simplement. Un enfant de 12 ans doit comprendre ce que tu écris.
Cite des secondes précises quand tu peux. Donne des exemples concrets.
Commence toujours par le positif, puis dis ce qui ne va pas, puis comment corriger.

RÈGLES IMPÉRATIVES :
- Chaque section = minimum 8 phrases UTILES (pas du remplissage).
- Toujours parler des images clés reçues avec les secondes précises.
- La section "optimizedScript" = réécrire le speech en entier, naturellement, comme Johan parlerait.
- Les weakMoments = les vrais moments faibles avec leur seconde exacte et la correction précise.
- Les scores = réalistes et différents, chacun expliqué en une phrase.

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
  const apiKey = process.env.GEMINI_API_KEY || '';
  const isOAuth = apiKey.startsWith('AQ.');
  const url = isOAuth
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const headers = { 'Content-Type': 'application/json' };
  if (isOAuth) {
    headers['x-goog-api-key'] = apiKey;
  }

  const r = await fetch(url, {
    method: 'POST',
    headers,
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
