// api/analyze.js — TikTok Analyzer Pro v4
// Algorithme expert ultra-pédagogique — meilleur que Videlyze

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Methode non autorisee' });

  const body = req.body || {};

  if (body.action === 'test') {
    return res.status(200).json({
      ok: true,
      provider: body.claudeKey ? 'claude' : body.openaiKey ? 'openai' : body.geminiKey ? 'gemini' : 'none'
    });
  }

  try {
    const report = await makeReport(body);
    return res.status(200).json({ ok: true, report });
  } catch (e) {
    console.error('Analyze error:', e.message);
    return res.status(200).json({ ok: false, error: e.message, report: fallback(body) });
  }
}

// ─── PROMPT ULTRA-EXPERT ────────────────────────────────────────────────────
function buildPrompt(b) {
  const hasFrames = Array.isArray(b.frames) && b.frames.length > 0;
  return `Tu es le meilleur expert TikTok au monde. Tu as généré des millions de vues pour des créateurs famille/lifestyle/drama. Tu analyses cette vidéo avec une précision EXTRÊME, seconde par seconde, comme un chirurgien. Tu parles à des DÉBUTANTS COMPLETS — explique chaque conseil comme si la personne n'avait jamais fait de vidéo TikTok.

VIDÉO:
- Nom: ${b.videoName || 'sans nom'}
- URL: ${b.videoUrl || 'upload direct'}
- Auteur: ${b.author || 'non précisé'}
- Type: ${b.contentType || 'famille/drama'}
- Hook actuel: "${b.hook || 'non précisé'}"
- Durée: ~${b.duration || 90} secondes
- Images analysées: ${hasFrames ? b.frames.length + ' frames' : 'aucune (analyse contextuelle)'}

RÈGLES ABSOLUES:
1. Scores VRAIS et VARIÉS — utilise toute l'échelle de 3 à 10, jamais tous identiques
2. Timestamps PRÉCIS — cite des moments exacts : "à 0:03", "entre 0:15 et 0:22"
3. Phrases PRÊTES À DIRE — donne le texte exact à mettre, pas des conseils vagues
4. Explications PÉDAGOGIQUES — comme si tu parlais à un enfant de 10 ans
5. Vidéos >1min = payées DOUBLE par TikTok → toujours optimiser pour dépasser 1 minute

Réponds UNIQUEMENT en JSON valide. Zéro backtick, zéro texte autour. Structure EXACTE:
{
  "score": <entier 35-96>,
  "potential": "<phrase courte sur le potentiel ex: Fort potentiel — hooks à renforcer>",
  "summaryTitle": "<titre court accrocheur de l'analyse>",
  "summaryText": "<3-5 phrases pédagogiques. Commence par le point le plus important. Explique comme à un débutant total.>",
  "scores": {
    "hook": <3-10, vrai score pas toujours 7>,
    "rhythm": <3-10>,
    "clarity": <3-10>,
    "cta": <3-10>,
    "emotion": <3-10>,
    "thumbnail": <3-10>
  },
  "hookScores": {
    "start": <3-10>,
    "middle": <3-10>,
    "end": <3-10>,
    "retention": <3-10>
  },
  "cards": {
    "hook": "<Analyse du hook avec timestamp. Ex: 'À 0:02, la phrase accroche bien mais...' Donne la phrase alternative exacte.>",
    "rhythm": "<Cite les secondes exactes où ça décroche. Ex: 'Entre 0:18 et 0:25, il ne se passe rien — coupe ces 7 secondes.' Explique pourquoi le rythme est crucial.>",
    "clarity": "<Est-ce qu'un étranger qui ne connaît PAS la famille comprend tout de suite ? Quoi changer précisément.>",
    "cta": "<Analyse du call-to-action avec la phrase exacte à dire. Explique pourquoi c'est important pour l'algorithme.>"
  },
  "deep": {
    "global": "<Analyse globale de 4-5 phrases. Comme un coach qui regarde la vidéo avec toi. Très concret.>",
    "hookStart": "<Analyse des 0-3 premières secondes avec timestamp précis ET phrase alternative complète à dire.>",
    "hookMiddle": "<Analyse du milieu vidéo avec timestamp ET phrase de relance exacte à placer.>",
    "hookEnd": "<Analyse des 10 dernières secondes avec timestamp ET phrase de fin exacte.>",
    "subtitles": "<Analyse détaillée des sous-titres: taille (en px si possible), couleur, contraste, timing, lisibilité. Corrections précises.>",
    "sound": "<Analyse audio: voix, effets sonores, musique. Ce qui fonctionne et ce qu'il faut changer. Très concret.>"
  },
  "timeline": [
    ["0–1 sec", "<Ce qui se passe + conseil ULTRA-PRÉCIS avec exemple de phrase ou image>"],
    ["1–3 sec", "<Ce qui se passe + conseil>"],
    ["3–8 sec", "<Ce qui se passe + conseil>"],
    ["8–15 sec", "<Ce qui se passe + conseil — moment critique de rétention>"],
    ["15–25 sec", "<Ce qui se passe + conseil>"],
    ["25–45 sec", "<Ce qui se passe + conseil>"],
    ["45 sec–1 min", "<Ce qui se passe + conseil — zone monétisation>"],
    ["1 min–fin", "<Ce qui se passe + conseil — zone premium TikTok>"],
    ["Dernières secondes", "<CTA exact mot pour mot + explication pourquoi cette formulation>"]
  ],
  "hooks": [
    "<Hook viral 1 — prêt à copier-coller, adapté à la niche famille/drama>",
    "<Hook viral 2 — version émotionnelle>",
    "<Hook viral 3 — version mystère>",
    "<Hook viral 4 — version question choc>",
    "<Hook viral 5 — version révélation>"
  ],
  "titres": [
    "<Titre TikTok viral 1 — max 80 caractères, avec emojis si pertinent>",
    "<Titre 2>",
    "<Titre 3>",
    "<Titre 4>",
    "<Titre 5>"
  ],
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],
  "pubHeure": "<ex: Vendredi 19h30>",
  "pubRaison": "<Explication pédagogique: pourquoi cet horaire pour cette niche. Explique le comportement de l'audience.>",
  "miniature": {
    "texte": "<TEXTE EN GROS à afficher — max 5 mots chocs>",
    "couleurs": "<Palette exacte: fond X, texte Y, bordure Z>",
    "scene": "<Quelle scène précise capturer et comment la cadrer>"
  },
  "actions": [
    "<Action 1 — TRÈS concrète avec exemple. Ex: 'Change la première phrase par: Là ça a dégénéré direct !'>",
    "<Action 2>",
    "<Action 3>",
    "<Action 4>",
    "<Action 5>",
    "<Action 6>"
  ],
  "rewrite": [
    "<Réécriture hook début avec le texte exact>",
    "<Réécriture relance milieu avec le texte exact>",
    "<Réécriture fin avec le texte exact>",
    "<Réécriture titre avec le texte exact>"
  ],
  "checklist": [
    "<Point 1 à vérifier — question fermée Oui/Non>",
    "<Point 2>",
    "<Point 3>",
    "<Point 4>",
    "<Point 5>",
    "<Point 6>"
  ],
  "errorsToAvoid": [
    "<Erreur 1 très fréquente chez les débutants — explication pédagogique>",
    "<Erreur 2>",
    "<Erreur 3>",
    "<Erreur 4>"
  ],
  "beginner": {
    "do": [
      "<Conseil 1 — expliqué comme à un enfant, avec exemple concret>",
      "<Conseil 2>",
      "<Conseil 3>",
      "<Conseil 4>",
      "<Conseil 5>"
    ],
    "dont": [
      "<A eviter 1 — avec explication pourquoi c'est une erreur>",
      "<A eviter 2>",
      "<A eviter 3>",
      "<A eviter 4>",
      "<A eviter 5>"
    ]
  },
  "score_details": {
    "revisionnage": <0-10, critere algo TikTok>,
    "completion": <0-8>,
    "partages": <0-6>,
    "commentaires": <0-4>,
    "likes": <0-2>
  }
}`;
}

