const $ = (id) => document.getElementById(id);
const state = { file: null, frames: [], meta: null, lastReport: null, lastThumbnail: null };

const views = {
  analyze: { title: 'Analyse vidéo', sub: 'Glisse une vidéo TikTok/Reels, puis lance l’analyse complète.' },
  thumbnails: { title: 'Miniatures TikTok', sub: 'Crée une miniature à partir d’une vraie image de la vidéo : format 9:16, badge saison/épisode, texte viral.' },
  history: { title: 'Historique', sub: 'Retrouve toutes les analyses sauvegardées automatiquement.' },
  scripts: { title: 'Générateur script', sub: 'Transforme une analyse en script clair, sans faute et prêt TikTok.' },
  planner: { title: 'Planifier mes vidéos', sub: 'Prépare les hooks, titres, légendes et horaires de publication.' },
  help: { title: 'Mode débutant total', sub: 'Comprendre quoi faire, quoi éviter, et dans quel ordre corriger.' }
};

document.addEventListener('DOMContentLoaded', () => {
  loadKeys();
  bindUI();
  renderHistory();
  refreshSelects();
});

function bindUI(){
  $('saveKeysBtn').addEventListener('click', saveAndTestKeys);
  $('enterAppBtn').addEventListener('click', enterApp);
  $('clearKeysBtn').addEventListener('click', clearKeys);
  $('newAnalysisSideBtn').addEventListener('click', () => { showView('analyze'); resetAnalysis(); });
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

  const drop = $('dropZone');
  drop.addEventListener('click', () => $('videoInput').click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
  $('videoInput').addEventListener('change', e => handleFile(e.target.files[0]));
  $('analyzeBtn').addEventListener('click', analyzeVideo);
  $('clearHistoryBtn').addEventListener('click', () => { localStorage.removeItem('tta_history'); renderHistory(); refreshSelects(); });
  $('generateScriptBtn').addEventListener('click', generateScriptFromSelected);
  $('createPlanBtn').addEventListener('click', createPlanFromSelected);
  if($('generateThumbBtn')) $('generateThumbBtn').addEventListener('click', generateThumbnail);
  if($('downloadThumbBtn')) $('downloadThumbBtn').addEventListener('click', downloadThumbnail);
  ['thumbFormat','thumbStyle','thumbSeason','thumbEpisode','thumbTitle','thumbFrameSelect'].forEach(id => { if($(id)) $(id).addEventListener('change', updateThumbnailPrompt); });
}

function loadKeys(){
  $('openaiKey').value = localStorage.getItem('OPENAI_KEY') || '';
  $('geminiKey').value = localStorage.getItem('GEMINI_KEY') || '';
  if ($('openaiKey').value || $('geminiKey').value) $('apiStatus').textContent = '✅ Clés déjà enregistrées sur cet ordinateur.';
}

async function saveAndTestKeys(){
  const openai = $('openaiKey').value.trim();
  const gemini = $('geminiKey').value.trim();
  if(!openai && !gemini){ $('apiStatus').textContent = '⚠️ Colle au moins une clé.'; return; }
  localStorage.setItem('OPENAI_KEY', openai);
  localStorage.setItem('GEMINI_KEY', gemini);
  $('apiStatus').textContent = '⏳ Test des clés en cours...';
  try{
    const res = await fetch('/api/analyze', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ mode:'test', openaiKey: openai, geminiKey: gemini })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Test impossible');
    $('apiStatus').textContent = '✅ Client enregistré, test OK.';
  }catch(e){
    $('apiStatus').textContent = '⚠️ Clés enregistrées localement, mais test API impossible : ' + e.message;
  }
}
function enterApp(){ $('loginScreen').classList.add('hidden'); $('appShell').classList.remove('hidden'); }
function clearKeys(){ localStorage.removeItem('OPENAI_KEY'); localStorage.removeItem('GEMINI_KEY'); location.reload(); }

function showView(name){
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view===name));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-'+name).classList.add('active');
  $('pageTitle').textContent = views[name].title; $('pageSubtitle').textContent = views[name].sub;
  if(name==='history') renderHistory();
  if(name==='thumbnails') { renderFrameOptions(); updateThumbnailPrompt(); }
  if(name==='scripts' || name==='planner') refreshSelects();
}

