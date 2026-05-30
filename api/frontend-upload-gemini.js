// =============================================================================
// FRONTEND - Upload video vers Gemini File API + Appel analyse
// A integrer dans ton HTML/JS existant
// =============================================================================

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const GEMINI_API_KEY = localStorage.getItem('geminiKey') || '';
const VERCEL_API_URL = 'https://TON-PROJET.vercel.app/api/analyze-long-native';

// =============================================================================
// FONCTION PRINCIPALE : Lance l analyse complete d une video
// =============================================================================

async function lancerAnalyseVideoLongue(videoFile, options) {
  const { channel, manualTranscript, onProgress } = options || {};

  if (!videoFile) throw new Error('Aucun fichier video selectionne.');
  if (!GEMINI_API_KEY) throw new Error('Cle Gemini manquante. Configure-la dans les parametres.');

  // ─── ETAPE 1 : Upload vers Gemini File API ──────────────────────────────
  onProgress && onProgress({ etape: 1, message: 'Upload de la video vers Gemini...' });

  const fileData = await uploadVideoToGeminiFileAPI(videoFile, onProgress);

  console.log('Upload OK - fileUri:', fileData.uri);

  // ─── ETAPE 2 : Attendre que le fichier soit pret ────────────────────────
  onProgress && onProgress({ etape: 2, message: 'Preparation du fichier...' });

  await waitForGeminiFile(fileData.name);

  // ─── ETAPE 3 : Lancer l analyse sur Vercel ─────────────────────────────
  onProgress && onProgress({ etape: 3, message: 'Analyse en cours... (peut prendre 1-2 minutes)' });

  const response = await fetch(VERCEL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileUri: fileData.uri,
      mimeType: videoFile.type || 'video/mp4',
      fileName: videoFile.name,
      channel: channel || { style: 'Humour drama marseillais' },
      manualTranscript: manualTranscript || ''
    })
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || 'Erreur analyse Vercel');
  }

  onProgress && onProgress({ etape: 4, message: 'Analyse terminee !' });

  return result.report;
}

// =============================================================================
// UPLOAD VIDEO VERS GEMINI FILE API
// =============================================================================

async function uploadVideoToGeminiFileAPI(videoFile, onProgress) {
  const UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + GEMINI_API_KEY;

  // ─── Phase 1 : Initialiser l upload resumable ───────────────────────────
  const initResponse = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(videoFile.size),
      'X-Goog-Upload-Header-Content-Type': videoFile.type || 'video/mp4',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file: { display_name: videoFile.name }
    })
  });

  if (!initResponse.ok) {
    const err = await initResponse.text();
    throw new Error('Init upload echoue : ' + err);
  }

  // Recuperer l URL d upload resumable
  const uploadUrl = initResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('URL upload manquante dans la reponse Gemini');

  // ─── Phase 2 : Uploader le fichier ─────────────────────────────────────
  // Pour les gros fichiers : upload par chunks de 10MB
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  const totalSize = videoFile.size;
  let offset = 0;

  while (offset < totalSize) {
    const chunk = videoFile.slice(offset, offset + CHUNK_SIZE);
    const isLast = offset + CHUNK_SIZE >= totalSize;

    const command = isLast ? 'upload, finalize' : 'upload';

    const chunkResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'X-Goog-Upload-Command': command,
        'X-Goog-Upload-Offset': String(offset),
        'Content-Length': String(chunk.size)
      },
      body: chunk
    });

    if (!chunkResponse.ok && !isLast) {
      throw new Error('Erreur upload chunk a offset ' + offset);
    }

    offset += CHUNK_SIZE;

    // Progression upload
    const progression = Math.min(100, Math.round((offset / totalSize) * 100));
    onProgress && onProgress({
      etape: 1,
      progression: progression,
      message: 'Upload : ' + progression + '%'
    });

    // Si dernier chunk : recuperer les infos du fichier
    if (isLast && chunkResponse.ok) {
      const fileInfo = await chunkResponse.json();
      return {
        uri: fileInfo.file?.uri || fileInfo.uri,
        name: fileInfo.file?.name || fileInfo.name,
        mimeType: fileInfo.file?.mimeType || videoFile.type
      };
    }
  }

  throw new Error('Upload termine mais pas de reponse finale');
}

// =============================================================================
// ATTENDRE QUE LE FICHIER SOIT PRET (GEMINI PROCESSING)
// =============================================================================

