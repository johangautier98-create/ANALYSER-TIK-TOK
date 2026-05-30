// =============================================================================
// API VERCEL : analyze-long-native.js
// Flux : Frontend upload video → Gemini File API → fileUri → ici → analyse complete
// =============================================================================

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

// Duree cible par episode TikTok (en secondes)
const EPISODE_MIN_SECONDS = 92;  // 1min32
const EPISODE_MAX_SECONDS = 120; // 2min00

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.json({
      ok: true,
      service: 'Studio Rush IA - Analyse Video Native Gemini V1',
      geminiKey: Boolean(process.env.GEMINI_API_KEY),
      activeModels: GEMINI_MODELS,
      mode: 'native_video_full_analysis'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Methode non autorisee' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Cle Gemini manquante : GEMINI_API_KEY');
    }

    const body = req.body || {};

    // Le frontend envoie juste le fileUri (pas la video entiere)
    const fileUri  = body.fileUri;
    const mimeType = body.mimeType || 'video/mp4';
    const fileName = body.fileName || 'video.mp4';
    const channel  = body.channel || {};
    const manualTranscript = body.manualTranscript || '';

    if (!fileUri) {
      throw new Error('fileUri manquant. Le frontend doit uploader la video vers Gemini File API dabord.');
    }

    console.log('ANALYSE NATIVE:', { fileUri, fileName, mimeType });

    // =========================================================================
    // ETAPE 1 : Gemini detecte TOUS les moments de drama seconde par seconde
    // =========================================================================
    const momentsRaw = await detectAllDramaMoments({
      fileUri,
      mimeType,
      fileName,
      manualTranscript,
      channel
    });

    console.log('MOMENTS DETECTES:', momentsRaw.length);

    if (momentsRaw.length === 0) {
      return res.json({
        ok: true,
        report: {
          no_drama: true,
          no_drama_message: 'Aucun moment de bagarre, dispute ou drama detecte dans cette video. Le contenu ne correspond pas au type attendu (confrontations entre personnages).',
          fileName,
          nb_moments_detectes: 0,
          nb_episodes_crees: 0,
          episodes: [],
          moments_detectes: []
        }
      });
    }

    // =========================================================================
    // ETAPE 2 : Moteur d assemblage - groupe les moments en episodes de 1min32-2min
    // =========================================================================
    const episodes = assembleEpisodes(momentsRaw);

    console.log('EPISODES ASSEMBLES:', episodes.length);

    // =========================================================================
    // ETAPE 3 : Generation du contenu TikTok pour chaque episode
    // =========================================================================
    const episodesWithContent = await generateEpisodesContent({
      episodes,
      fileUri,
      mimeType,
      fileName,
      channel,
      momentsRaw
    });

    // =========================================================================
    // RESULTAT FINAL
    // =========================================================================
    const report = buildFinalReport({
      fileName,
      momentsRaw,
      episodes: episodesWithContent
    });

    return res.json({ ok: true, report });

  } catch (err) {
    console.error('ERREUR ANALYSE NATIVE:', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

// =============================================================================
// ETAPE 1 : DETECTION DE TOUS LES MOMENTS DE DRAMA
// =============================================================================

async function detectAllDramaMoments({ fileUri, mimeType, fileName, manualTranscript, channel }) {
  const prompt = buildDetectionPrompt({ fileName, manualTranscript, channel });
  const errors = [];
  let noDramaCount = 0;

  for (const model of GEMINI_MODELS) {
    try {
      console.log('DETECTION - modele:', model);

      const text = await callGeminiWithVideo(model, fileUri, mimeType, prompt);
      const data = parseJsonLoose(text);

      if (data && Array.isArray(data.moments)) {
        // Video de mauvais type = retour immediat
        if (data.video_type === 'non_correspondant') {
          console.log('DETECTION: video non correspondante -', model);
          return [];
        }
        if (data.moments.length > 0) {
          console.log('DETECTION OK:', model, '- moments:', data.moments.length);
          return data.moments.map(normalizeMoment);
        }
        // Modele repond : 0 moments = pas de drama
        noDramaCount++;
        errors.push(model + ': 0 moments de drama detectes');
      } else {
        errors.push(model + ': reponse invalide');
      }

    } catch (e) {
      console.warn('DETECTION ECHEC:', model, e.message);
      errors.push(model + ': ' + e.message);
    }
  }

  // Au moins 1 modele confirme absence de drama = video incorrecte
  if (noDramaCount >= 1) {
    return [];
  }

  throw new Error('Detection echouee : ' + errors.join(' | '));
}

function buildDetectionPrompt({ fileName, manualTranscript, channel }) {
  const style = (channel && channel.style) ? channel.style : 'Humour drama marseillais';
  const context = manualTranscript || 'Pas de contexte fourni.';

  return [
    'TU ES UN DETECTEUR DE MOMENTS FORTS POUR TIKTOK.',
    '',
    'MISSION ABSOLUE :',
    'Analyse cette video EN ENTIER, depuis la PREMIERE SECONDE jusqu a la DERNIERE.',
    'Tu dois detecter TOUS les moments exploitables pour TikTok.',
    '',
    'REGLES CRITIQUES :',
    '- COMMENCE L ANALYSE DES LA SECONDE 0. Ne saute RIEN.',
    '- Si le drama commence a 00:02, tu le notes a 00:02. Pas a 01:00.',
    '- Si le drama dure de 00:05 a 01:03, tu notes start=00:05 et end=01:03.',
    '- Tu dois scanner chaque seconde de la video.',
    '- Un moment peut durer 5 secondes comme 3 minutes.',
    '- Ne jamais inventer. Ne jamais ignorer.',
    '',
    'TU DOIS DETECTER :',
    '- bagarres (meme legeres, meme debut de bagarre)',
    '- disputes verbales, cris, insultes',
    '- objets lances (pierres, cailloux, parpaings, bouteilles, vaisselle, nourriture)',
    '- coups portes, gifles, bousculades, cheveux tires',
    '- personnes au sol, chutes, trebuchements',
    '- jets d eau, de liquide, de vetements',
    '- tensions visibles, confrontations, approches agressives',
    '- reactions fortes du public autour',
    '- moments droles, absurdes, inattendus',
    '- renversements de situation',
    '',
    'VERIFICATION OBLIGATOIRE - TYPE DE VIDEO :',
    'Cette chaine est UN FEUILLETON SPECIFIQUE avec exactement : 1 homme + 2 femmes (polygamie).',
    'Les 2 femmes se disputent et se BATTENT physiquement entre elles.',
    '',
    'AVANT D ANALYSER : regarde si la video montre ce type de contenu.',
    'Si la video montre autre chose (prison, sport, cuisine seule, actualite, documentaire, etc.)',
    '=> retourne IMMEDIATEMENT video_type="non_correspondant" et moments=[].',
    'Ne fais PAS d analyse si le contenu de base n est pas present.',
    '',
    'Si la video correspond, cherche EN PRIORITE :',
    '- Les 2 femmes face a face qui se menacent ou se frappent',
    '- Vaisselle, nourriture ou objets lances entre elles',
    '- Cris de jalousie, accusations, pleurs violents',
    '- L homme qui essaie de les separer ou qui regarde',
    '- Situations declenchantes : cuisine, menage, argent, enfants, jalousie',
    '',
    'INSTRUCTION CRITIQUE POUR LONGUES VIDEOS (>10 minutes) :',
    'Scanne TOUTE la video. Detecte TOUS les moments de drama, meme courts (5 secondes).',
    'Sur une video d une heure, tu dois trouver au minimum 15-20 moments si le drama est present.',
    'Chaque bagarre = 1 moment. Chaque dispute = 1 moment. Chaque objet lance = 1 moment.',
    'Ne regroupe pas tout en 1 seul grand moment. Decoupe finement.',
    '',
    'Fichier : ' + fileName,
    'Style chaine : ' + style,
    'Contexte : ' + context,
    '',
    'RETOURNE UNIQUEMENT CE JSON - RIEN D AUTRE :',
    '{',
    '  "video_type": "correspondant / non_correspondant",',
    '  "duree_video": "00:00",',
    '  "nb_moments": 0,',
    '  "moments": [',
    '    {',
    '      "id": 1,',
    '      "start": "00:00",',
    '      "end": "00:00",',
    '      "type": "bagarre / dispute / chute / objet lance / tension / drole / autre",',
    '      "intensite": 9,',
    '      "description": "Description precise de ce qui se passe visuellement.",',
    '      "raison_virale": "Pourquoi ce moment peut exploser sur TikTok.",',
    '      "potentiel": "fort / moyen / faible"',
    '    }',
    '  ]',
    '}'
  ].join('\n');
}

// =============================================================================
// ETAPE 2 : MOTEUR D ASSEMBLAGE - groupe les moments en episodes
// =============================================================================

function assembleEpisodes(moments) {
  if (!moments || moments.length === 0) return [];

  // Trier les moments par heure de debut
  const sorted = [...moments].sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));

  // Garder tous les moments sauf les tres faibles (intensite < 4)
  const goodMoments = sorted.filter(m => m.intensite >= 4);

  const episodes = [];
  let currentEpisodeMoments = [];
  let currentDuration = 0;

  for (const moment of goodMoments) {
    const momentDuration = timeToSeconds(moment.end) - timeToSeconds(moment.start);

    // Si ajouter ce moment depasse le max ET qu on a deja assez pour un episode
    if (currentDuration + momentDuration > EPISODE_MAX_SECONDS && currentDuration >= EPISODE_MIN_SECONDS) {
      // Sauvegarder l episode en cours
      if (currentEpisodeMoments.length > 0) {
        episodes.push(buildEpisodeFromMoments(currentEpisodeMoments, episodes.length + 1));
      }
      // Commencer un nouvel episode avec ce moment
      currentEpisodeMoments = [moment];
      currentDuration = momentDuration;

    } else {
      // Ajouter ce moment a l episode en cours
      currentEpisodeMoments.push(moment);
      currentDuration += momentDuration;

      // Si on a atteint la duree cible, finaliser l episode
      if (currentDuration >= EPISODE_MIN_SECONDS) {
        episodes.push(buildEpisodeFromMoments(currentEpisodeMoments, episodes.length + 1));
        currentEpisodeMoments = [];
        currentDuration = 0;
      }
    }
  }

  // Recuperer les moments restants uniquement si duree minimum 1min30
  if (currentEpisodeMoments.length > 0 && currentDuration >= 90) {
    episodes.push(buildEpisodeFromMoments(currentEpisodeMoments, episodes.length + 1));
  }

  return episodes;
}

