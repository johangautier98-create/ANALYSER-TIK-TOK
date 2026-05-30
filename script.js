// =============================================================================
// CLÉ API INTÉGRÉE — plus besoin de la saisir
// =============================================================================
const DEFAULT_GEMINI_KEY = 'AIzaSyA9-IOsGsInTo9e6XFLWaIA4p6QleXivOI';

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================
let selectedVideo = null;
let selectedVideoUrl = null;
let selectedRushVideo = null;
let selectedRushVideoUrl = null;
let lastRushAnalysis = null;
let lastAnalysis = null;
let thumbState = { style:'viral', image:null, videoFile:null, videoUrl:null };
let scanTimer = null;
let currentRushEpisodes = [];

const titles = {
  analyze:['📊 Analyse Express','Analyse une vidéo déjà montée et reçois un rapport complet : score, hook, rythme, rétention et script optimisé.'],
  rushstudio:['🎬 Studio Rushs IA','Analyse tes longues vidéos et transforme-les en plusieurs TikTok prêts à monter.'],
  history:['📂 Historique','Retrouve toutes les analyses sauvegardées automatiquement.'],
  planner:['📅 Planifier mes vidéos','Prépare les épisodes, hooks, titres et horaires de publication.'],
  scripts:['✍️ Générateur scripts','Réécris une vidéo en script TikTok propre, clair et viral.'],
  thumbnails:['🖼️ Miniatures TikTok','Crée une miniature verticale depuis une frame vidéo ou une image importée.'],
  ideas:['💡 Idées de contenu','Des idées simples pour enchaîner les vidéos.'],
  checklist:['✅ Checklist TikTok','Les règles simples avant de publier.'],
  mychannel:['📺 Ma Chaîne','Logo, bio et historique de tes chaînes TikTok.'],
  competitors:['🔍 Concurrents','Ajoute et surveille les chaînes proches de ton style.']
};

// =============================================================================
// INIT
// =============================================================================
window.addEventListener('DOMContentLoaded', () => {
  // Stocker la clé par défaut si rien en localStorage
  if (!localStorage.getItem('TA_GEMINI_KEY')) {
    localStorage.setItem('TA_GEMINI_KEY', DEFAULT_GEMINI_KEY);
  }
  loadKeys();
  updateApiLabels();
  renderHistory();
  renderRushHistory();
  renderPlans();
  renderIdeas();
  initThumbnail();
  renderCompetitors();
  renderMyChannel();
  localStorage.removeItem('TA_SESSION');

  // Auto-skip login — entrer directement dans l'app
  if (qs('loginScreen')) qs('loginScreen').classList.add('hidden');
  if (qs('app')) qs('app').classList.remove('hidden');
  updateApiLabels();

  // Vérifier la connexion Gemini et mettre le statut vert/rouge
  checkGeminiStatus();
});

async function checkGeminiStatus() {
  const dot = qs('navApiDot');
  const key = getKeys().gemini;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { method: 'GET' }
    );
    const connected = res.ok;
    setNavStatus(connected);
  } catch(e) {
    setNavStatus(false);
  }
}

function setNavStatus(connected) {
  const dot = qs('navApiDot');
  if (!dot) return;
  dot.style.background = connected ? '#22c55e' : '#ef4444';
  dot.title = connected ? 'Gemini connecté' : 'Gemini non disponible';
}

// =============================================================================
// UTILITAIRES DE BASE
// =============================================================================
function qs(id){ return document.getElementById(id); }

function getKeys(){
  const gemini = localStorage.getItem('TA_GEMINI_KEY') || DEFAULT_GEMINI_KEY;
  return { gemini };
}

function togglePassword(id){ const el=qs(id); el.type = el.type==='password'?'text':'password'; }

function loadKeys(){
  if(qs('enterButton')) qs('enterButton').disabled = false;
  if(qs('apiLive')){ qs('apiLive').textContent='Serveur prêt'; qs('apiLive').classList.add('ok'); }
  if(qs('apiStatus')){ qs('apiStatus').textContent='✅ Clé Gemini lue côté Vercel'; qs('apiStatus').className='status-box status-ok'; }
  updateApiLabels();
}

async function connectAPIs(){
  const keyInput = qs('geminiKey');
  const key = keyInput ? keyInput.value.trim() : '';
  if (key && key.startsWith('AIza')) {
    localStorage.setItem('TA_GEMINI_KEY', key);
  }
  setApiStatus('✅ Connexion OK : Gemini + Serveur Vercel', 'ok');
  if(qs('enterButton')) qs('enterButton').disabled = false;
  if(qs('apiLive')){ qs('apiLive').textContent='Serveur prêt'; qs('apiLive').classList.add('ok'); }
  updateApiLabels();
}

function setApiStatus(msg,type){
  qs('apiStatus').textContent=msg;
  qs('apiStatus').className='status-box '+(type==='ok'?'status-ok':type==='error'?'status-error':'');
}

function updateApiLabels(){
  if(qs('geminiLabel')) qs('geminiLabel').textContent='Oui';
  if(qs('serverLabel')) qs('serverLabel').textContent='OK';
  if(qs('geminiDot')) qs('geminiDot').classList.add('ok');
  if(qs('serverDot')) qs('serverDot').classList.add('ok');
}

function enterApp(){
  localStorage.setItem('TA_SESSION','1');
  qs('loginScreen').classList.add('hidden');
  qs('app').classList.remove('hidden');
  updateApiLabels();
  renderThumbnail();
}

function backToLogin(){
  localStorage.removeItem('TA_SESSION');
  qs('app').classList.add('hidden');
  qs('loginScreen').classList.remove('hidden');
}

function switchPage(page, btn){
  if(!qs('page-'+page)) return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  qs('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(titles[page]){ qs('pageTitle').textContent=titles[page][0]; qs('pageSub').textContent=titles[page][1]; }
  document.body.classList.toggle('is-analyze-page', page==='analyze');
  localStorage.setItem('TA_LAST_PAGE', page);
  if(page==='thumbnails') setTimeout(renderThumbnail,50);
  if(page==='mychannel') renderMyChannel();
  if(page==='competitors') renderCompetitors();
  if(page==='history'){ renderHistory(); renderRushHistory(); }
}

// =============================================================================
// ANALYSE EXPRESS — UPLOAD VIDEO
// =============================================================================
function dragOver(e){ e.preventDefault(); qs('dropZone').classList.add('drag'); }
function dragLeave(e){ e.preventDefault(); qs('dropZone').classList.remove('drag'); }
function dropVideo(e){ e.preventDefault(); qs('dropZone').classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) pickVideo(f); }

function pickVideo(file){
  if(!file||!file.type.startsWith('video/')){ alert('Choisis un fichier vidéo.'); return; }
  selectedVideo=file;
  if(selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl);
  selectedVideoUrl=URL.createObjectURL(file);
  qs('videoName').textContent=file.name;
  qs('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · prêt à analyser`;
  qs('videoPreview').classList.remove('hidden');
  if(qs('contextPanel')) qs('contextPanel').classList.remove('hidden');
  qs('analyzeBtn').disabled=false;
  qs('analysisStatus').textContent="Vidéo prête. Tu peux lancer l'analyse.";
  if(qs('step2')) qs('step2').classList.add('active');
  thumbState.videoFile=file;
  thumbState.videoUrl=selectedVideoUrl;
}

function removeVideo(){
  selectedVideo=null;
  qs('videoPreview').classList.add('hidden');
  if(qs('contextPanel')) qs('contextPanel').classList.add('hidden');
  qs('analyzeBtn').disabled=true;
  qs('analysisStatus').textContent="Dépose d'abord une vidéo.";
  qs('results').classList.add('hidden');
}

// =============================================================================
// STUDIO RUSHS IA — UTILITAIRES
// =============================================================================
function rushEsc(v){
  return String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function rushText(v){ return rushEsc(v||'').replace(/\n/g,'<br>'); }
function rushDragOver(e){ e.preventDefault(); if(qs('rushDropZone')) qs('rushDropZone').classList.add('drag'); }
function rushDragLeave(e){ e.preventDefault(); if(qs('rushDropZone')) qs('rushDropZone').classList.remove('drag'); }
function rushDropVideo(e){ e.preventDefault(); if(qs('rushDropZone')) qs('rushDropZone').classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) pickRushVideo(f); }

function pickRushVideo(file){
  if(!file||!file.type.startsWith('video/')){ alert('Choisis un fichier vidéo.'); return; }
  selectedRushVideo=file;
  if(selectedRushVideoUrl) URL.revokeObjectURL(selectedRushVideoUrl);
  selectedRushVideoUrl=URL.createObjectURL(file);
  if(qs('rushVideoName')) qs('rushVideoName').textContent=file.name;
  if(qs('rushVideoMeta')) qs('rushVideoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · prêt pour analyse complète`;
  if(qs('rushVideoPreview')) qs('rushVideoPreview').classList.remove('hidden');
  if(qs('rushAnalyzeBtn')) qs('rushAnalyzeBtn').disabled=false;
  if(qs('rushStatus')) qs('rushStatus').textContent='Vidéo longue chargée. Lance Studio Rushs IA.';
}

function removeRushVideo(){
  selectedRushVideo=null;
  if(selectedRushVideoUrl) URL.revokeObjectURL(selectedRushVideoUrl);
  selectedRushVideoUrl=null;
  if(qs('rushVideoPreview')) qs('rushVideoPreview').classList.add('hidden');
  if(qs('rushAnalyzeBtn')) qs('rushAnalyzeBtn').disabled=true;
  if(qs('rushStatus')) qs('rushStatus').textContent='Dépose une vidéo longue pour commencer.';
  if(qs('rushResults')) qs('rushResults').classList.add('hidden');
}

function rushLoading(message, pct){
  return `
    <div class="rush-loading-card">
      <div class="spinner"></div>
      <h3>${rushEsc(message)}</h3>
      <div class="rush-progress"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>
      <p>Gemini analyse la vidéo entière seconde par seconde. Ne ferme pas la page.</p>
    </div>
  `;
}

function fmtSec(sec){
  const m=Math.floor(sec/60);
  const s=Math.round(sec%60);
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

// =============================================================================
// STUDIO RUSHS IA — UPLOAD GEMINI FILE API (FIX OFFSET)
// =============================================================================
async function uploadVideoToGeminiFileAPI(file, apiKey, onProgress){
  const UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + apiKey;
  // ✅ 8MB — multiple de 256KB obligatoire pour Gemini
  const CHUNK_SIZE = 8 * 1024 * 1024;

  // ── Phase 1 : Init session resumable ─────────────────────────────────────
  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file: { display_name: file.name } })
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error('Init upload Gemini échoué : ' + err);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('URL upload manquante. Vérifie ta clé Gemini (doit commencer par AIza...)');

  // ── Phase 2 : Upload chunk par chunk en lisant l'offset RÉEL du serveur ──
  let offset = 0;

  while (offset < file.size) {
    const chunkEnd  = Math.min(offset + CHUNK_SIZE, file.size);
    const chunkSize = chunkEnd - offset;   // ✅ taille exacte du chunk
    const chunk     = file.slice(offset, chunkEnd);
    const isLast    = chunkEnd >= file.size;

    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
        'X-Goog-Upload-Offset': String(offset),
        'Content-Length': String(chunkSize)
      },
      body: chunk
    });

    // ── Dernier chunk : réponse finale avec fileUri ───────────────────────
    if (isLast) {
      if (!chunkRes.ok) {
        const err = await chunkRes.text();
        throw new Error('Erreur upload final : ' + err);
      }
      const info = await chunkRes.json();
      return {
        uri:  info.file?.uri  || info.uri  || '',
        name: info.file?.name || info.name || ''
      };
    }

    // ── Chunks intermédiaires : lire l'offset réel accepté par Gemini ────
    if (chunkRes.status === 308) {
      // 308 Resume Incomplete = normal pour les chunks intermédiaires
      const rangeHeader = chunkRes.headers.get('range');
      if (rangeHeader) {
        // Format "bytes=0-N" → N = dernier octet reçu
        const m = rangeHeader.match(/bytes=0-(\d+)/);
        // ✅ offset suivant = dernier octet reçu + 1 (vient du serveur, pas de nous)
        offset = m ? parseInt(m[1]) + 1 : chunkEnd;
      } else {
        // Pas de Range header = serveur n'a rien reçu → on renvoie le même chunk
        console.warn('Chunk partiellement reçu à offset', offset, '— retry');
        // offset ne change pas → même chunk renvoyé
        continue;
      }
    } else if (chunkRes.ok) {
      offset = chunkEnd;
    } else {
      const err = await chunkRes.text();
      throw new Error('Erreur chunk offset ' + offset + ' : HTTP ' + chunkRes.status + ' — ' + err);
    }

    if (onProgress) onProgress(Math.min(99, Math.round((offset / file.size) * 100)));
  }

  throw new Error('Upload terminé sans réponse de finalisation Gemini.');
}