async function waitForGeminiFile(fileName) {
  const maxAttempts = 30; // 30 tentatives max
  const delayMs = 3000;   // 3 secondes entre chaque tentative

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + GEMINI_API_KEY
    );

    if (!response.ok) {
      await sleep(delayMs);
      continue;
    }

    const fileInfo = await response.json();
    const state = fileInfo.state;

    console.log('File state:', state, '- tentative', i + 1);

    if (state === 'ACTIVE') return true;      // Fichier pret
    if (state === 'FAILED') throw new Error('Gemini a refuse le fichier. Verifie le format video.');

    // PROCESSING : attendre
    await sleep(delayMs);
  }

  throw new Error('Timeout : le fichier Gemini nest pas pret apres ' + (maxAttempts * delayMs / 1000) + ' secondes');
}

// =============================================================================
// SUPPRESSION DU FICHIER GEMINI APRES ANALYSE (optionnel - bonne pratique)
// =============================================================================

async function deleteGeminiFile(fileName) {
  try {
    await fetch(
      'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + GEMINI_API_KEY,
      { method: 'DELETE' }
    );
    console.log('Fichier Gemini supprime:', fileName);
  } catch (e) {
    console.warn('Suppression fichier Gemini echouee (pas grave):', e.message);
  }
}

// =============================================================================
// EXEMPLE D INTEGRATION DANS TON BOUTON ANALYSER
// =============================================================================

async function onClickAnalyserVideo() {
  const videoInput = document.getElementById('videoInput');
  const videoFile = videoInput?.files?.[0];

  if (!videoFile) {
    alert('Selectionne une video dabord.');
    return;
  }

  // Afficher le loader
  document.getElementById('loader').style.display = 'block';
  document.getElementById('statusMessage').textContent = 'Demarrage...';

  let geminiFileName = null;

  try {
    const report = await lancerAnalyseVideoLongue(videoFile, {
      channel: { style: 'Humour drama marseillais' },
      manualTranscript: document.getElementById('contextInput')?.value || '',
      onProgress: ({ etape, message, progression }) => {
        document.getElementById('statusMessage').textContent = message;
        if (progression) {
          document.getElementById('progressBar').style.width = progression + '%';
        }
      }
    });

    // Afficher les resultats
    afficherResultats(report);

    // Supprimer le fichier Gemini (optionnel, economise les credits)
    // if (geminiFileName) await deleteGeminiFile(geminiFileName);

  } catch (err) {
    console.error('ERREUR:', err);
    alert('Erreur : ' + err.message);

  } finally {
    document.getElementById('loader').style.display = 'none';
  }
}

// =============================================================================
// AFFICHAGE DES RESULTATS
// =============================================================================

function afficherResultats(report) {
  console.log('RAPPORT COMPLET:', report);

  // Infos generales
  document.getElementById('nbMoments').textContent = report.nb_moments_detectes || 0;
  document.getElementById('nbEpisodes').textContent = report.nb_episodes_crees || 0;
  document.getElementById('dureeDrama').textContent = report.duree_drama_totale || '-';

  // Afficher les episodes
  const container = document.getElementById('episodesContainer');
  if (!container) return;
  container.innerHTML = '';

  (report.episodes || []).forEach((episode, i) => {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.innerHTML = `
      <h3>Episode ${episode.episode_id} — ${episode.titre || 'Sans titre'}</h3>
      <p><strong>Duree :</strong> ${episode.duree_formatee || '-'}</p>
      <p><strong>Moments :</strong> ${episode.moments?.length || 0} scenes (${episode.start_global} → ${episode.end_global})</p>
      <p><strong>Accroche :</strong> ${episode.accroche || '-'}</p>
      <div class="script">
        <strong>Script voix-off :</strong>
        <pre>${episode.script_voix_off || 'Non genere'}</pre>
      </div>
      <div class="montage">
        <strong>Plan montage CapCut :</strong>
        <ul>
          ${(episode.plan_montage || []).map(p =>
            `<li><strong>${p.timecode}</strong> - ${p.action} - ${p.instruction}</li>`
          ).join('')}
        </ul>
      </div>
      <p><strong>Hashtags :</strong> ${(episode.hashtags || []).join(' ')}</p>
      <p><strong>Question commentaire :</strong> ${episode.question_commentaire || '-'}</p>
      <p><strong>Suite :</strong> ${episode.suite_recommandee || '-'}</p>
    `;
    container.appendChild(card);
  });
}

// =============================================================================
// UTILITAIRE
// =============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