function handleFile(file){
  if(!file || !file.type.startsWith('video/')) return;
  state.file = file; state.frames=[]; state.meta=null;
  $('videoMeta').style.display='block';
  $('videoMeta').textContent = `Vidéo chargée : ${file.name} — ${(file.size/1024/1024).toFixed(1)} Mo`;
  $('analyzeBtn').disabled = false;
  renderFrameOptions();
  $('analyzeStatus').textContent = '✅ Vidéo prête. Clique sur “Analyser la vidéo”.';
}

function resetAnalysis(){
  state.file=null; state.frames=[]; state.meta=null; state.lastReport=null;
  $('videoInput').value=''; $('videoMeta').style.display='none'; $('videoMeta').textContent='';
  $('analyzeBtn').disabled=true; $('analyzeStatus').textContent=''; $('reportContainer').innerHTML='';
}

async function analyzeVideo(){
  const openaiKey = localStorage.getItem('OPENAI_KEY') || '';
  const geminiKey = localStorage.getItem('GEMINI_KEY') || '';
  if(!state.file){ $('analyzeStatus').textContent='⚠️ Ajoute une vidéo d’abord.'; return; }
  if(!openaiKey && !geminiKey){ $('analyzeStatus').textContent='⚠️ Ajoute tes clés API avant.'; return; }

  $('analyzeBtn').disabled=true;
  $('analyzeStatus').textContent='⏳ Lecture vidéo + extraction des moments importants...';
  $('reportContainer').innerHTML = loadingCard('Extraction des images clés en cours...');
  try{
    const {frames, meta} = await extractFrames(state.file);
    state.frames = frames; state.meta = meta;
    $('analyzeStatus').textContent='⏳ Analyse IA en cours. Cela peut prendre quelques secondes...';
    $('reportContainer').innerHTML = loadingCard('Analyse complète : hook, rythme, script, fin, CTA, plan d’action...');

    const payload = { mode:'analyze', openaiKey, geminiKey, meta, frames };
    const res = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Analyse impossible');
    const report = normalizeReport(data.report, meta);
    state.lastReport = report;
    renderReport(report);
    renderFrameOptions();
    updateThumbnailPrompt();
    saveHistory(report);
    refreshSelects();
    $('analyzeStatus').textContent='✅ Analyse terminée et ajoutée automatiquement à l’historique.';
  }catch(err){
    console.error(err);
    const fallback = buildFallbackReport(state.file, state.meta, err.message);
    state.lastReport = fallback;
    renderReport(fallback);
    saveHistory(fallback);
    refreshSelects();
    $('analyzeStatus').textContent='⚠️ Analyse locale générée car l’IA n’a pas répondu : ' + err.message;
  }finally{
    $('analyzeBtn').disabled=false;
  }
}

function loadingCard(text){ return `<div class="card"><h2>Analyse en cours</h2><p>${text}</p></div>`; }

function extractFrames(file){
  return new Promise((resolve, reject) => {
    const video = $('hiddenVideo'); const canvas = $('frameCanvas'); const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(file);
    video.src = url; video.load();
    video.onloadedmetadata = async () => {
      try{
        const duration = video.duration || 0;
        const times = uniqueTimes([0.7, 2.5, duration*0.35, duration*0.65, Math.max(duration-2, 0.5)]).filter(t => t < duration);
        const frames=[];
        for(const t of times){
          const frame = await seekAndCapture(video, canvas, ctx, t);
          frames.push({ time: Number(t.toFixed(1)), image: frame.split(',')[1] });
        }
        URL.revokeObjectURL(url);
        resolve({ frames, meta:{ fileName:file.name, sizeMB:Number((file.size/1024/1024).toFixed(2)), duration:Number(duration.toFixed(1)), frameCount:frames.length }});
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    video.onerror = () => reject(new Error('Impossible de lire cette vidéo dans le navigateur.'));
  });
}
function uniqueTimes(arr){ return [...new Set(arr.map(v => Math.max(0.1, Number(v.toFixed(1)))))]; }
function seekAndCapture(video, canvas, ctx, time){
  return new Promise((resolve) => {
    video.currentTime = time;
    video.onseeked = () => {
      const maxW = 640; const ratio = video.videoWidth ? maxW / video.videoWidth : 1;
      canvas.width = Math.min(maxW, video.videoWidth || 640); canvas.height = Math.round((video.videoHeight || 360) * ratio);
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL('image/jpeg', .72));
    };
  });
}

function normalizeReport(report, meta){
  if(typeof report === 'string'){
    try{ report = JSON.parse(report); }catch{ report = null; }
  }
  if(!report) return buildFallbackReport({name:meta?.fileName||'Vidéo'}, meta, 'Réponse IA non structurée');
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), meta, ...report };
}