// =============================================================================
// STUDIO RUSHS IA — ATTENDRE QUE GEMINI TRAITE LE FICHIER
// =============================================================================
async function waitForGeminiFile(fileName, apiKey){
  if (!fileName) throw new Error('Nom du fichier Gemini manquant.');

  // ✅ 10 minutes max avec intervalle progressif
  const CHECKS = [
    // Premières 30 sec : toutes les 5 sec (fichiers légers)
    ...Array(6).fill(5000),
    // De 30sec à 2min : toutes les 10 sec
    ...Array(9).fill(10000),
    // De 2min à 10min : toutes les 15 sec
    ...Array(32).fill(15000)
  ];

  for (let i = 0; i < CHECKS.length; i++) {
    await new Promise(r => setTimeout(r, CHECKS[i]));

    const tempsEcoule = Math.round(CHECKS.slice(0, i+1).reduce((a,b)=>a+b,0) / 1000);

    // Mise à jour du statut dans l'UI
    if (qs('rushStatus')) {
      qs('rushStatus').textContent = 'Gemini prépare la vidéo... (' + tempsEcoule + 's)';
    }
    if (qs('rushResults')) {
      qs('rushResults').innerHTML = rushLoading(
        'Gemini traite la vidéo... ' + tempsEcoule + 's écoulées',
        Math.min(50, 35 + Math.round(tempsEcoule / 12))
      );
    }

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/' + fileName + '?key=' + apiKey
      );

      if (!res.ok) {
        console.warn('Check file status HTTP', res.status, '- tentative', i+1);
        continue;
      }

      const info = await res.json();
      const state = info.state || '';
      console.log('File state:', state, '- tentative', i+1, '- temps:', tempsEcoule + 's');

      if (state === 'ACTIVE') return true;
      if (state === 'FAILED') throw new Error('Gemini a refusé le fichier. Essaie en MP4 de moins de 500MB.');

      // PROCESSING = on continue d'attendre
    } catch(e) {
      if (e.message.includes('refusé')) throw e;
      console.warn('Erreur check file:', e.message);
    }
  }

  throw new Error('Timeout : Gemini prend trop de temps. Essaie avec une vidéo plus courte ou moins lourde (moins de 500MB).');
}

// =============================================================================
// STUDIO RUSHS IA — ANALYSE PRINCIPALE
// =============================================================================
async function analyzeRushVideo(){
  if (!selectedRushVideo) { alert('Dépose une vidéo longue avant.'); return; }

  const geminiKey = localStorage.getItem('TA_GEMINI_KEY') || '';
  if (!geminiKey || !geminiKey.startsWith('AIza')) {
    alert('Entre ta clé Gemini dans la page de connexion (bouton "Vérifier la connexion" en bas à gauche).');
    return;
  }

  const results = qs('rushResults');
  if (results) { results.classList.remove('hidden'); results.innerHTML = rushLoading('Préparation de l\'upload...', 2); }
  if (qs('rushAnalyzeBtn')) qs('rushAnalyzeBtn').disabled = true;
  if (qs('rushStatus')) qs('rushStatus').textContent = 'Upload en cours...';

  try {
    // ── ETAPE 1 : Upload vers Gemini File API ─────────────────────────────
    const fileData = await uploadVideoToGeminiFileAPI(
      selectedRushVideo,
      geminiKey,
      (prog) => {
        if (results) results.innerHTML = rushLoading('Upload vers Gemini : ' + prog + '%', Math.round(prog * 0.35));
        if (qs('rushStatus')) qs('rushStatus').textContent = 'Upload : ' + prog + '%';
      }
    );

    console.log('Upload OK - fileUri:', fileData.uri);

    // ── ETAPE 2 : Attendre que Gemini prépare le fichier ─────────────────
    if (results) results.innerHTML = rushLoading('Gemini prépare le fichier vidéo...', 38);
    if (qs('rushStatus')) qs('rushStatus').textContent = 'Préparation du fichier...';

    await waitForGeminiFile(fileData.name, geminiKey);

    // ── ETAPE 3 : Lancer l'analyse complète ──────────────────────────────
    if (results) results.innerHTML = rushLoading('Gemini analyse la vidéo entière seconde par seconde...', 55);
    if (qs('rushStatus')) qs('rushStatus').textContent = 'Analyse en cours... (1-2 minutes)';

    const payload = {
      fileUri: fileData.uri,
      mimeType: selectedRushVideo.type || 'video/mp4',
      fileName: selectedRushVideo.name,
      channel: { style: 'Feuilleton TikTok marseillais humour chantier drama' },
      manualTranscript: ''
    };

    if (results) results.innerHTML = rushLoading('Détection des moments de drama...', 70);

    const res = await fetch('/api/analyze-long-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({ ok: false, error: 'Réponse serveur illisible' }));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur API ' + res.status);

    if (results) results.innerHTML = rushLoading('Construction des épisodes TikTok...', 90);

    const report = data.report || {};

    // ── ETAPE 4 : Sauvegarder et afficher ────────────────────────────────
    const meta = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      video: selectedRushVideo.name,
      duration: 0,
      frames: [],
      report
    };

    lastRushAnalysis = meta;
    saveRushHistory(meta);
    renderRushHistory();

    if (results) results.innerHTML = '';
    renderRushReport(report, meta);

    const nbEpisodes = (report.episodes || []).length;
    const nbMoments  = (report.moments_detectes || []).length;
    if (qs('rushStatus')) qs('rushStatus').textContent =
      'Analyse terminée — ' + nbMoments + ' moments détectés — ' + nbEpisodes + ' épisodes TikTok créés.';

  } catch(e) {
    console.error('ERREUR analyzeRushVideo:', e);
    if (results) results.innerHTML = '<div class="rush-error">❌ ' + rushEsc(e.message) + '</div>';
    if (qs('rushStatus')) qs('rushStatus').textContent = 'Erreur : ' + e.message;
    alert('Erreur : ' + e.message);
  } finally {
    if (qs('rushAnalyzeBtn')) qs('rushAnalyzeBtn').disabled = false;
  }
}

// =============================================================================
// STUDIO RUSHS IA — HISTORIQUE
// =============================================================================
function saveRushHistory(item){
  try {
    const list = JSON.parse(localStorage.getItem('TA_RUSH_HISTORY') || '[]');
    list.unshift(item);
    const light = list.slice(0, 10).map((x, i) => i === 0 ? x : Object.assign({}, x, { frames: [] }));
    try {
      localStorage.setItem('TA_RUSH_HISTORY', JSON.stringify(light));
    } catch(e) {
      try { localStorage.setItem('TA_RUSH_HISTORY', JSON.stringify(light.slice(0,3))); } catch(e2){}
    }
  } catch(e) { console.warn('saveRushHistory error:', e); }
}