function buildEpisodeFromMoments(moments, episodeNumber) {
  const totalSeconds = moments.reduce((acc, m) => {
    return acc + (timeToSeconds(m.end) - timeToSeconds(m.start));
  }, 0);

  const avgIntensity = moments.reduce((acc, m) => acc + m.intensite, 0) / moments.length;

  const firstMoment = moments[0];
  const lastMoment = moments[moments.length - 1];

  return {
    episode_id: episodeNumber,
    moments: moments,
    duree_secondes: Math.round(totalSeconds),
    duree_formatee: secondsToTime(Math.round(totalSeconds)),
    intensite_moyenne: Math.round(avgIntensity * 10) / 10,
    start_global: firstMoment.start,
    end_global: lastMoment.end,
    types_detectes: [...new Set(moments.map(m => m.type))],
    // Ces champs seront remplis par l etape 3
    titre: '',
    accroche: '',
    script_voix_off: '',
    plan_montage: [],
    hashtags: [],
    description_tiktok: '',
    question_commentaire: '',
    suite_recommandee: ''
  };
}

// =============================================================================
// ETAPE 3 : GENERATION DU CONTENU TIKTOK PAR EPISODE
// =============================================================================

async function generateEpisodesContent({ episodes, fileUri, mimeType, fileName, channel, momentsRaw }) {
  const results = [];

  for (const episode of episodes) {
    try {
      console.log('GENERATION episode', episode.episode_id);

      const content = await generateOneEpisodeContent({
        episode,
        fileUri,
        mimeType,
        channel,
        totalEpisodes: episodes.length
      });

      results.push({ ...episode, ...content });

    } catch (e) {
      console.warn('GENERATION episode', episode.episode_id, 'echec:', e.message);
      // Fallback basique si la generation echoue
      results.push({
        ...episode,
        titre: 'Episode ' + episode.episode_id + ' - Moment fort',
        accroche: 'Regardez ce qui se passe...',
        script_voix_off: buildFallbackScript(episode),
        plan_montage: buildFallbackMontage(episode),
        hashtags: ['#drama', '#viral', '#marseille'],
        description_tiktok: 'Episode ' + episode.episode_id,
        question_commentaire: 'Vous auriez fait quoi a sa place ?',
        suite_recommandee: episodes.length > episode.episode_id ? 'Oui - Partie ' + (episode.episode_id + 1) + ' disponible' : 'Non - derniere partie'
      });
    }
  }

  return results;
}