function buildFallbackReport(file, meta, reason){
  return {
    id: crypto.randomUUID(), createdAt:new Date().toISOString(), meta: meta || { fileName:file?.name||'Vidéo', duration:0, sizeMB:0 },
    title:'Analyse vidéo — rapport local', provider:'local', globalScore:68,
    scores:{ hook:62, clarity:70, rhythm:66, retention:64, cta:58, script:72, emotion:65, edit:68 },
    summary:'L’analyse IA n’a pas pu se lancer, mais l’outil a généré un rapport de travail complet pour avancer sans rester bloqué.',
    beginner:[
      {do:'Place une phrase choc dans les 2 premières secondes.', dont:'Ne commence pas par une longue introduction.'},
      {do:'Ajoute une relance toutes les 5 à 8 secondes.', dont:'Ne laisse pas de passage plat ou silencieux trop long.'},
      {do:'Termine par une action simple : commenter, suivre, regarder la suite.', dont:'Ne finis pas la vidéo sans conclusion.'}
    ],
    hooks:{
      start:['Attends, regarde bien ce qui va se passer…','Personne ne t’explique ça clairement…','J’ai compris pourquoi cette vidéo bloque les vues.'],
      middle:['Et là, c’est le détail que tout le monde rate.','Regarde la différence maintenant.','C’est ici que la vidéo peut repartir.'],
      end:['Si tu veux la suite, regarde la prochaine vidéo.','Dis-moi en commentaire ce que tu aurais changé.','Abonne-toi, je te montre le résultat final.']
    },
    timeline:[
      {time:'0–3 sec', problem:'Hook pas assez explicite.', fix:'Annonce le problème ou la promesse immédiatement.'},
      {time:'4–10 sec', problem:'Risque de baisse d’attention.', fix:'Ajoute une phrase courte + zoom + changement visuel.'},
      {time:'Milieu', problem:'La vidéo peut devenir linéaire.', fix:'Remets un mini-hook ou une question.'},
      {time:'Fin', problem:'CTA absent ou faible.', fix:'Demande une action claire.'}
    ],
    actions:['Réécrire les 3 premières secondes.','Couper les temps morts.','Ajouter 2 relances au milieu.','Créer une vraie fin avec CTA.'],
    improvedScript:'Hook : “Attends, regarde bien ce détail.”\nDéveloppement : explique simplement le problème, montre le changement, puis donne la solution.\nFin : “Dis-moi si tu veux que je teste une autre version.”',
    caption:'Cette astuce peut changer toute la vidéo 👀 #tiktoktips #creationvideo #viral',
    plan:{ title:'Nouvelle version optimisée', bestTime:'19h00–21h00', cta:'Commente “suite” si tu veux l’épisode 2', hashtags:['#tiktokfrance','#montagevideo','#viral'] },
    debugReason: reason
  };
}