function getRushHistory(){
  try { return JSON.parse(localStorage.getItem('TA_RUSH_HISTORY') || '[]'); }
  catch(e){ return []; }
}

function clearRushHistory(){
  if(confirm('Vider uniquement l\'historique Studio Rushs IA ?')){
    localStorage.removeItem('TA_RUSH_HISTORY');
    renderRushHistory();
  }
}

function openRushHistory(id){
  const item = getRushHistory().find(x => String(x.id) === String(id));
  if(!item){ alert('Analyse Studio Rushs introuvable.'); return; }
  switchPage('rushstudio', document.querySelector('[data-page="rushstudio"]'));
  lastRushAnalysis = item;
  renderRushReport(item.report || {}, item);
  setTimeout(() => { const r = qs('rushResults'); if(r) r.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
}

function delRushEntry(id){
  if(!confirm('Supprimer cette analyse Studio Rushs ?')) return;
  const list = getRushHistory().filter(x => String(x.id) !== String(id));
  localStorage.setItem('TA_RUSH_HISTORY', JSON.stringify(list));
  renderRushHistory();
}

function renderRushHistory(){
  const list = getRushHistory();
  const el = qs('rushHistoryList');
  if(!el) return;
  if(!list.length){
    el.innerHTML = '<div class="empty-card"><h2>Aucune analyse Studio Rushs</h2><p>Les longues vidéos analysées apparaîtront ici.</p></div>';
    return;
  }
  el.innerHTML = list.map(item => {
    const r = item.report || {};
    const episodes = Array.isArray(r.episodes) ? r.episodes : [];
    const clips = getRushClips(r);
    const nbItems = episodes.length || clips.length;
    const score = Number(r.score || r.score_global || 0);
    const cover = item.frames && item.frames[0] && item.frames[0].image ? item.frames[0].image : '';
    return `<div class="rush-history-item">
      <div class="rush-history-thumb" onclick="openRushHistory(${item.id})" style="cursor:pointer">${cover ? `<img src="${cover}" alt="">` : '🎞️'}</div>
      <div class="rush-history-mid" onclick="openRushHistory(${item.id})" style="cursor:pointer">
        <h3>${rushEsc(item.video || 'Vidéo longue')}</h3>
        <p>${rushEsc(item.date || '')} · ${item.duration ? Math.round(item.duration/60)+' min' : 'durée analysée'} · ${nbItems} épisode(s)</p>
      </div>
      <div class="rush-history-score">${Number.isFinite(score)&&score ? score.toFixed(1) : '—'}<span>/10</span></div>
      <button class="secondary-btn" onclick="openRushHistory(${item.id})">Voir</button>
      <button class="secondary-btn" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5;margin-left:6px" onclick="event.stopPropagation();delRushEntry(${item.id})">🗑 Supprimer</button>
    </div>`;
  }).join('');
}

// =============================================================================
// STUDIO RUSHS IA — AFFICHAGE RAPPORT
// =============================================================================
function getRushClips(report){
  if(Array.isArray(report.rush_clips)) return report.rush_clips;
  if(Array.isArray(report.clips)) return report.clips;
  if(Array.isArray(report.best_moments)) return report.best_moments;
  return [];
}

function parseRushTimeToSeconds(value){
  if(value===null||value===undefined) return null;
  const txt=String(value).trim().toLowerCase().replace(',','.');
  if(!txt) return null;
  const mmss=txt.match(/(\d+)\s*[:h]\s*(\d{1,2})/);
  if(mmss) return Number(mmss[1])*60+Number(mmss[2]);
  const sec=txt.match(/(\d+(?:\.\d+)?)\s*s/);
  if(sec) return Number(sec[1]);
  const plain=Number(txt.replace(/[^0-9.]/g,''));
  return Number.isFinite(plain)?plain:null;
}

function formatRushSeconds(sec){
  const n=Math.max(0,Math.round(Number(sec)||0));
  const m=Math.floor(n/60); const s=n%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function findNearestRushFrame(frames, clip){
  if(!Array.isArray(frames)||!frames.length) return null;
  const candidates=[clip.best_time,clip.image_time,clip.start,clip.debut]
    .map(parseRushTimeToSeconds).filter(v=>Number.isFinite(v));
  const target=candidates.length?candidates[0]:0;
  let best=frames[0]; let dist=Math.abs(Number(best.time||0)-target);
  for(const f of frames){ const d=Math.abs(Number(f.time||0)-target); if(d<dist){best=f;dist=d;} }
  return best;
}

function normalizeRushTimeline(clip){
  const raw=clip.tableau_montage||clip.timeline_precise||clip.plan_montage||clip.montage_steps||[];
  if(Array.isArray(raw)) return raw.slice(0,10);
  if(typeof raw==='string'&&raw.trim()){
    return raw.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,10).map(line=>({time:'',action:line}));
  }
  return [];
}

function rushClipLine(icon, label, value){
  if(!value) return '';
  return `<div class="rush-clip-line"><b>${icon} ${rushEsc(label)}</b><span>${rushText(value)}</span></div>`;
}

function renderRushReport(report, meta, container) {
  const results = container || qs('rushResults');
  if (!results) return;
  results.classList.remove('hidden');

  // Vidéo sans drama
  if (report.no_drama) {
    results.innerHTML = `
      <div class="rush-report-shell">
        <div class="rush-no-drama-card">
          <div style="font-size:52px;margin-bottom:18px">🔍</div>
          <h2>Aucun moment de drama détecté</h2>
          <p>${rushEsc(report.no_drama_message || 'Cette vidéo ne contient pas les éléments attendus.')}</p>
          <p>Pour être exploitable, la vidéo doit contenir des confrontations, bagarres ou disputes entre personnages.</p>
        </div>
      </div>`;
    return;
  }

  const episodes = Array.isArray(report.episodes) ? report.episodes : [];
  const moments  = Array.isArray(report.moments_detectes) ? report.moments_detectes : [];
  const score    = Number(report.score || report.score_global || 0);

  currentRushEpisodes = episodes;

  let html = `<div class="rush-report-shell">`;

  // Header
  html += `
    <div class="rush-report-head">
      <div>
        <span class="rush-badge dark">Studio Rushs IA — Analyse Native Gemini</span>
        <h2>${rushEsc(meta?.video || 'Vidéo longue')}</h2>
        <p>${rushEsc(meta?.date || '')} · ${moments.length} moments détectés · ${episodes.length} épisode(s) TikTok</p>
      </div>
      <div class="rush-score"><strong>${score ? score.toFixed(1) : '—'}</strong><span>/10</span></div>
    </div>`;

  // Stats
  html += `
    <div class="rush-stats-row">
      <div class="rush-stat-box"><strong>${moments.length}</strong><span>moments drama</span></div>
      <div class="rush-stat-box"><strong>${episodes.length}</strong><span>épisodes TikTok</span></div>
      <div class="rush-stat-box"><strong>${report.duree_drama_totale || '—'}</strong><span>drama total</span></div>
      <div class="rush-stat-box"><strong>${score ? score.toFixed(1)+'/10' : '—'}</strong><span>score global</span></div>
    </div>`;

  // Grille épisodes
  if (episodes.length) {
    html += `
      <div class="rush-section-title">
        <h3>🎬 ${episodes.length} épisode${episodes.length > 1 ? 's' : ''} TikTok prêt${episodes.length > 1 ? 's' : ''} à monter</h3>
        <p>Clique sur un épisode pour voir l'histoire et le plan CapCut complet</p>
      </div>
      <div class="rush-episodes-grid">`;

    episodes.forEach((ep, i) => {
      const intens = Number(ep.intensite_moyenne) || 5;
      const level = intens >= 8 ? 'EXTRÊME' : intens >= 6 ? 'FORT' : 'MOYEN';
      const levelClass = intens >= 8 ? 'rush-level-extreme' : intens >= 6 ? 'rush-level-fort' : 'rush-level-moyen';
      const types = Array.isArray(ep.types_detectes) ? ep.types_detectes.slice(0, 3).join(' · ') : '';
      html += `
        <div class="rush-ep-card" onclick="openRushEpisodeModal(${i})">
          <div class="rush-ep-number">ÉPISODE ${ep.episode_id || i + 1}</div>
          <span class="${levelClass}">${level}</span>
          <h3 class="rush-ep-titre">${rushEsc(ep.titre || 'Épisode ' + (ep.episode_id || i + 1))}</h3>
          <div class="rush-ep-duration">⏱️ ${rushEsc(ep.duree_formatee || '1min30')} · ${(ep.moments || []).length} scène(s)</div>
          ${types ? `<div class="rush-ep-types">${rushEsc(types)}</div>` : ''}
          <div class="rush-ep-btn">Voir le détail →</div>
        </div>`;
    });

    html += `</div>`;
  } else {
    html += `<div class="rush-summary-card"><h3>⚠️ Aucun épisode créé</h3><p>Moments détectés mais trop courts ou dispersés pour créer des épisodes de 1min30.</p></div>`;
  }

  // Cartographie moments
  if (moments.length) {
    html += `
      <div class="rush-summary-card" style="margin-top:20px">
        <h3>🎯 Cartographie — ${moments.length} moment${moments.length > 1 ? 's' : ''} détecté${moments.length > 1 ? 's' : ''}</h3>
        <div class="rush-moments-list">
          ${moments.map(m => {
            const c = Number(m.intensite) >= 8 ? '#dc2626' : Number(m.intensite) >= 6 ? '#d97706' : '#6b7280';
            return `<div class="rush-moment-row" style="border-left-color:${c}">
              <span class="rush-moment-time">${rushEsc(m.start)} → ${rushEsc(m.end)}</span>
              <span class="rush-moment-type">${rushEsc(m.type || 'moment')}</span>
              <span class="rush-moment-desc">${rushEsc(m.description || '')}</span>
              <span class="rush-moment-score" style="color:${c}">${m.intensite || '—'}/10</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  html += `</div>`;
  results.innerHTML = html;
}

function openRushEpisodeModal(index) {
  const ep = currentRushEpisodes[index];
  if (!ep) return;
  const modal = qs('rushEpisodeModal');
  if (!modal) return;

  const epNum = ep.episode_id || (index + 1);
  qs('rushModalEpLabel').textContent = 'Épisode ' + epNum + (ep.titre ? ' — ' + ep.titre : '');
  qs('rushModalEpMeta').textContent = [
    ep.duree_formatee || '',
    (ep.moments || []).length + ' scène(s)',
    ep.intensite_moyenne ? 'intensité ' + ep.intensite_moyenne + '/10' : ''
  ].filter(Boolean).join(' · ');

  const montage = Array.isArray(ep.plan_montage) ? ep.plan_montage : [];
  let body = '';

  // PARTIE A — L'Histoire
  body += `<div class="rush-modal-section">
    <div class="rush-modal-section-label">Partie A — L'Histoire Drama</div>`;
  if (ep.accroche) {
    body += `<div class="rush-modal-accroche">🎯 <strong>Accroche (0-3s) :</strong> ${rushText(ep.accroche)}</div>`;
  }
  body += ep.script_voix_off
    ? `<div class="rush-modal-story">${rushText(ep.script_voix_off)}</div>`
    : `<p style="color:#888;font-size:13px">Aucun script généré pour cet épisode.</p>`;
  if (ep.strategie_retention) {
    body += `<div style="margin-top:12px;background:#f8f9ff;border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px">
      💡 <strong>Stratégie rétention :</strong> ${rushText(ep.strategie_retention)}</div>`;
  }
  body += `</div>`;

  // PARTIE B — Plan CapCut
  body += `<div class="rush-modal-section">
    <div class="rush-modal-section-label">Partie B — Plan Montage CapCut</div>`;

  if (ep.moments && ep.moments.length) {
    body += `<p style="font-size:13px;color:#555;margin-bottom:10px;font-weight:700">Moments à garder — coupe tout le reste :</p>
    <div class="rush-capcut-plan">`;
    ep.moments.forEach(m => {
      body += `<div class="rush-capcut-step rush-capcut-keep">
        <span class="rush-capcut-badge">✅ GARDE</span>
        <span class="rush-capcut-time">${rushEsc(m.start)} → ${rushEsc(m.end)}</span>
        <span class="rush-capcut-desc">${rushEsc(m.type || '')}${m.description ? ' — ' + m.description : ''}</span>
      </div>`;
    });
    body += `</div>`;
  }

  if (montage.length) {
    body += `<h4 style="margin:16px 0 8px;font-size:14px;color:#171a2e">Instructions CapCut détaillées :</h4>
    <div class="rush-capcut-plan">`;
    montage.forEach((p, i) => {
      const isCut = (p.action || '').toLowerCase().includes('coup');
      const desc = [p.instruction || '', p.texte_ecran ? `Texte: "${p.texte_ecran}"` : '', p.son && p.son.toLowerCase() !== 'aucun' ? `🔊 ${p.son}` : ''].filter(Boolean).join(' | ');
      body += `<div class="rush-capcut-step ${isCut ? 'rush-capcut-cut' : 'rush-capcut-action'}">
        <span class="rush-capcut-time">${rushEsc(p.timecode || String(i + 1))}</span>
        <span class="rush-capcut-action-type">${rushEsc(p.action || '')}</span>
        <span class="rush-capcut-desc">${rushEsc(desc)}</span>
      </div>`;
    });
    body += `</div>`;
  }
  body += `</div>`;

  // Hashtags
  if (ep.hashtags && ep.hashtags.length) {
    body += `<div class="rush-modal-section">
      <div class="rush-modal-section-label">Hashtags</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${ep.hashtags.map(h => `<span style="background:#ede9fe;color:#5b21b6;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:700">${rushEsc(h)}</span>`).join('')}
      </div></div>`;
  }

  // Description TikTok
  if (ep.description_tiktok) {
    body += `<div class="rush-modal-section">
      <div class="rush-modal-section-label">Description TikTok</div>
      <div style="background:#f8f9ff;border:1px solid var(--border);border-radius:12px;padding:14px;font-size:13px;line-height:1.7;margin-top:8px;white-space:pre-line">${rushText(ep.description_tiktok)}</div>
      <button class="secondary-btn" style="margin-top:8px" onclick="navigator.clipboard.writeText(currentRushEpisodes[${index}].description_tiktok||'').then(()=>{this.textContent='✅ Copié!';setTimeout(()=>this.textContent='📋 Copier',2000)})">📋 Copier</button>
    </div>`;
  }

  // Question commentaire
  if (ep.question_commentaire) {
    body += `<div class="rush-modal-section">
      <div class="rush-modal-section-label">Question pour les commentaires</div>
      <div style="font-size:16px;font-weight:700;margin-top:8px;color:#171a2e;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px">${rushText(ep.question_commentaire)}</div>
    </div>`;
  }

  qs('rushEpisodeModalBody').innerHTML = body;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeRushEpisodeModal() {
  const modal = qs('rushEpisodeModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// =============================================================================
// ANALYSE EXPRESS — EXTRACTION FRAMES
// =============================================================================
function resetAnalyzer(){
  removeVideo();
  qs('results').innerHTML='';
  switchPage('analyze', document.querySelector('[data-page="analyze"]'));
}

async function extractFrames(file, count=4){
  return new Promise((resolve)=>{
    const video=document.createElement('video');
    const url=URL.createObjectURL(file);
    const frames=[];
    video.preload='metadata'; video.muted=true; video.playsInline=true; video.src=url;
    video.onloadedmetadata=async()=>{
      const duration=video.duration||120;
      const times=[0.07,0.18,0.48,0.82].slice(0,count).map(p=>Math.min(duration-0.2,Math.max(0.1,duration*p)));
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      let idx=0;
      const grab=()=>{
        if(idx>=times.length){URL.revokeObjectURL(url); resolve(frames); return;}
        video.currentTime=times[idx];
      };
      video.onseeked=()=>{
        canvas.width=360; canvas.height=640;
        const vw=video.videoWidth||360, vh=video.videoHeight||640;
        const scale=Math.max(canvas.width/vw,canvas.height/vh);
        const w=vw*scale,h=vh*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(video,x,y,w,h);
        frames.push({time:Math.round(times[idx]),image:canvas.toDataURL('image/jpeg',0.72)});
        idx++; grab();
      };
      grab();
    };
    video.onerror=()=>{URL.revokeObjectURL(url); resolve([])};
  });
}

// =============================================================================
// ANALYSE EXPRESS — LANCEMENT
// =============================================================================
async function analyzeVideo(){
  if(!selectedVideo){ alert('Dépose une vidéo avant.'); return; }
  qs('results').classList.remove('hidden');
  qs('analyzeBtn').disabled=true;
  if(qs('step3')) qs('step3').classList.add('active');
  qs('analysisStatus').textContent='Analyse en cours...';
  try{
    showVideoScan('🎬 Lecture complète de la vidéo...', 8);
    const [frames] = await Promise.all([
      extractFrames(selectedVideo, 12),
      runVideoScan(9000)
    ]);
    const thumbData = frames.length>0?(frames[0].image||''):'';
    showVideoScan('⚡ Vidéo lue entièrement — analyse accélérée...', 42);
    await wait(700);
    const payload = {
      frames,
      fileName: selectedVideo.name,
      durationGoal: qs('durationSelect')?qs('durationSelect').value:'120',
      postRhythm: localStorage.getItem('TA_POST_RHYTHM')||'1',
      manualTranscript: qs('hookInput')?qs('hookInput').value:'',
      channel: {
        style:'Feuilleton TikTok marseillais humour chantier drama Momo Jonah Sarah',
        contentType: qs('contentType')?qs('contentType').value:'Famille / drama'
      }
    };
    updateVideoScan('🧠 Gemini génère maintenant le rapport expert...', 72);
    const res = await fetch('/api/express', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({ok:false,error:'Réponse serveur illisible'}));
    if(!res.ok||!data.ok) throw new Error(data.error||('Erreur API '+res.status));
    updateVideoScan('✅ Analyse terminée.', 100);
    const report = normalizeVidelyzeReport(data.report||{}, payload);
    lastAnalysis = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      video: selectedVideo.name,
      thumb: thumbData,
      report
    };
    saveHistory(lastAnalysis);
    renderHistory();
    if(qs('myChannelHistory')) renderMyChannel();
    qs('analysisStatus').textContent='Analyse terminée et sauvegardée.';
    qs('results').innerHTML='<div class="empty-card"><h2>✅ Analyse terminée</h2><p>Le rapport complet est ouvert.</p><button class="primary-btn" onclick="openReportModal('+lastAnalysis.id+')">Voir le rapport</button></div>';
    setTimeout(()=>openReportModal(lastAnalysis.id), 250);
  }catch(e){
    console.error('Analyse error:', e);
    showProgress('❌ Erreur : '+e.message, 0);
    qs('analysisStatus').textContent='Erreur : '+e.message;
  }finally{
    qs('analyzeBtn').disabled=false;
  }
}

// =============================================================================
// SCAN VISUEL PENDANT ANALYSE EXPRESS
// =============================================================================
function wait(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

function showVideoScan(msg, pct){
  const el=qs('results');
  if(!el) return;
  const safeName=(selectedVideo&&selectedVideo.name?selectedVideo.name:'Vidéo').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const src=selectedVideoUrl||'';
  el.innerHTML=`
    <div class="scan-card">
      <div class="scan-video-wrap">
        <video id="analysisScanVideo" src="${src}" muted playsinline preload="auto"></video>
        <div class="scan-video-badge">Analyse visuelle en cours</div>
      </div>
      <div class="scan-info">
        <div class="scan-kicker">TikTok Analyzer Pro</div>
        <h2>${msg}</h2>
        <p>${safeName}</p>
        <div class="scan-bar"><div id="scanBarFill" style="width:${pct}%"></div></div>
        <div class="scan-status" id="scanStatusText">Lecture et extraction des moments clés…</div>
        <div class="scan-bar scan-bar-gemini"><div id="scanGeminiFill" style="width:${pct>=70?45:0}%"></div></div>
        <div class="scan-steps">
          <span class="${pct>=8?'on':''}">Lecture</span>
          <span class="${pct>=42?'on':''}">Images clés</span>
          <span class="${pct>=72?'on':''}">Gemini</span>
          <span class="${pct>=100?'on':''}">Rapport</span>
        </div>
      </div>
    </div>`;
  const v=qs('analysisScanVideo');
  if(v){ v.playbackRate=pct<40?2.5:4; v.currentTime=0; v.play().catch(()=>{}); }
}

function updateVideoScan(msg, pct){
  const fill=qs('scanBarFill');
  if(fill) fill.style.width=Math.max(0,Math.min(100,pct))+'%';
  const card=document.querySelector('.scan-info h2');
  if(card) card.textContent=msg;
  const sub=qs('scanGeminiFill');
  if(sub&&pct>=45){ sub.style.width=Math.max(0,Math.min(100,Math.round((pct-45)*1.8)))+'%'; }
  const status=qs('scanStatusText');
  if(status) status.textContent=pct>=70?'Gemini génère le rapport expert…':pct>=40?'Préparation du rapport…':'Extraction des moments clés…';
}

function runVideoScan(maxMs=9000){
  return new Promise(resolve=>{
    const v=qs('analysisScanVideo');
    if(!v){ setTimeout(resolve,1200); return; }
    let start=Date.now();
    clearInterval(scanTimer);
    const finish=()=>{
      clearInterval(scanTimer);
      try{ v.pause(); }catch(e){}
      updateVideoScan('✅ Vidéo lue, préparation du rapport...', 40);
      resolve();
    };
    v.onended=finish;
    scanTimer=setInterval(()=>{
      const dur=v.duration||(maxMs/1000);
      const ratio=Math.min(1,Math.max(v.currentTime/dur,(Date.now()-start)/maxMs));
      const pct=8+Math.round(ratio*32);
      const fill=qs('scanBarFill');
      if(fill) fill.style.width=pct+'%';
      if(ratio>=1||Date.now()-start>maxMs) finish();
    },250);
  });
}

function showProgress(msg, pct){
  const el=qs('results');
  if(!el) return;
  const color=pct===0?'#ef4444':'linear-gradient(90deg,var(--accent),#06b6d4)';
  el.innerHTML=`<div class="loading-card"><div class="spinner"></div><h2 style="font-size:16px">${msg}</h2><div style="width:100%;background:#eceefd;border-radius:99px;height:10px;margin:14px 0 8px;overflow:hidden"><div style="width:${pct}%;background:${color};height:100%;border-radius:99px;transition:width .7s"></div></div></div>`;
}

// =============================================================================
// GEMINI / OPENAI CALLS
// =============================================================================
const GEMINI_TEXT_MODELS=['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-exp'];

async function geminiPost(geminiKey, models, body){
  try {
    const r=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geminiKey,model:models[0],body})});
    const data=await r.json();
    if(data.ok&&data.text) return data.text;
    if(data.error) throw new Error(data.error);
    throw new Error('Gemini: reponse vide');
  } catch(e){ throw e; }
}

async function callGeminiReport(geminiKey, ctx, visionAnalysis){
  const prompt=buildUltraPrompt(ctx, visionAnalysis);
  const txt=await geminiPost(geminiKey, GEMINI_TEXT_MODELS, {contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}});
  return normalizeReport(JSON.parse(txt.replace(/```json|```/g,'')), localFallbackReport(ctx));
}

function buildUltraPrompt(ctx, visionAnalysis){
  const vision=visionAnalysis?'\n\nANALYSE VISUELLE:\n'+visionAnalysis+'\n':'';
  return 'Tu es un expert TikTok senior ultra-critique.\n\nVIDEO:\n- Nom: '+ctx.videoName+'\n- Type: '+ctx.contentType+'\n- Hook: "'+ctx.hook+'"\n- Duree: ~'+ctx.duration+'s'+vision+'\n\nJSON uniquement:\n{"score_global":<1.0-10.0>,"scores":{"hook":<1-10>,"visuel":<1-10>,"viralite":<1-10>,"coherence":<1-10>,"retention":<1-10>,"magnetisme":<1-10>},"potentiel":"<phrase>","plan_action":{"structure":"<correction>","technique":"<correction>","strategie":"<strategie>"},"analyse_hook":"<analyse>","dynamisme_visuel":"<analyse>","script_storytelling":"<analyse>","potentiel_viral":"<analyse>","audio_ambiance":"<analyse>","call_to_action":"<analyse>","timeline":[["0-5s","<conseil>"]],"hooks":["<h1>","<h2>","<h3>"],"titres":["<t1>","<t2>"],"hashtags":["#tag1","#tag2"],"pub_heure":"<ex: Vendredi 19h30>","pub_raison":"<pourquoi>","miniature":{"texte":"<TEXTE>","couleurs":"<palette>","scene":"<scene>"},"transcription":"<transcription>","beginner_tips":["<c1>","<c2>"]}';
}

function normalizeReport(r, base){
  if(!r||typeof r!=='object') return base;
  if(r.score&&!r.score_global) r.score_global=(r.score/10).toFixed(1)*1;
  if(r.score_global&&!r.score) r.score=Math.round(r.score_global*10);
  return {...base,...r,scores:{...base.scores,...(r.scores||{})},plan_action:{...base.plan_action,...(r.plan_action||{})},miniature:{...base.miniature,...(r.miniature||{})},timeline:r.timeline?.length?r.timeline:base.timeline,hooks:r.hooks?.length?r.hooks:base.hooks,titres:r.titres?.length?r.titres:base.titres,hashtags:r.hashtags?.length?r.hashtags:base.hashtags,beginner_tips:r.beginner_tips?.length?r.beginner_tips:base.beginner_tips};
}

function localFallbackReport(p){
  return {score_global:5.0,score:50,potentiel:'Analyse non disponible - vérifie ta clé API',scores:{hook:5,visuel:5,viralite:5,coherence:5,retention:5,magnetisme:5},plan_action:{structure:'Configure GEMINI_API_KEY dans Vercel.',technique:'Va dans Vercel > Settings > Environment Variables.',strategie:'Une fois configuré, l\'analyse sera ultra-détaillée.'},analyse_hook:'Non disponible.',dynamisme_visuel:'Non disponible.',script_storytelling:'Non disponible.',potentiel_viral:'Non disponible.',audio_ambiance:'Non disponible.',call_to_action:'Non disponible.',timeline:[['0-5s','Analyse non disponible']],hooks:['Ça a dégénéré direct...','Attends sa réaction...'],titres:['Titre à générer','Titre 2'],hashtags:['#famille','#drama','#tiktokfr','#viral'],pub_heure:'Vendredi 19h30',pub_raison:'Meilleur créneau famille/drama',miniature:{texte:'ÇA A DÉGÉNÉRÉ',couleurs:'Fond rouge, texte blanc',scene:'Expression de surprise'},transcription:'Non disponible.',beginner_tips:['Configure les clés Vercel','Lance l\'analyse']};
}

// =============================================================================
// HISTORIQUE ANALYSE EXPRESS
// =============================================================================
function getHistory(){ try { return JSON.parse(localStorage.getItem('TA_HISTORY')||'[]'); } catch(e){ return []; } }
function saveHistory(item){ const h=getHistory(); h.unshift(Object.assign({},item,{id:item.id||Date.now()})); localStorage.setItem('TA_HISTORY',JSON.stringify(h.slice(0,60))); }
function delEntry(id){ if(!confirm('Supprimer cette analyse ?')) return; const h=getHistory().filter(x=>String(x.id)!==String(id)); localStorage.setItem('TA_HISTORY',JSON.stringify(h)); renderHistory(); if(qs('myChannelHistory')) renderMyChannel(); }
function clearHistory(){ if(confirm('Vider TOUT l\'historique ?')){ localStorage.removeItem('TA_HISTORY'); renderHistory(); if(qs('myChannelHistory')) renderMyChannel(); } }

function renderHistory(){
  const h=getHistory();
  const count=qs('historyCount');
  if(count) count.textContent=String(h.length);
  const el=qs('historyList');
  if(el) renderHistoryInto(el, h);
}

function renderHistoryInto(el, h){
  if(!h||!h.length){ el.innerHTML='<div class="empty-card"><h2>Aucune analyse</h2><p>Lance une première analyse pour la voir ici.</p></div>'; return; }
  el.innerHTML=h.map(item=>{
    const r=item.report||{};
    const sg=Number(String(r.score_global??(r.score?r.score/10:5)).replace('/10','').replace(',','.'))||5;
    const sc=r.scores||{};
    const pa=r.plan_action||{};
    const col=v=>v>=7?'#16a34a':v>=5?'#d97706':'#dc2626';
    const srow=(label,val)=>{const v=parseFloat(val)||0;const c=col(v);return '<div class="vly-srow"><span>'+label+'</span><div class="vly-sbar"><div class="vly-sbar-f" style="width:'+Math.round(v*10)+'%;background:'+c+'"></div></div><b style="color:'+c+'">'+Math.round(v)+'/10</b></div>';};
    return '<div class="vly-card"><div class="vly-card-thumb">'+(item.thumb?'<img src="'+item.thumb+'" alt="">':'<div class="vly-thumb-ph">🎬</div>')+'</div><div class="vly-card-mid"><div class="vly-card-title">'+(item.video||'Video')+'</div><div class="vly-card-meta"><span class="vly-badge">Terminé</span><span>'+(item.date||'')+'</span></div>'+(pa.structure?'<div class="vly-plan"><b>Plan d\'Action</b><br><span class="vly-plan-num">1.</span> '+pa.structure.slice(0,80)+' <span class="vly-plan-num">2.</span> '+(pa.technique||'').slice(0,80)+'</div>':'')+'</div><div class="vly-card-scores"><div class="vly-sg"><div class="vly-sg-label">Score Global</div><div class="vly-sg-num" style="color:'+col(sg)+'">'+Number(sg||0).toFixed(1)+'<span>/10</span></div><div class="vly-sg-bar"><div class="vly-sg-bar-f" style="width:'+Math.round(sg*10)+'%;background:'+col(sg)+'"></div></div></div>'+srow('Hook',sc.hook)+srow('Visuel',sc.visuel)+srow('Viralité',sc.viralite)+srow('Cohérence',sc.coherence)+srow('Rétention',sc.retention)+srow('Magnétisme',sc.magnetisme)+'</div><div class="vly-card-btns"><button class="vly-btn-voir" onclick="event.stopPropagation();openReportModal('+item.id+')">Voir l\'analyse</button><button class="vly-btn-del" onclick="event.stopPropagation();delEntry('+item.id+')">Supprimer</button></div></div>';
  }).join('');
}

function openReportModal(id){
  const item=getHistory().find(x=>x.id===id); if(!item)return; lastAnalysis=item;
  const modal=qs('reportModal'); if(!modal)return;
  qs('modalVideoTitle').textContent=item.video||'Rapport';
  qs('modalVideoMeta').textContent=item.date+' · Score '+((item.report&&item.report.score_global)||(item.report&&item.report.score)||0)+'/10';
  const body=qs('reportModalBody');
  body.innerHTML='<div class="loading-card"><div class="spinner"></div><h2>Chargement...</h2></div>';
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
  setTimeout(()=>{ body.innerHTML=''; renderReportInto(body, item.report, item.thumb, item.video); },80);
}

function closeReportModal(){ const modal=qs('reportModal'); if(modal) modal.classList.add('hidden'); document.body.style.overflow=''; }
function openHistoryModal(id){ openReportModal(id); }
function openHistory(id){ openReportModal(id); }

// =============================================================================
// PLANIFICATEUR
// =============================================================================
function fillPlannerFromLast(){ const r=lastAnalysis?.report||getHistory()[0]?.report; if(!r){alert('Fais une analyse avant.');return;} qs('plannerTitle').value=r.hooks?.[0]||''; qs('plannerHook').value=r.hooks?.[1]||''; }
function savePlan(){ const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); plans.unshift({id:Date.now(),title:qs('plannerTitle').value||'Nouvelle vidéo',season:qs('plannerSeason').value,episode:qs('plannerEpisode').value,date:qs('plannerDate').value,time:qs('plannerTime').value,hook:qs('plannerHook').value}); localStorage.setItem('TA_PLANS',JSON.stringify(plans)); renderPlans(); }
function renderPlans(){ const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); const el=qs('plannerList'); if(!el)return; el.innerHTML=plans.map(p=>`<div class="plan-item"><h3>S${p.season} EP${p.episode} — ${p.title}</h3><p>${p.date||'Date à choisir'} à ${p.time||'--:--'} · Hook : ${p.hook||'à écrire'}</p></div>`).join(''); }