async function generateOneEpisodeContent({ episode, fileUri, mimeType, channel, totalEpisodes }) {
  const prompt = buildEpisodeContentPrompt({ episode, channel, totalEpisodes });
  const errors = [];

  for (const model of GEMINI_MODELS) {
    try {
      const text = await callGeminiWithVideo(model, fileUri, mimeType, prompt);
      const data = parseJsonLoose(text);

      if (data && data.titre && data.script_voix_off && data.script_voix_off.length > 100) {
        return {
          titre: cleanText(data.titre || ''),
          accroche: cleanText(data.accroche || ''),
          script_voix_off: cleanText(data.script_voix_off || ''),
          plan_montage: Array.isArray(data.plan_montage) ? data.plan_montage.map(p => ({
            timecode: cleanText(p.timecode || ''),
            action: cleanText(p.action || ''),
            instruction: cleanText(p.instruction || ''),
            texte_ecran: cleanText(p.texte_ecran || ''),
            son: cleanText(p.son || '')
          })) : [],
          hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(cleanText) : [],
          description_tiktok: cleanText(data.description_tiktok || ''),
          question_commentaire: cleanText(data.question_commentaire || ''),
          suite_recommandee: cleanText(data.suite_recommandee || ''),
          titre_ecran: cleanText(data.titre_ecran || ''),
          strategie_retention: cleanText(data.strategie_retention || '')
        };
      }

      errors.push(model + ': contenu insuffisant');

    } catch (e) {
      errors.push(model + ': ' + e.message);
    }
  }

  throw new Error('Generation episode ' + episode.episode_id + ' echouee : ' + errors.join(' | '));
}