// ─── MAKE REPORT avec timeout ────────────────────────────────────────────────
async function makeReport(b) {
  const prompt = buildPrompt(b);
  const timeout = 50000; // 50 secondes max

  // 1. CLAUDE (Anthropic) — priorité
  if (b.claudeKey) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': b.claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          temperature: 0,
          system: 'Tu es expert TikTok senior ultra-pedagogique. Reponds UNIQUEMENT en JSON valide parfait, sans backticks, sans texte avant ou apres. Scores varies et precis.',
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
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
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${b.openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Expert TikTok senior ultra-pedagogique. JSON uniquement. Scores varies et precis.' },
            { role: 'user', content: prompt }
          ]
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
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
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${b.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' }
          }),
          signal: ctrl.signal
        }
      );
      clearTimeout(timer);
      const data = await r.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return normalize(JSON.parse(txt), fallback(b));
    } catch (e) {
      console.warn('Gemini error:', e.message);
    }
  }

  return fallback(b);
}

function normalize(r, base) {
  return {
    ...base, ...r,
    scores:       { ...base.scores,       ...(r.scores || {}) },
    hookScores:   { ...base.hookScores,   ...(r.hookScores || {}) },
    cards:        { ...base.cards,        ...(r.cards || {}) },
    deep:         { ...base.deep,         ...(r.deep || {}) },
    beginner:     { ...base.beginner,     ...(r.beginner || {}) },
    miniature:    { ...base.miniature,    ...(r.miniature || {}) },
    score_details:{ ...base.score_details,...(r.score_details || {}) },
    timeline:     r.timeline?.length     ? r.timeline     : base.timeline,
    hooks:        r.hooks?.length        ? r.hooks        : base.hooks,
    titres:       r.titres?.length       ? r.titres       : base.titres,
    hashtags:     r.hashtags?.length     ? r.hashtags     : base.hashtags,
    actions:      r.actions?.length      ? r.actions      : base.actions,
    rewrite:      r.rewrite?.length      ? r.rewrite      : base.rewrite,
    checklist:    r.checklist?.length    ? r.checklist    : base.checklist,
    errorsToAvoid:r.errorsToAvoid?.length? r.errorsToAvoid: base.errorsToAvoid,
  };
}