// =============================================================================
// GÉNÉRATEUR DE SCRIPTS
// =============================================================================
async function generateScript(){
  const idea=qs('scriptInput').value.trim();
  if(!idea){alert('Mets une idée ou lance une analyse avant.');return;}
  const style=qs('scriptStyle')?qs('scriptStyle').value:'drama_comique';
  const label={comedie:'comique marseillais',drama_comique:'drama comique',humour_drama:'humour + tension drama',mystere:'mystère / suspense',clash:'clash drôle mais familial'}[style]||'drama comique';
  const r=lastAnalysis?.report||getHistory()[0]?.report||{};
  const baseHook=(r.hooks&&r.hooks[0])||'Oh fan ! Là, ça part direct en vrille…';
  const cta=style==='clash'?'Toi, tu serais dans quel camp ?':'Toi, tu aurais fait quoi à sa place ?';
  qs('scriptOutput').textContent=`STYLE : ${label.toUpperCase()}\n\nHOOK 0-2 sec :\n${baseHook}\n\nSCRIPT :\nOh fan de chichoune… là, Momo il pensait gérer le chantier tranquille.\nMais Jonah, elle a décidé que personne ne poserait un seul parpaing aujourd'hui.\nRegarde bien Sarah sur le côté.\nEt là… c'est le moment où tout bascule.\n\nRELANCE VERS 15 SEC :\nMais attends, c'est même pas le pire… regarde ce qu'elle fait maintenant.\n\nCTA FINAL :\n${cta}`;
}
function generateScriptVariant(){ generateScript(); }
function generateScriptFromLast(){ qs('scriptInput').value='Vidéo famille drama marseillais'; generateScript(); }
function renderIdeas(){ const el=qs('ideasList'); if(!el)return; ['Le moment où tout bascule','Avant / après la dispute','La phrase qui a mis le feu','Ce qu\'on n\'a pas vu au début','La réaction que personne n\'attendait'].forEach(t=>el.innerHTML+=`<div class="pill">${t}</div>`); }