function renderReport(r){
  $('reportContainer').innerHTML = `
    <div class="card">
      <span class="pill">${r.provider || 'IA'}</span><span class="pill">Score global ${r.globalScore || 0}/100</span>
      <h2>${escapeHtml(r.title || 'Analyse complète')}</h2>
      <p>${escapeHtml(r.summary || '')}</p>
      <div class="score-grid">${Object.entries(r.scores || {}).map(([k,v]) => `<div class="score-card"><span>${labelScore(k)}</span><br><strong>${v}/100</strong></div>`).join('')}</div>
    </div>
    <div class="report-section"><h3>✅ Fais ça / ❌ Ne fais pas ça</h3><div class="action-list">${(r.beginner||[]).map(x=>`<div class="action-item"><strong>✅ Fais ça :</strong> ${escapeHtml(x.do)}<br><strong>❌ Ne fais pas ça :</strong> ${escapeHtml(x.dont)}</div>`).join('')}</div></div>
    <div class="report-section"><h3>🎣 Hooks professionnels à placer</h3><p><strong>Début 0–3 sec :</strong></p><ul>${(r.hooks?.start||[]).map(li).join('')}</ul><p><strong>Milieu de vidéo :</strong></p><ul>${(r.hooks?.middle||[]).map(li).join('')}</ul><p><strong>Fin / dernières secondes :</strong></p><ul>${(r.hooks?.end||[]).map(li).join('')}</ul></div>
    <div class="report-section"><h3>⏱ Analyse timeline</h3><div class="action-list">${(r.timeline||[]).map(t=>`<div class="action-item"><strong>${escapeHtml(t.time)} — Problème :</strong> ${escapeHtml(t.problem)}<br><strong>Correction :</strong> ${escapeHtml(t.fix)}</div>`).join('')}</div></div>
    <div class="report-section"><h3>🛠 Plan d’action prioritaire</h3><ol>${(r.actions||[]).map(li).join('')}</ol></div>
    <div class="report-section"><h3>✍️ Script amélioré prêt à utiliser</h3><div class="text-output">${escapeHtml(r.improvedScript || '')}</div></div>
    <div class="report-section"><h3>📲 Légende proposée</h3><p>${escapeHtml(r.caption || '')}</p></div>`;
}
function li(x){ return `<li>${escapeHtml(x)}</li>`; }
function labelScore(k){ const map={hook:'Hook',clarity:'Clarté',rhythm:'Rythme',retention:'Rétention',cta:'CTA',script:'Script',emotion:'Émotion',edit:'Montage'}; return map[k]||k; }
function escapeHtml(str){ return String(str||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }


async function ensureFramesForThumbnail(){
  if(state.frames && state.frames.length) return true;
  if(!state.file){ $('thumbStatus').textContent = '⚠️ Importe une vidéo dans “Analyse vidéo” avant de créer une miniature.'; return false; }
  $('thumbStatus').textContent = '⏳ Extraction rapide des images de la vidéo...';
  try{
    const {frames, meta} = await extractFrames(state.file);
    state.frames = frames; state.meta = meta;
    renderFrameOptions();
    $('thumbStatus').textContent = '✅ Images extraites. Tu peux créer la miniature.';
    return true;
  }catch(e){
    $('thumbStatus').textContent = '⚠️ Impossible d’extraire une image : ' + e.message;
    return false;
  }
}

function renderFrameOptions(){
  if(!$('thumbFrameSelect')) return;
  if(!state.frames || !state.frames.length){
    $('thumbFrameSelect').innerHTML = '<option value="">Analyse ou importe une vidéo d’abord</option>';
    return;
  }
  $('thumbFrameSelect').innerHTML = state.frames.map((f,i)=>`<option value="${i}">Image ${i+1} — vers ${f.time}s</option>`).join('');
}

async function generateThumbnail(){
  const ok = await ensureFramesForThumbnail();
  if(!ok) return;
  const frameIndex = Number($('thumbFrameSelect').value || 0);
  const frame = state.frames[frameIndex] || state.frames[0];
  if(!frame){ $('thumbStatus').textContent='⚠️ Aucune image disponible.'; return; }

  const img = new Image();
  img.onload = () => drawThumbnail(img);
  img.onerror = () => { $('thumbStatus').textContent = '⚠️ Image vidéo illisible.'; };
  img.src = 'data:image/jpeg;base64,' + frame.image;
}

function drawThumbnail(img){
  const canvas = $('thumbCanvas');
  const ctx = canvas.getContext('2d');
  const format = $('thumbFormat').value;
  const style = $('thumbStyle').value;
  const season = String($('thumbSeason').value || '1');
  const episode = String($('thumbEpisode').value || '1');
  const title = ($('thumbTitle').value || 'ÇA A DÉGÉNÉRÉ').trim().toUpperCase();

  const sizes = { tiktok:[1080,1920], youtube:[1280,720], square:[1080,1080] };
  const [w,h] = sizes[format] || sizes.tiktok;
  canvas.width = w; canvas.height = h;

  // Fond : image de la vidéo recadrée proprement.
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  const styles = {
    viral: { top:'rgba(255,46,46,.92)', bottom:'rgba(0,0,0,.70)', stroke:'#000', badge:'#ffdd00', text:'#fff', accent:'#ff2e2e' },
    cinema:{ top:'rgba(0,0,0,.74)', bottom:'rgba(0,0,0,.82)', stroke:'#000', badge:'#d4af37', text:'#fff', accent:'#d4af37' },
    clean: { top:'rgba(255,255,255,.88)', bottom:'rgba(255,255,255,.88)', stroke:'#fff', badge:'#111827', text:'#111827', accent:'#2563eb' },
    humour:{ top:'rgba(255,199,0,.90)', bottom:'rgba(0,0,0,.68)', stroke:'#000', badge:'#ff4ecd', text:'#fff', accent:'#ff4ecd' },
    mystery:{ top:'rgba(64,0,128,.78)', bottom:'rgba(0,0,0,.82)', stroke:'#000', badge:'#7c3aed', text:'#fff', accent:'#7c3aed' }
  };
  const st = styles[style] || styles.viral;

  // Dégradés pour lisibilité TikTok.
  const gradTop = ctx.createLinearGradient(0,0,0,h*.32);
  gradTop.addColorStop(0, st.top); gradTop.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = gradTop; ctx.fillRect(0,0,w,h*.35);
  const gradBottom = ctx.createLinearGradient(0,h*.55,0,h);
  gradBottom.addColorStop(0,'rgba(0,0,0,0)'); gradBottom.addColorStop(1, st.bottom);
  ctx.fillStyle = gradBottom; ctx.fillRect(0,h*.52,w,h*.48);

  // Badge saison / épisode.
  const badgeText = `S${season}  EP${episode}`;
  ctx.font = `900 ${Math.round(w*0.055)}px Arial`;
  const padX = Math.round(w*0.035), padY = Math.round(w*0.024);
  const bw = ctx.measureText(badgeText).width + padX*2;
  const bh = Math.round(w*0.095);
  roundRect(ctx, Math.round(w*.055), Math.round(h*.055), bw, bh, Math.round(w*.025), st.badge);
  ctx.fillStyle = style === 'clean' ? '#fff' : '#111';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, Math.round(w*.055)+padX, Math.round(h*.055)+bh/2);

  // Bande accent.
  ctx.fillStyle = st.accent;
  ctx.fillRect(Math.round(w*.055), Math.round(h*.82), Math.round(w*.18), Math.max(8,Math.round(w*.015)));

  // Titre principal.
  const maxWidth = Math.round(w*.88);
  const fontSize = format === 'youtube' ? Math.round(w*0.075) : Math.round(w*0.105);
  const lines = wrapText(ctx, title, maxWidth, `900 ${fontSize}px Arial`);
  const lineHeight = Math.round(fontSize*1.03);
  let y = format === 'youtube' ? Math.round(h*.62) : Math.round(h*.74);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.lineJoin = 'round';
  lines.slice(0,3).forEach(line => {
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = Math.max(10, Math.round(fontSize*.16));
    ctx.strokeText(line, Math.round(w*.055), y);
    ctx.fillStyle = st.text;
    ctx.fillText(line, Math.round(w*.055), y);
    y += lineHeight;
  });

  // Petit conseil visuel discret.
  ctx.font = `800 ${Math.round(w*0.032)}px Arial`;
  ctx.fillStyle = style === 'clean' ? '#111827' : '#fff';
  ctx.globalAlpha = .92;
  ctx.fillText('Nouvel épisode', Math.round(w*.055), Math.round(h*.94));
  ctx.globalAlpha = 1;

  state.lastThumbnail = canvas.toDataURL('image/png');
  $('downloadThumbBtn').disabled = false;
  $('thumbStatus').textContent = '✅ Miniature créée. Tu peux la télécharger en PNG.';
  updateThumbnailPrompt();
}