function buildEpisodeContentPrompt({ episode, channel, totalEpisodes }) {
  const style = (channel && channel.style) ? channel.style : 'Humour drama marseillais';

  const momentsList = episode.moments.map(m =>
    '- De ' + m.start + ' a ' + m.end + ' : ' + m.type + ' (intensite ' + m.intensite + '/10) - ' + m.description
  ).join('\n');

  return [
    'TU ES UN SCENARISTE VIRAL SPECIALISTE TIKTOK.',
    '',
    'Tu dois creer le contenu complet pour un episode TikTok.',
    'Cet episode est la PARTIE ' + episode.episode_id + ' sur ' + totalEpisodes + '.',
    '',
    'LES MOMENTS A UTILISER DANS CET EPISODE :',
    momentsList,
    '',
    'Duree totale des moments : ' + episode.duree_formatee,
    'Style chaine : ' + style,
    '',
    'TON TRAVAIL :',
    '1. Cree un titre TikTok explosif qui donne envie de cliquer',
    '2. Ecris une accroche de 3 secondes qui accroche immediatement',
    '3. Ecris un script voix-off COMPLET (minimum 200 mots)',
    '   - Style marseillais, drama, direct, mitraillette',
    '   - Commence fort des la premiere phrase',
    '   - Relance au milieu pour garder l attention',
    '   - Chute finale percutante',
    '   - Question pour pousser les commentaires',
    '4. Donne le plan de montage CapCut precise avec timecodes',
    '5. Cree les hashtags optimaux',
    '',
    'RETOURNE UNIQUEMENT CE JSON :',
    '{',
    '  "titre": "Titre TikTok explosif - Episode ' + episode.episode_id + '",',
    '  "titre_ecran": "Texte court impactant a afficher au debut",',
    '  "accroche": "Phrase choc des 3 premieres secondes",',
    '  "script_voix_off": "Script complet minimum 200 mots. Style marseillais, drama, percutant.",',
    '  "plan_montage": [',
    '    {',
    '      "timecode": "00:00",',
    '      "action": "zoom / coupe / ralenti / repetition / freeze / sous-titre / son",',
    '      "instruction": "Instruction precise CapCut",',
    '      "texte_ecran": "Texte a afficher a ce moment",',
    '      "son": "BIM / WOOSH / GONG / silence / aucun"',
    '    }',
    '  ],',
    '  "hashtags": ["#drama", "#marseille", "#viral"],',
    '  "description_tiktok": "Description complete prete a copier-coller",',
    '  "question_commentaire": "Question finale pour generer les commentaires",',
    '  "strategie_retention": "Comment garder les gens jusqu a la fin",',
    '  "suite_recommandee": "' + (totalEpisodes > episode.episode_id ? 'Partie ' + (episode.episode_id + 1) + ' disponible - teaser a faire' : 'Derniere partie') + '"',
    '}'
  ].join('\n');
}