// =============================================================================
// NORMALISATION RAPPORT EXPRESS
// =============================================================================
function normalizeVidelyzeReport(r, ctx){
  r=(r&&typeof r==='object')?r:{};
  const n=(v,fb=0)=>{const x=Number(String(v??'').replace('/10','').replace(',','.'));return Number.isFinite(x)?Math.max(0,Math.min(10,x)):fb;};
  const raw=r.scores||{};
  const scores={hook:n(raw.hook,5.8),visual:n(raw.visual??raw.visuel,5.6),visuel:n(raw.visual??raw.visuel,5.6),virality:n(raw.virality??raw.viralite,5.9),viralite:n(raw.virality??raw.viralite,5.9),coherence:n(raw.coherence,5.7),retention:n(raw.retention,5.5),emotion:n(raw.emotion??raw.magnetisme,6.0),magnetisme:n(raw.emotion??raw.magnetisme,6.0)};
  const weighted=+(scores.hook*.20+scores.visual*.15+scores.virality*.15+scores.coherence*.15+scores.retention*.20+scores.emotion*.15).toFixed(1);
  let scoreGlobal=n(r.score_global??r.score,weighted);
  if(scoreGlobal>9.4) scoreGlobal=9.4;
  if(scoreGlobal<1) scoreGlobal=weighted;
  const str=(v,fb='')=>String(v??fb).trim();
  const arr=(v,fb=[])=>Array.isArray(v)?v.filter(Boolean):fb;
  const timeline=Array.isArray(r.timeline)?r.timeline.map(t=>Array.isArray(t)?t:String(t).split(/:(.+)/).filter(Boolean)).filter(t=>t.length):[];
  return {...r,score:scoreGlobal.toFixed(1),score_global:scoreGlobal.toFixed(1),verdict:str(r.verdict,'Analyse terminée.'),potentiel:str(r.potentiel||r.verdict,'Potentiel intéressant.'),scores,analyse_hook:str(r.analyse_hook),dynamisme_visuel:str(r.dynamisme_visuel),script_storytelling:str(r.script_storytelling),potentiel_viral:str(r.potentiel_viral),audio_ambiance:str(r.audio_ambiance),call_to_action:str(r.call_to_action),plan_action:(r.plan_action&&typeof r.plan_action==='object')?r.plan_action:{structure:'Ajoute une promesse claire dans les 3 premières secondes.',technique:'Supprime les moments vides.',strategie:'Transforme la vidéo en épisode.'},hooks:arr(r.hooks,[]),titres:arr(r.titres||r.titles,[]),hashtags:arr(r.hashtags,['#marseille','#humour','#drama']).slice(0,5),description:str(r.description),pub_heure:str(r.pub_heure||((r.bestDay||'Vendredi')+' '+(r.bestTime||'19h30'))),pub_raison:str(r.pub_raison||r.bestTimeReason),miniature:r.miniature||{texte:'',scene:''},transcription:str(r.transcription),optimizedScript:str(r.optimizedScript||r.optimized_script||r.rewrite),weakMoments:arr(r.weakMoments,[]),timeline,beginner_tips:arr(r.beginner_tips,[])};
}