function updateThumbnailPrompt(){
  if(!$('thumbPrompt')) return;
  const format = $('thumbFormat')?.value || 'tiktok';
  const style = $('thumbStyle')?.value || 'viral';
  const season = $('thumbSeason')?.value || '1';
  const episode = $('thumbEpisode')?.value || '1';
  const title = $('thumbTitle')?.value || 'ÇA A DÉGÉNÉRÉ';
  const ratio = format === 'tiktok' ? 'format vertical 9:16 TikTok' : format === 'youtube' ? 'format horizontal 16:9 YouTube' : 'format carré 1:1';
  $('thumbPrompt').textContent =
`Miniature ${ratio}, style ${style}, basée sur une frame réelle de la vidéo.
Texte principal très lisible : "${title}".
Badge visible : "S${season} EP${episode}".
Contraste fort, visage/action bien visible, fond légèrement dramatique, typographie très grosse, lisible sur téléphone, composition virale TikTok, pas trop chargée, attention immédiate.`;
}

function downloadThumbnail(){
  if(!state.lastThumbnail){ $('thumbStatus').textContent='⚠️ Crée une miniature avant de télécharger.'; return; }
  const a = document.createElement('a');
  const season = $('thumbSeason').value || '1';
  const episode = $('thumbEpisode').value || '1';
  a.href = state.lastThumbnail;
  a.download = `miniature_S${season}_EP${episode}.png`;
  document.body.appendChild(a); a.click(); a.remove();
}