function fallback(b) {
  return {
    score: 65,
    potential: 'Analyse impossible — verifie ta cle API et ta connexion',
    summaryTitle: 'Cle API non disponible ou timeout',
    summaryText: 'L\'analyse n\'a pas pu etre generee. Verifie que ta cle Claude est bien configuree dans les parametres et que ta connexion internet fonctionne. Relance l\'analyse.',
    scores: { hook: 6, rhythm: 6, clarity: 6, cta: 5, emotion: 7, thumbnail: 5 },
    hookScores: { start: 5, middle: 6, end: 5, retention: 6 },
    score_details: { revisionnage: 6, completion: 5, partages: 3, commentaires: 3, likes: 2 },
    cards: {
      hook: 'Configure ta cle API pour obtenir une analyse precise du hook.',
      rhythm: 'Configure ta cle API pour analyser le rythme.',
      clarity: 'Configure ta cle API pour analyser la clarte.',
      cta: 'Configure ta cle API pour analyser le call-to-action.'
    },
    deep: {
      global: 'Analyse non disponible. Verifie ta cle API Claude dans les parametres.',
      hookStart: 'Non analyse.',
      hookMiddle: 'Non analyse.',
      hookEnd: 'Non analyse.',
      subtitles: 'Non analyse.',
      sound: 'Non analyse.'
    },
    timeline: [
      ['0-1 sec', 'Commence par le moment le plus fort immediatement.'],
      ['1-3 sec', 'Presente le contexte en une phrase.'],
      ['3-8 sec', 'Relance visuelle pour garder l\'attention.'],
      ['8-15 sec', 'Moment critique — empêche le scroll.'],
      ['15-25 sec', 'Maintiens le rythme.'],
      ['25-45 sec', 'Prepare le twist ou la revelation.'],
      ['45 sec-1 min', 'Zone de monetisation TikTok.'],
      ['1 min-fin', 'Zone premium — continue jusqu\'au bout.'],
      ['Dernieres secondes', 'Question en commentaire pour booster l\'engagement.']
    ],
    hooks: ['Ca a degenere direct...', 'Attends sa reaction...', 'Personne n\'avait prevu ca.', 'Tu aurais fait quoi ?', 'La suite au prochain episode.'],
    titres: ['Ca a degenere direct...', 'Elle pensait avoir raison...', 'La reaction que personne n\'attendait', 'Il a dit ca devant tout le monde', 'Suite de l\'episode choc'],
    hashtags: ['#famille', '#drama', '#tiktokfr', '#couple', '#reaction', '#viral', '#lifestyle', '#humour', '#famille2024', '#storytime'],
    pubHeure: 'Vendredi 19h30',
    pubRaison: 'Audience maximale en soiree semaine pour niche famille/drama',
    miniature: { texte: 'CA A DEGENERE', couleurs: 'Fond rouge, texte blanc, contour noir', scene: 'Expression de surprise ou dispute' },
    actions: ['Renforcer la premiere phrase.', 'Ajouter une relance toutes les 8-10 secondes.', 'Couper les blancs.', 'Mettre des sous-titres gros et lisibles.', 'Terminer par une question.', 'Verifier que la video depasse 1 minute.'],
    rewrite: ['Hook: "La, ca devait etre calme... mais ca a degenere."', 'Milieu: "Et la, tout le monde bloque."', 'Fin: "Tu aurais repondu quoi ?"', 'Titre: "Il pensait avoir raison... jusqu\'a cette reponse."'],
    checklist: ['Hook dans les 3 premieres secondes ?', 'Relance avant 10 secondes ?', 'Sous-titres lisibles sur mobile ?', 'Fin avec une question ?', 'Video depasse 1 minute ?', 'Miniature claire en 1 seconde ?'],
    errorsToAvoid: ['Intro trop lente — les gens partent en moins de 2 secondes.', 'Texte trop petit — illisible sur telephone.', 'Fin sans CTA — tu perds des commentaires gratuits.', 'Silence trop long — l\'algorithme penalise.'],
    beginner: {
      do: ['Commence par le moment le plus fort.', 'Explique comme si la personne ne connaissait rien.', 'Relance souvent avec une phrase courte.', 'Mets des sous-titres tres gros.', 'Finis par une question simple.'],
      dont: ['Ne commence pas lentement.', 'Ne surcharge pas l\'ecran de texte.', 'Ne laisse pas de silence inutile.', 'Ne fais pas une miniature trop chargee.', 'Ne termine pas sans CTA.']
    }
  };
}