// =============================================================================
// RENDU RAPPORT EXPRESS
// =============================================================================
function renderReportInto(target, r, thumb, videoName){
  if(!target) return;
  r=normalizeVidelyzeReport(r||{});
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const nl=(v)=>esc(v).replace(/\n/g,'<br>');
  const score=Number(r.score_global||r.score||0);
  const sc=r.scores||{};
  const pa=r.plan_action||{};
  const color=(v)=>{const n=Number(v||0);if(n>=8.5)return '#16a34a';if(n>=7)return '#22c55e';if(n>=5.5)return '#f59e0b';return '#ef4444';};
  const bar=(label,val)=>{const v=Math.max(0,Math.min(10,Number(val||0)));const c=color(v);return `<div class="vz-score-row"><span>${esc(label)}</span><div class="vz-track"><i style="width:${Math.round(v*10)}%;background:${c}"></i></div><b style="color:${c}">${v.toFixed(1)}</b></div>`;};
  const section=(icon,title,body,scoreVal)=>{if(!String(body||'').trim())return '';const badge=scoreVal?`<em style="background:${color(scoreVal)}">${Number(scoreVal).toFixed(1)}/10</em>`:'';return `<section class="vz-section"><div class="vz-section-head"><div class="vz-icon">${icon}</div><div><h3>${esc(title)}</h3></div>${badge}</div><div class="vz-body">${formatCoachText(body)}</div></section>`;};
  const formatCoachText=(txt)=>{let clean=String(txt||'').replace(/<[^>]+>/g,' ').trim();if(!clean)return '';return clean.split(/\n\s*\n/g).map(block=>{const b=block.trim();if(!b)return '';const lines=b.split('\n').map(x=>x.trim()).filter(Boolean);return `<div class="vz-paragraph">${lines.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`;}).join('');};
  const weak=Array.isArray(r.weakMoments)?r.weakMoments.slice(0,4):[];
  const timeline=Array.isArray(r.timeline)?r.timeline.slice(0,10):[];
  let html=`<div class="vz-report"><div class="vz-top"><div class="vz-video"><div class="vz-thumb">${thumb?`<img src="${esc(thumb)}" alt="miniature">`:'🎬'}</div><div><span class="vz-chip">Vidéo analysée</span><h2>${esc(videoName||'Rapport')}</h2><p>${esc(r.verdict||r.potentiel||'Rapport généré.')}</p></div></div><div class="vz-global" style="color:${color(score)}"><strong>${score.toFixed(1)}</strong><span>/10</span><small>Score global</small></div></div><div class="vz-score-card"><div class="vz-score-title"><h3>Détail des scores</h3></div>${bar('Hook',sc.hook)}${bar('Visuel',sc.visual||sc.visuel)}${bar('Viralité',sc.virality||sc.viralite)}${bar('Cohérence',sc.coherence)}${bar('Rétention',sc.retention)}${bar('Magnétisme',sc.emotion||sc.magnetisme)}</div>`;
  if(weak.length){html+=`<section class="vz-section vz-warning"><div class="vz-section-head"><div class="vz-icon">⚠️</div><div><h3>Moments faibles à corriger</h3></div></div><div class="vz-weak-list">${weak.map(w=>`<div class="vz-weak"><b>${esc(w.time||'—')}</b><p>${nl((w.problem||'')+(w.fix?' → '+w.fix:''))}</p></div>`).join('')}</div></section>`;}
  html+=section('🔥','Hook (0-3 secondes)',r.analyse_hook,sc.hook);
  html+=section('🎬','Dynamisme & Visuel',r.dynamisme_visuel,sc.visual||sc.visuel);
  html+=section('📖','Script & Storytelling',r.script_storytelling,sc.coherence);
  html+=section('🚀','Potentiel Viral',r.potentiel_viral,sc.virality||sc.viralite);
  html+=section('🎵','Audio & Ambiance',r.audio_ambiance,null);
  html+=section('📣',"Appel à l'action",r.call_to_action,null);
  html+=`<section class="vz-section vz-plan"><div class="vz-section-head"><div class="vz-icon">✅</div><div><h3>Plan d'action prioritaire</h3></div></div><div class="vz-plan-grid"><div><b>1. Structure</b><p>${nl(pa.structure||'')}</p></div><div><b>2. Technique</b><p>${nl(pa.technique||'')}</p></div><div><b>3. Stratégie</b><p>${nl(pa.strategie||'')}</p></div></div></section>`;
  if(r.optimizedScript){html+=`<section class="vz-section vz-rewrite"><div class="vz-section-head"><div class="vz-icon">✍️</div><div><h3>Script optimisé</h3></div></div><div class="vz-body">${formatCoachText(r.optimizedScript)}</div></section>`;}
  if(timeline.length){html+=`<section class="vz-section"><div class="vz-section-head"><div class="vz-icon">⏱️</div><div><h3>Moments clés</h3></div></div><div class="vz-timeline">${timeline.map(t=>`<div><b>${esc(Array.isArray(t)?t[0]:'')}</b><p>${nl(Array.isArray(t)?t[1]:t)}</p></div>`).join('')}</div></section>`;}
  const titlesArr=r.titres||[];
  const hooksArr=r.hooks||[];
  if(hooksArr.length||titlesArr.length){html+=`<section class="vz-section"><div class="vz-section-head"><div class="vz-icon">📌</div><div><h3>Éléments prêts à publier</h3></div></div><div class="vz-ready-grid">${hooksArr.length?`<div><h4>Accroches</h4>${hooksArr.slice(0,5).map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}${titlesArr.length?`<div><h4>Titres</h4>${titlesArr.slice(0,5).map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}<div><h4>Hashtags</h4><div class="vz-tags">${(r.hashtags||[]).slice(0,5).map(h=>`<span>${esc(h)}</span>`).join('')}</div></div></div></section>`;}
  html+=`</div>`;
  target.innerHTML=html;
}

function renderReport(input){ renderReportInto(qs('results'), input, lastAnalysis?.thumb, lastAnalysis?.video); }

// =============================================================================
// ONGLET URL TIKTOK
// =============================================================================
function switchSourceTab(tab){
  qs('tabFile').classList.toggle('active',tab==='file');
  qs('tabUrl').classList.toggle('active',tab==='url');
  if(qs('panelFile')) qs('panelFile').classList.toggle('hidden',tab!=='file');
  if(qs('panelUrl')) qs('panelUrl').classList.toggle('hidden',tab!=='url');
}

let urlVideoData = null;

async function loadFromUrl(){
  const url=(qs('tiktokUrlInput')&&qs('tiktokUrlInput').value.trim())||'';
  if(!url){alert('Colle un lien TikTok ou YouTube.');return;}
  const preview=qs('urlVideoPreview');
  preview.innerHTML='<div class="loading-card"><div class="spinner"></div><p>Chargement...</p></div>';
  preview.classList.remove('hidden');
  try {
    const res=await fetch('/api/tiktok',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'video_info',url})});
    const data=await res.json();
    if(data.ok&&data.video){
      urlVideoData=data.video;
      preview.innerHTML=`<div class="video-preview" style="margin-top:0"><div class="preview-icon">${data.video.thumbnail?'<img src="'+data.video.thumbnail+'" style="width:46px;height:46px;object-fit:cover;border-radius:12px">':'🎬'}</div><div><strong>${data.video.title||'Vidéo TikTok'}</strong><small>Par ${data.video.author||'--'}</small></div><button onclick="analyzeFromUrl()" class="primary-btn" style="margin-left:auto">🚀 Analyser</button></div>`;
    } else {
      preview.innerHTML='<div class="loading-card" style="color:#dc2626">❌ '+(data.error||'Vidéo introuvable')+'</div>';
    }
  } catch(e){ preview.innerHTML='<div class="loading-card" style="color:#dc2626">❌ Erreur : '+e.message+'</div>'; }
}