// =============================================================================
// RAPPORT FINAL
// =============================================================================

function buildFinalReport({ fileName, momentsRaw, episodes }) {
  const totalDramaSeconds = momentsRaw.reduce((acc, m) => {
    return acc + (timeToSeconds(m.end) - timeToSeconds(m.start));
  }, 0);

  const avgScore = episodes.length > 0
    ? episodes.reduce((acc, e) => acc + (e.intensite_moyenne || 5), 0) / episodes.length
    : 0;

  return {
    // Infos generales
    fileName: fileName,
    nb_moments_detectes: momentsRaw.length,
    nb_episodes_crees: episodes.length,
    duree_drama_totale: secondsToTime(totalDramaSeconds),

    // Tous les moments bruts
    moments_detectes: momentsRaw,

    // Episodes assembles avec contenu
    episodes: episodes,

    // Scores globaux
    score_global: cleanScore(avgScore, 7),
    scores: {
      drama: cleanScore(momentsRaw.reduce((a, m) => a + m.intensite, 0) / Math.max(momentsRaw.length, 1), 7),
      potentiel_viral: cleanScore(avgScore, 7),
      retention: cleanScore(avgScore * 0.9, 7),
      emotion: cleanScore(avgScore, 7)
    },

    // Compatibilite avec l ancien format
    rush_clips: episodes.map((ep, i) => ({
      clip_id: ep.episode_id,
      title: ep.titre || 'Episode ' + (i + 1),
      start: ep.start_global || '',
      end: ep.end_global || '',
      duration_cible: ep.duree_formatee || '1min30',
      score: cleanScore(ep.intensite_moyenne, 7),
      drama_level: ep.intensite_moyenne >= 8 ? 'EXTREME' : ep.intensite_moyenne >= 6 ? 'FORT' : 'MOYEN',
      hook: ep.accroche || '',
      script_final_complet: ep.script_voix_off || '',
      tableau_montage: (ep.plan_montage || []).map(p => ({
        timecode: p.timecode || '',
        type_action: p.action || '',
        cible: p.texte_ecran || '',
        instruction_precise: p.instruction || '',
        legende_episode: p.son || ''
      })),
      question_commentaire: ep.question_commentaire || '',
      conseil_rythme: ep.strategie_retention || '',
      tiktok_title: ep.titre || '',
      sons_a_ajouter: [],
      sous_titres_cles: []
    })),

    rush_summary: 'Analyse complete : ' + momentsRaw.length + ' moments detectes, ' + episodes.length + ' episodes TikTok crees.',
    score: cleanScore(avgScore, 7),
    score_global: cleanScore(avgScore, 7)
  };
}