function roundRect(ctx, x, y, w, h, r, fill){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

function wrapText(ctx, text, maxWidth, font){
  ctx.font = font;
  const words = String(text).split(/\s+/);
  const lines=[]; let line='';
  for(const word of words){
    const test = line ? line + ' ' + word : word;
    if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = word; }
    else line = test;
  }
  if(line) lines.push(line);
  return lines;
}


function getHistory(){ return JSON.parse(localStorage.getItem('tta_history') || '[]'); }
function saveHistory(report){ const h = getHistory(); h.unshift(report); localStorage.setItem('tta_history', JSON.stringify(h.slice(0,50))); renderHistory(); }
function renderHistory(){
  const h=getHistory();
  if(!h.length){ $('historyList').innerHTML='<p>Historique vide : les prochaines analyses sauvegardées apparaîtront ici.</p>'; return; }
  $('historyList').innerHTML = h.map(r=>`<div class="history-item"><div><h3>${escapeHtml(r.meta?.fileName || r.title || 'Analyse vidéo')}</h3><p>${new Date(r.createdAt).toLocaleString('fr-FR')} — Score ${r.globalScore || 0}/100</p></div><button class="btn ghost" onclick="openHistory('${r.id}')">Ouvrir</button></div>`).join('');
}
function openHistory(id){ const r=getHistory().find(x=>x.id===id); if(!r)return; showView('analyze'); renderReport(r); $('analyzeStatus').textContent='📌 Analyse chargée depuis l’historique.'; }
function refreshSelects(){
  const h=getHistory(); const html = h.length ? h.map(r=>`<option value="${r.id}">${escapeHtml(r.meta?.fileName || r.title)} — ${new Date(r.createdAt).toLocaleDateString('fr-FR')}</option>`).join('') : '<option value="">Aucune analyse disponible</option>';
  $('scriptAnalysisSelect').innerHTML=html; $('plannerAnalysisSelect').innerHTML=html;
}
function selectedReport(selectId){ const id=$(selectId).value; return getHistory().find(r=>r.id===id); }
function generateScriptFromSelected(){ const r=selectedReport('scriptAnalysisSelect'); if(!r){ $('scriptOutput').textContent='Analyse d’abord une vidéo.'; return; } $('scriptOutput').textContent = `${r.improvedScript || ''}\n\nVERSION SIMPLE POUR TOURNER :\n1) Hook : ${r.hooks?.start?.[0] || 'Attends, regarde ça.'}\n2) Développement : explique en phrases courtes, une idée à la fois.\n3) Relance milieu : ${r.hooks?.middle?.[0] || 'Regarde ce détail.'}\n4) Fin : ${r.hooks?.end?.[0] || 'Dis-moi ce que tu en penses.'}\n\nLégende : ${r.caption || ''}`; }
function createPlanFromSelected(){ const r=selectedReport('plannerAnalysisSelect'); if(!r){ $('plannerOutput').innerHTML='<p>Analyse d’abord une vidéo.</p>'; return; } const p=r.plan||{}; $('plannerOutput').innerHTML = `<div class="plan-card"><strong>Titre</strong><p>${escapeHtml(p.title || r.title || 'Vidéo optimisée')}</p></div><div class="plan-card"><strong>Horaire conseillé</strong><p>${escapeHtml(p.bestTime || '19h00–21h00')}</p></div><div class="plan-card"><strong>CTA</strong><p>${escapeHtml(p.cta || r.hooks?.end?.[0] || '')}</p></div><div class="plan-card"><strong>Hashtags</strong><p>${escapeHtml((p.hashtags||['#tiktokfrance','#viral']).join(' '))}</p></div>`; }