async function analyzeFromUrl(){
  if(!urlVideoData){alert("Charge une vidéo via le lien d'abord.");return;}
  qs('results').classList.remove('hidden');
  qs('results').innerHTML='<div class="loading-card"><div class="spinner"></div><h2>Analyse en cours...</h2></div>';
  qs('analyzeBtn').disabled=true;
  qs('analysisStatus').textContent='Analyse en cours...';
  if(qs('step3')) qs('step3').classList.add('active');
  const payload={fileName:urlVideoData.title||'Vidéo TikTok',videoName:urlVideoData.title||'',duration:75,contentType:'famille/drama',hook:'',frames:[]};
  let report=null;
  try { report=await callGeminiReport('SERVER_ENV',payload,''); } catch(e){ console.warn(e); }
  if(!report) report=localFallbackReport(payload);
  const item={id:Date.now(),date:new Date().toLocaleString('fr-FR'),video:urlVideoData.title||'Vidéo TikTok',report};
  saveHistory(item); lastAnalysis=item;
  renderReport(report); renderHistory();
  qs('analysisStatus').textContent='Analyse terminée !';
  qs('analyzeBtn').disabled=false;
}

// =============================================================================
// MINIATURES
// =============================================================================
function initThumbnail(){ setTimeout(renderThumbnail,100); }
function setThumbStyle(style,btn){ thumbState.style=style; document.querySelectorAll('.style-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderThumbnail(); }
function loadVideoForThumb(){ if(selectedVideo) prepareThumbVideo(selectedVideo); else alert('Analyse ou choisis une vidéo avant.'); }
function prepareThumbSource(file){ if(!file)return; if(file.type&&file.type.startsWith('video/')) return prepareThumbVideo(file); if(file.type&&file.type.startsWith('image/')) return prepareThumbImage(file); }
function thumbDragOver(e){ e.preventDefault(); qs('thumbDropZone')?.classList.add('drag'); }
function thumbDragLeave(e){ e.preventDefault(); qs('thumbDropZone')?.classList.remove('drag'); }
function thumbDrop(e){ e.preventDefault(); qs('thumbDropZone')?.classList.remove('drag'); const f=e.dataTransfer.files&&e.dataTransfer.files[0]; prepareThumbSource(f); }
function prepareThumbVideo(file){ if(!file)return; thumbState.videoFile=file; if(thumbState.videoUrl&&thumbState.videoUrl!==selectedVideoUrl) URL.revokeObjectURL(thumbState.videoUrl); thumbState.videoUrl=URL.createObjectURL(file); const v=qs('thumbVideo'); v.src=thumbState.videoUrl; v.onloadedmetadata=()=>captureThumbFrame(); }
function prepareThumbImage(file){ if(!file)return; const img=new Image(); img.onload=()=>{thumbState.image=img;renderThumbnail();}; img.src=URL.createObjectURL(file); }
function seekThumbFrame(){ const v=qs('thumbVideo'); if(!v.duration)return; v.currentTime=(qs('thumbTime').value/100)*v.duration; v.onseeked=()=>captureThumbFrame(); }
function captureThumbFrame(){ const v=qs('thumbVideo'); if(!v.videoWidth)return; const imgCanvas=document.createElement('canvas'); imgCanvas.width=v.videoWidth; imgCanvas.height=v.videoHeight; imgCanvas.getContext('2d').drawImage(v,0,0); const img=new Image(); img.onload=()=>{thumbState.image=img;renderThumbnail();}; img.src=imgCanvas.toDataURL('image/jpeg',0.9); }

function renderThumbnail(){
  const canvas=qs('thumbCanvas'); if(!canvas)return;
  const fmt=qs('thumbFormat')?.value||'tiktok';
  if(fmt==='tiktok'){canvas.width=1080;canvas.height=1920;}else if(fmt==='youtube'){canvas.width=1280;canvas.height=720;}else{canvas.width=1080;canvas.height=1080;}
  const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
  const styles={viral:['#ffcc00','#ff004c','rgba(0,0,0,.62)'],drama:['#ff3b30','#111827','rgba(0,0,0,.68)'],clean:['#ffffff','#6d4cff','rgba(12,18,38,.45)'],mystery:['#22d3ee','#7c3aed','rgba(0,0,0,.72)'],humour:['#fff200','#00d4ff','rgba(0,0,0,.55)']};
  const [a,b,shade]=styles[thumbState.style]||styles.viral;
  ctx.fillStyle='#111827'; ctx.fillRect(0,0,W,H);
  if(thumbState.image){const img=thumbState.image;const scale=Math.max(W/img.width,H/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);}else{const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#111827');g.addColorStop(.45,'#34206f');g.addColorStop(1,'#030712');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  ctx.fillStyle=shade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=b; ctx.beginPath(); ctx.roundRect(W*.06,H*.045,W*.28,H*.06,24); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font=`900 ${Math.round(W*.038)}px Arial`; ctx.textAlign='center';
  ctx.fillText(`S${qs('thumbSeason')?.value||1}  EP${qs('thumbEpisode')?.value||1}`,W*.20,H*.085);
  ctx.fillStyle=a; ctx.fillRect(0,H*.69,W,H*.015); ctx.fillStyle=b; ctx.fillRect(0,H*.705,W,H*.012);
  const text=(qs('thumbText')?.value||'ÇA A DÉGÉNÉRÉ').toUpperCase();
  const sub=qs('thumbSubtext')?.value||"Regarde jusqu'à la fin";
  drawStrokeText(ctx,text,W*.06,H*.73,W*.88,Math.round(W*.105),'#fff','#000',10);
  ctx.fillStyle=a; ctx.font=`900 ${Math.round(W*.045)}px Arial`; ctx.textAlign='left'; ctx.fillText(sub.toUpperCase(),W*.07,H*.90);
  ctx.fillStyle='rgba(0,0,0,.75)'; ctx.beginPath(); ctx.roundRect(W*.06,H*.925,W*.88,H*.045,22); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font=`800 ${Math.round(W*.03)}px Arial`; ctx.textAlign='center'; ctx.fillText('NOUVEL ÉPISODE · RÉACTION EN COMMENTAIRE',W/2,H*.955);
  updatePrompt();
}

function drawStrokeText(ctx,text,x,y,maxWidth,fontSize,fill,stroke,lineHeight){
  ctx.textAlign='left'; ctx.lineJoin='round'; let size=fontSize; let words=text.split(' '),lines=[];
  do{ctx.font=`1000 ${size}px Arial Black, Arial`;lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;}else line=test;}lines.push(line);if(lines.length*size*1.05>fontSize*2.4)size-=4;else break;}while(size>32);
  ctx.font=`1000 ${size}px Arial Black, Arial`;
  lines.forEach((l,i)=>{const yy=y+i*size*1.05;ctx.strokeStyle=stroke;ctx.lineWidth=lineHeight;ctx.strokeText(l,x,yy);ctx.fillStyle=fill;ctx.fillText(l,x,yy);});
}

function updatePrompt(){ const prompt=`Miniature TikTok 9:16, style ${thumbState.style}, viral, gros texte lisible, badge S${qs('thumbSeason')?.value||1} EP${qs('thumbEpisode')?.value||1}, sujet: ${qs('thumbText')?.value||'drama'}, couleurs puissantes.`; if(qs('leonardoPrompt')) qs('leonardoPrompt').textContent=prompt; }
function copyLeonardoPrompt(){ navigator.clipboard.writeText(qs('leonardoPrompt').textContent); alert('Prompt copié'); }
function downloadThumbnail(){ const a=document.createElement('a'); a.download=`miniature_S${qs('thumbSeason').value}_EP${qs('thumbEpisode').value}.png`; a.href=qs('thumbCanvas').toDataURL('image/png'); a.click(); }

// =============================================================================
// MA CHAINE & CONCURRENTS
// =============================================================================
function getMyChannels(){ return JSON.parse(localStorage.getItem('TA_MY_CHANNELS')||'[]'); }
function getCompetitors(){ return JSON.parse(localStorage.getItem('TA_COMPETITORS')||'[]'); }
function addMyChannel(){ qs('channelModal').classList.remove('hidden'); document.body.style.overflow='hidden'; setTimeout(()=>{const inp=qs('channelModalInput');if(inp)inp.focus();},100); }
function closeChannelModal(){ qs('channelModal').classList.add('hidden'); document.body.style.overflow=''; }
function readImageAsDataUrl(file){ return new Promise(resolve=>{if(!file)return resolve('');const reader=new FileReader();reader.onload=()=>resolve(reader.result||'');reader.onerror=()=>resolve('');reader.readAsDataURL(file);}); }

async function confirmAddChannel(){
  const inp=qs('channelModalInput');
  const username=(inp?inp.value.trim():'').replace('@','');
  if(!username){qs('channelModalStatus').textContent='Entre un nom de chaîne.';return;}
  qs('channelModalStatus').textContent='Recherche en cours...';
  const manualAvatar=await readImageAsDataUrl(qs('channelAvatarInput')?.files?.[0]);
  const manualBio=(qs('channelBioInput')?.value||'').trim();
  const ch=await fetchChannelInfo(username);
  if(manualAvatar) ch.avatar=manualAvatar;
  if(manualBio) ch.bio=manualBio;
  const channels=getMyChannels().filter(c=>c.handle!=='@'+username);
  channels.unshift(ch);
  localStorage.setItem('TA_MY_CHANNELS',JSON.stringify(channels.slice(0,8)));
  closeChannelModal();
  renderMyChannel();
}

async function addCompetitor(){
  const inp=qs('competitorInput');
  const username=(inp?inp.value.trim():'').replace('@','');
  const cat=qs('competitorCategory')?qs('competitorCategory').value:'Famille/Drama';
  if(!username){alert('Entre un nom de chaîne.');return;}
  const ch=await fetchChannelInfo(username,cat);
  const list=getCompetitors().filter(c=>c.handle!=='@'+username);
  list.unshift(ch);
  localStorage.setItem('TA_COMPETITORS',JSON.stringify(list.slice(0,20)));
  if(inp) inp.value='';
  renderCompetitors();
}

async function fetchChannelInfo(username, category){
  const handle=username.replace('@','').trim();
  let avatar='',displayName='@'+handle,bio='';
  try{
    const r=await fetch('/api/tiktok',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'channel_info',username:handle})});
    const data=await r.json();
    if(data.ok&&data.channel){avatar=data.channel.avatar||'';displayName=data.channel.displayName||('@'+handle);bio=data.channel.bio||'';}
  }catch(e){console.warn('Channel fetch:',e);}
  return {handle:'@'+handle,displayName,avatar,bio,url:'https://www.tiktok.com/@'+handle,category:category||'Ma chaîne',addedAt:new Date().toLocaleDateString('fr-FR')};
}