// =============================================================================
// APPEL GEMINI AVEC VIDEO NATIVE
// =============================================================================

async function callGeminiWithVideo(model, fileUri, mimeType, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY;

    const body = {
      contents: [{
        role: 'user',
        parts: [
          {
            // ✅ Video native - Gemini analyse chaque seconde lui meme
            fileData: {
              mimeType: mimeType,
              fileUri: fileUri
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16000,
        responseMimeType: 'application/json'
      }
    };

    const r = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json();

    if (!r.ok) {
      throw new Error(data.error?.message || String(r.status));
    }

    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();

    if (!text) throw new Error('Reponse vide de Gemini');

    return text;

  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// FALLBACKS
// =============================================================================

function buildFallbackScript(episode) {
  const types = episode.types_detectes.join(', ');
  return 'Partie ' + episode.episode_id + ' - Regardez bien ce qui se passe dans cette sequence. ' +
    'On a detecte : ' + types + '. ' +
    'C est un moment fort qui merite votre attention. ' +
    'Du drama, de la tension, et des reactions qui vont vous surprendre. ' +
    'Restez jusqu a la fin pour voir comment ca se termine. ' +
    'Vous auriez reagi comment a leur place ?';
}

function buildFallbackMontage(episode) {
  return episode.moments.map((m, i) => ({
    timecode: m.start,
    action: i === 0 ? 'zoom' : 'coupe',
    instruction: 'Couper au debut du moment fort. Zoom 20% sur l action principale.',
    texte_ecran: m.type.toUpperCase(),
    son: i === 0 ? 'WOOSH' : 'BIM'
  }));
}

// =============================================================================
// NORMALISATION
// =============================================================================

function normalizeMoment(m) {
  const moment = m || {};
  return {
    id: Number(moment.id || 1),
    start: cleanText(moment.start || '00:00'),
    end: cleanText(moment.end || '00:10'),
    type: cleanText(moment.type || 'autre'),
    intensite: cleanScore(moment.intensite, 5),
    description: cleanText(moment.description || ''),
    raison_virale: cleanText(moment.raison_virale || ''),
    potentiel: cleanText(moment.potentiel || 'moyen')
  };
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();

  // Format HH:MM:SS
  const partsLong = str.match(/^(\d+):(\d+):(\d+)$/);
  if (partsLong) {
    return parseInt(partsLong[1]) * 3600 + parseInt(partsLong[2]) * 60 + parseInt(partsLong[3]);
  }

  // Format MM:SS
  const partsShort = str.match(/^(\d+):(\d+)$/);
  if (partsShort) {
    return parseInt(partsShort[1]) * 60 + parseInt(partsShort[2]);
  }

  return 0;
}

function secondsToTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h + 'h' + String(min).padStart(2, '0') + 'min' + String(sec).padStart(2, '0') + 's';
  }
  return m + 'min' + String(sec).padStart(2, '0') + 's';
}

function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch {}

  const clean = String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();

  try { return JSON.parse(clean); } catch {}

  const m = clean.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }

  return null;
}

function cleanScore(value, fallback) {
  if (fallback === undefined) fallback = 5;
  const n = Number(String(value || '').replace(',', '.').replace('/10', '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, Number(n.toFixed(1))));
}

function cleanText(value) {
  return String(value || '')
    .replace(/"?vz[-_\s]?time"?\s?[:=>]+\s?/gi, '')
    .replace(/vz[-_\s]?time/gi, '')
    .replace(/\btimestamp\b/gi, 'seconde')
    .replace(/\bCTA\b/gi, "appel a l'action")
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/[<>]/g, '')
    .trim();
}