function renderMyChannel(){
  const el=qs('myChannelCard'); if(!el)return;
  const channels=getMyChannels();
  if(!channels.length){
    el.innerHTML='<div class="no-channel-msg"><p>👆 Clique sur "Ajouter / Changer ma chaîne".</p></div>';
  } else {
    const ch=channels[0];
    el.innerHTML=`<div class="channel-profile-inner"><div class="channel-profile-avatar">${ch.avatar?`<img src="${ch.avatar}" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'avatar-fallback\\'>${(ch.displayName||'?')[0].toUpperCase()}</div>'" alt="avatar">`:`<div class="avatar-fallback">${(ch.displayName||'?')[0].toUpperCase()}</div>`}</div><div class="channel-profile-info" style="flex:1"><div class="channel-profile-name">${ch.displayName}</div><div class="channel-profile-handle">${ch.handle}</div>${ch.bio?`<div class="channel-bio">${ch.bio}</div>`:''}<a href="${ch.url}" target="_blank" class="channel-profile-link">Voir sur TikTok ↗</a></div></div>`;
  }
  const histEl=qs('myChannelHistory'); if(!histEl)return;
  renderHistoryInto(histEl,getHistory());
}

function renderCompetitors(){
  const el=qs('competitorList'); if(!el)return;
  const list=getCompetitors();
  if(!list.length){el.innerHTML='<div class="empty-card"><h2>Aucun concurrent</h2><p>Ajoute des chaînes pour les suivre ici.</p></div>';return;}
  el.innerHTML=list.map((ch,i)=>`<div class="competitor-card"><div class="competitor-avatar">${ch.avatar?`<img src="${ch.avatar}" onerror="this.style.display='none'" alt="avatar">`:'<div class="avatar-fallback">'+(ch.displayName||'?')[0].toUpperCase()+'</div>'}</div><div class="competitor-info"><div class="competitor-name">${ch.displayName}</div><div class="competitor-handle">${ch.handle}</div><span class="competitor-cat">${ch.category||'Autre'}</span></div><div class="competitor-actions"><a href="${ch.url}" target="_blank" class="secondary-btn" style="padding:8px 14px;font-size:12px;text-decoration:none">Voir ↗</a><button onclick="removeCompetitor(${i})" class="del-btn" style="margin-left:6px">🗑</button></div></div>`).join('');
}

function removeCompetitor(i){ const list=getCompetitors(); list.splice(i,1); localStorage.setItem('TA_COMPETITORS',JSON.stringify(list)); renderCompetitors(); }

// =============================================================================
// EVENTS & UTILITAIRES FINAUX
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const urlInp=qs('tiktokUrlInput');
  if(urlInp) urlInp.addEventListener('keydown',e=>{if(e.key==='Enter')loadFromUrl();});
});

function copyText(el, txt){ navigator.clipboard.writeText(txt).then(()=>{el.style.opacity='.6';setTimeout(()=>{el.style.opacity='1';},800);}); }
