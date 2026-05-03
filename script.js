let selectedVideo = null;
let selectedVideoUrl = null;
let lastAnalysis = null;
let thumbState = { style:'viral', image:null, videoFile:null, videoUrl:null };

const titles = {
  analyze:['📊 Analyser une vidéo','Glisse ta vidéo au centre, choisis le contexte, puis lance l\'analyse.'],
  history:['📂 Historique','Retrouve toutes les analyses sauvegardées automatiquement.'],
  planner:['📅 Planifier mes vidéos','Prépare les épisodes, hooks, titres et horaires de publication.'],
  scripts:['✍️ Générateur scripts','Réécris une vidéo en script TikTok propre, clair et viral.'],
  thumbnails:['🖼️ Miniatures TikTok','Crée une miniature verticale depuis une frame vidéo ou une image importée.'],
  ideas:['💡 Idées de contenu','Des idées simples pour enchaîner les vidéos.'],
  checklist:['✅ Checklist TikTok','Les règles simples avant de publier.']
};

window.addEventListener('DOMContentLoaded', () => {
  loadKeys();
  updateApiLabels();
  renderHistory();
  renderPlans();
  renderIdeas();
  initThumbnail();
  renderCompetitors();
  renderMyChannel();

  // FIX CRITIQUE: restaurer la session et la page après actualisation
  const savedKeys = getKeys();
  const hadSession = localStorage.getItem('TA_SESSION') === '1';
  if (hadSession && (savedKeys.claude || savedKeys.openai || savedKeys.gemini)) {
    // Rester dans l'app, pas retourner à la page de connexion
    qs('loginScreen').classList.add('hidden');
    qs('app').classList.remove('hidden');
    updateApiLabels();
    setTimeout(renderThumbnail, 50);
    // Restaurer la dernière page visitée
    const lastPage = localStorage.getItem('TA_LAST_PAGE') || 'analyze';
    const btn = document.querySelector('[data-page="' + lastPage + '"]');
    switchPage(lastPage, btn);
  }
});

function qs(id){return document.getElementById(id)}
function getKeys(){return {claude:localStorage.getItem('CLAUDE_KEY')||'', openai:localStorage.getItem('OPENAI_KEY')||'', gemini:localStorage.getItem('GEMINI_KEY')||''}}
function togglePassword(id){const el=qs(id); el.type = el.type === 'password' ? 'text' : 'password'}
function loadKeys(){const k=getKeys(); if(qs('claudeKey')) qs('claudeKey').value=k.claude; if(qs('openaiKey')) qs('openaiKey').value=k.openai; if(qs('geminiKey')) qs('geminiKey').value=k.gemini; const ok=!!(k.claude||k.openai||k.gemini); if(ok){qs('enterButton').disabled=false; qs('apiLive').textContent='Connecté'; qs('apiLive').classList.add('ok'); qs('apiStatus').textContent='✅ Clés déjà enregistrées sur ce navigateur'; qs('apiStatus').className='status-box status-ok';}}
async function connectAPIs(){
  const claude=qs('claudeKey')?qs('claudeKey').value.trim():''; const openai=qs('openaiKey').value.trim(); const gemini=qs('geminiKey').value.trim();
  if(!claude&&!openai&&!gemini){setApiStatus('❌ Ajoute au moins une clé API.','error'); return;}
  if(claude)localStorage.setItem('CLAUDE_KEY',claude);
  if(openai)localStorage.setItem('OPENAI_KEY',openai);
  if(gemini)localStorage.setItem('GEMINI_KEY',gemini);
  const activeProvider = gemini ? 'Gemini + OpenAI' : openai ? 'OpenAI' : 'configuré';
  setApiStatus('✅ Clés enregistrées -- ' + activeProvider + ' prêt.', 'ok');
  qs('enterButton').disabled=false; qs('apiLive').textContent='Connecté'; qs('apiLive').classList.add('ok'); updateApiLabels();
}
function setApiStatus(msg,type){qs('apiStatus').textContent=msg; qs('apiStatus').className='status-box '+(type==='ok'?'status-ok':type==='error'?'status-error':'')}
function updateApiLabels(){const k=getKeys(); if(qs('claudeLabel'))qs('claudeLabel').textContent=k.claude?'Oui':'Non'; qs('openaiLabel').textContent=k.openai?'Oui':'Non'; qs('geminiLabel').textContent=k.gemini?'Oui':'Non'; if(qs('claudeDot'))qs('claudeDot').classList.toggle('ok',!!k.claude); qs('openaiDot').classList.toggle('ok',!!k.openai); qs('geminiDot').classList.toggle('ok',!!k.gemini)}
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
  localStorage.setItem('TA_LAST_PAGE', page);
  if(page==='thumbnails') setTimeout(renderThumbnail,50);
  if(page==='mychannel') renderMyChannel();
  if(page==='competitors') renderCompetitors();
  if(page==='history') renderHistory();
}
function dragOver(e){e.preventDefault(); qs('dropZone').classList.add('drag')}
function dragLeave(e){e.preventDefault(); qs('dropZone').classList.remove('drag')}
function dropVideo(e){e.preventDefault(); qs('dropZone').classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) pickVideo(f)}
function pickVideo(file){if(!file||!file.type.startsWith('video/')){alert('Choisis un fichier vidéo.'); return;} selectedVideo=file; if(selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl); selectedVideoUrl=URL.createObjectURL(file); qs('videoName').textContent=file.name; qs('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · prêt à analyser`; qs('videoPreview').classList.remove('hidden'); qs('contextPanel').classList.remove('hidden'); qs('analyzeBtn').disabled=false; qs('analysisStatus').textContent='Video prete. Tu peux lancer l\'analyse.'; qs('step2').classList.add('active'); thumbState.videoFile=file; thumbState.videoUrl=selectedVideoUrl;}
function removeVideo(){selectedVideo=null; qs('videoPreview').classList.add('hidden'); qs('contextPanel').classList.add('hidden'); qs('analyzeBtn').disabled=true; qs('analysisStatus').textContent='Dépose d\'abord une vidéo.'; qs('results').classList.add('hidden')}
function resetAnalyzer(){removeVideo(); qs('results').innerHTML=''; switchPage('analyze', document.querySelector('[data-page="analyze"]'));}

async function extractFrames(file, count=4){
  return new Promise((resolve)=>{
    const video=document.createElement('video'); const url=URL.createObjectURL(file); const frames=[];
    video.preload='metadata'; video.muted=true; video.playsInline=true; video.src=url;
    video.onloadedmetadata=async()=>{
      const duration=video.duration || parseInt(qs('durationSelect').value||60,10); const times=[0.7,0.18,0.48,0.82].slice(0,count).map(p=>Math.min(duration-0.2,Math.max(0.1,duration*p)));
      const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d');
      let idx=0;
      const grab=()=>{
        if(idx>=times.length){URL.revokeObjectURL(url); resolve(frames); return;}
        video.currentTime=times[idx];
      };
      video.onseeked=()=>{
        canvas.width=360; canvas.height=640;
        const vw=video.videoWidth||360, vh=video.videoHeight||640;
        const scale=Math.max(canvas.width/vw,canvas.height/vh); const w=vw*scale,h=vh*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;
        ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(video,x,y,w,h);
        frames.push({time:Math.round(times[idx]), image:canvas.toDataURL('image/jpeg',0.72)}); idx++; grab();
      };
      grab();
    };
    video.onerror=()=>{URL.revokeObjectURL(url); resolve([])};
  });
}



async function analyzeVideo(){
  if(!selectedVideo){ alert('Dépose une vidéo avant.'); return; }
  const k = getKeys();
  if(!k.gemini && !k.openai){ alert('Configure Gemini ou OpenAI dans les paramètres.'); return; }

  qs('results').classList.remove('hidden');
  qs('analyzeBtn').disabled = true;
  qs('step3').classList.add('active');
  qs('analysisStatus').textContent = 'Analyse en cours...';

  const steps = [
    {pct:10, msg:'🎬 Extraction des images de la vidéo...'},
    {pct:30, msg:'👁️ Gemini examine ta vidéo image par image...'},
    {pct:55, msg:'📊 Gemini calcule ses scores...'},
    {pct:75, msg:'🧠 OpenAI valide et affine l\'analyse...'},
    {pct:90, msg:'✍️ Génération du rapport complet...'},
    {pct:100, msg:'✅ Analyse terminée !'}
  ];
  let stepIdx = 0;

  function nextStep(){
    if(stepIdx < steps.length){
      showProgress(steps[stepIdx].msg, steps[stepIdx].pct);
      stepIdx++;
    }
  }

  nextStep(); // step 1 - extraction
  const frames = await extractFrames(selectedVideo, 4);
  const thumbData = frames.length > 0 ? (frames[0].image || '') : '';

  const ctx = {
    videoName: selectedVideo.name,
    duration:    qs('durationSelect')  ? qs('durationSelect').value  : '90',
    contentType: qs('contentType')     ? qs('contentType').value     : 'famille/drama',
    hook:        qs('hookInput')       ? qs('hookInput').value       : '',
    frames
  };

  let report = null;

  try {
    if(k.openai){
      // OpenAI voit les images ET genere le rapport (gpt-4o-mini supporte la vision)
      nextStep(); // step 2
      showProgress('👁️ OpenAI analyse ta video image par image...', 35);
      const visionTxt = await withTimeout(
        callOpenAIVision(k.openai, ctx), 90000, 'OpenAI vision timeout'
      );
      nextStep(); // step 3
      showProgress('📊 Calcul des scores et du rapport...', 65);
      nextStep(); // step 4
      report = await withTimeout(
        callOpenAIReport(k.openai, ctx, visionTxt), 90000, 'OpenAI rapport timeout'
      );
      nextStep(); // step 5

    } else if(k.gemini){
      // Gemini seul - fallback
      nextStep();
      let visionTxt = '';
      try {
        visionTxt = await withTimeout(callGeminiVision(k.gemini, ctx), 90000, 'Gemini timeout');
      } catch(ev){ console.warn('Gemini vision:', ev.message); }
      nextStep(); nextStep();
      report = await withTimeout(
        callGeminiReport(k.gemini, ctx, visionTxt), 90000, 'Gemini rapport timeout'
      );
      nextStep();

    } else {
      throw new Error('Configure ta cle OpenAI dans les parametres.');
    }
    nextStep(); // done

  } catch(e) {
    console.error('Analyse error:', e.message);
    showProgress('Erreur : ' + e.message, 0);
    qs('analyzeBtn').disabled = false;
    qs('analysisStatus').textContent = 'Erreur - verifie ta cle API.';
    return;
  }

  if(!report){ report = localFallbackReport(ctx); }

  lastAnalysis = {
    id: Date.now(),
    date: new Date().toLocaleString('fr-FR'),
    video: selectedVideo.name,
    thumb: thumbData,
    report
  };
  saveHistory(lastAnalysis);
  renderReport(report);
  renderHistory();
  qs('analysisStatus').textContent = 'Analyse terminée et sauvegardée.';
  qs('analyzeBtn').disabled = false;
}

// ─── TIMEOUT WRAPPER ─────────────────────────────────────────────────────────
function withTimeout(promise, ms, label){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label + ' (' + (ms/1000) + 's)')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); })
           .catch(e => { clearTimeout(t); reject(e); });
  });
}

// ─── BARRE DE PROGRESSION ────────────────────────────────────────────────────
function showProgress(msg, pct){
  const el = qs('results');
  if(!el) return;
  const color = pct === 0 ? '#ef4444' : 'linear-gradient(90deg,var(--accent),#06b6d4)';
  el.innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <h2 style="font-size:16px;margin-bottom:6px">${msg}</h2>
      <div style="width:100%;background:#eceefd;border-radius:99px;height:10px;margin:14px 0 8px;overflow:hidden">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:99px;transition:width .7s ease"></div>
      </div>
      <p style="color:#888;font-size:12px;margin:0">
        ${pct < 100 && pct > 0
          ? 'L\'analyse peut prendre jusqu\'à 90 secondes. Ne ferme pas la page.'
          : pct === 100 ? 'Génération du rapport en cours...' : 'Vérifie tes clés API et ta connexion internet.'}
      </p>
    </div>`;
}

// ─── ÉTAPE 1 : GEMINI VOIT LA VIDÉO (vision multimodale) ─────────────────────
// --- GEMINI MODELS (tries each until one works) ---------------------
const GEMINI_VISION_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-pro-vision',
];
const GEMINI_TEXT_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-pro',
];
const GEMINI_BASES = [
  'https://generativelanguage.googleapis.com/v1beta/models/',
  'https://generativelanguage.googleapis.com/v1/models/',
];

async function geminiPost(geminiKey, models, body) {
  for (const base of GEMINI_BASES) {
    for (const model of models) {
      try {
        const url = base + model + ':generateContent?key=' + geminiKey;
        const r = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body)
        });
        const data = await r.json();
        // 404 = model not found, try next
        if (data.error && (data.error.code === 404 || data.error.status === 'NOT_FOUND')) continue;
        // 429 = quota, surface the error
        if (data.error && data.error.code === 429) throw new Error('Quota Gemini depasse. Attends quelques minutes puis relance.');
        // Other errors
        if (data.error) throw new Error('Gemini (' + model + '): ' + data.error.message);
        // Success
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch(e) {
        if (e.message.includes('Quota')) throw e; // Re-throw quota errors immediately
        // Network error or other - try next model
      }
    }
  }
  throw new Error('Aucun modele Gemini disponible avec cette cle API. Verifie ta cle sur ai.google.dev');
}

async function callGeminiVision(geminiKey, ctx){
  const parts = [{
    text: 'Tu es un expert TikTok. Analyse ces ' + ctx.frames.length + ' images d\'une video TikTok. Niche: ' + ctx.contentType + ' | Duree: ~' + ctx.duration + 's | Hook: "' + (ctx.hook||'non precise') + '". Decris: ce qui se passe, les expressions, les sous-titres visibles, le rythme, la qualite image, ce qui accroche et ce qui fait decrocher.'
  }];
  for(const frame of ctx.frames){
    if(frame.image){
      const b64 = frame.image.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
    }
  }
  return geminiPost(geminiKey, GEMINI_VISION_MODELS, {
    contents: [{parts}],
    generationConfig: {temperature: 0.2}
  });
}

async function callGeminiScores(geminiKey, ctx, visionAnalysis){
  const prompt = 'Expert TikTok: donne tes scores PRECIS et VARIES pour cette video. JSON uniquement:\n{"hook":<3-10>,"rhythm":<3-10>,"clarity":<3-10>,"cta":<3-10>,"emotion":<3-10>,"thumbnail":<3-10>,"score_global":<35-96>,"points_forts":["<p1>","<p2>"],"points_faibles":["<p1>","<p2>","<p3>"],"verdict_gemini":"<2 phrases>"}\n\nAnalyse visuelle:\n' + visionAnalysis;
  const txt = await geminiPost(geminiKey, GEMINI_TEXT_MODELS, {
    contents: [{parts:[{text: prompt}]}],
    generationConfig: {temperature: 0.1, responseMimeType: 'application/json'}
  });
  try { return JSON.parse(txt.replace(/```json|```/g,'')); }
  catch(e) { return {}; }
}


async function callOpenAIValidate(openaiKey, ctx, visionAnalysis, geminiScores){
  const scoresText = JSON.stringify(geminiScores, null, 2);

  const prompt = [
    'Tu es le meilleur expert TikTok senior au monde. Tu travailles avec Gemini qui vient d\'analyser une vidéo.',
    '',
    '== CE QUE GEMINI A VU (analyse visuelle) ==',
    visionAnalysis,
    '',
    '== SCORES DE GEMINI ==',
    scoresText,
    '',
    '== TA MISSION ==',
    'Vidéo: ' + ctx.videoName + ' | Type: ' + ctx.contentType + ' | Hook: "' + (ctx.hook||'non précisé') + '" | Durée: ~' + ctx.duration + 's',
    '',
    '1. VALIDE ou CORRIGE les scores de Gemini (si tu n\'es pas d\'accord, change le score et explique pourquoi)',
    '2. COMPLÈTE l\'analyse avec ton expertise TikTok (timestamps précis, phrases prêtes à dire)',
    '3. Génère un rapport PÉDAGOGIQUE COMPLET pour un débutant total',
    '4. Rappelle que les vidéos >1min sont payées DOUBLE par TikTok',
    '',
    'RÈGLES: Scores variés 3-10 jamais identiques. Phrases EXACTES prêtes à copier. Timestamps précis.',
    '',
    'Réponds UNIQUEMENT en JSON valide:',
    '{"score":<score_final_apres_validation>,"potential":"<phrase>","summaryTitle":"<titre>","summaryText":"<3-5 phrases pedagogiques>","validation_gemini":"<tu es accord ou pas avec Gemini et pourquoi>","scores":{"hook":<3-10>,"rhythm":<3-10>,"clarity":<3-10>,"cta":<3-10>,"emotion":<3-10>,"thumbnail":<3-10>},"hookScores":{"start":<3-10>,"middle":<3-10>,"end":<3-10>,"retention":<3-10>},"cards":{"hook":"<timestamp + phrase alternative exacte>","rhythm":"<secondes exactes + correction>","clarity":"<comprehensible ? correction>","cta":"<phrase exacte CTA>"},"deep":{"global":"<analyse globale>","hookStart":"<0-3s exact>","hookMiddle":"<milieu exact>","hookEnd":"<fin exacte>","subtitles":"<corrections sous-titres>","sound":"<corrections audio>"},"timeline":[["0-1 sec","<conseil>"],["1-3 sec","<conseil>"],["3-8 sec","<conseil>"],["8-15 sec","<conseil critique>"],["15-25 sec","<conseil>"],["25-45 sec","<conseil>"],["45sec-1min","<conseil monetisation>"],["1min-fin","<conseil premium>"],["Dernieres sec","<CTA mot pour mot>"]],"hooks":["<hook 1>","<hook 2>","<hook 3>","<hook 4>","<hook 5>"],"titres":["<titre 1>","<titre 2>","<titre 3>","<titre 4>","<titre 5>"],"hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8"],"pubHeure":"<ex Vendredi 19h30>","pubRaison":"<pourquoi>","miniature":{"texte":"<TEXTE GROS>","couleurs":"<palette>","scene":"<scene exacte>"},"actions":["<action 1>","<action 2>","<action 3>","<action 4>","<action 5>"],"rewrite":["<rewrite hook>","<rewrite milieu>","<rewrite fin>","<rewrite titre>"],"checklist":["<point 1>","<point 2>","<point 3>","<point 4>","<point 5>"],"errorsToAvoid":["<erreur 1>","<erreur 2>","<erreur 3>"],"beginner":{"do":["<do 1>","<do 2>","<do 3>","<do 4>","<do 5>"],"dont":["<dont 1>","<dont 2>","<dont 3>","<dont 4>","<dont 5>"]},"score_details":{"revisionnage":<0-10>,"completion":<0-8>,"partages":<0-6>,"commentaires":<0-4>,"likes":<0-2>}}'
  ].join('\n');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+openaiKey},
    body: JSON.stringify({
      model:'gpt-4o-mini',
      temperature:0.3,
      response_format:{type:'json_object'},
      messages:[
        {role:'system', content:'Expert TikTok senior. Tu travailles avec Gemini. JSON valide uniquement. Scores vraiment varies.'},
        {role:'user', content:prompt}
      ]
    })
  });

  if(!r.ok){
    const err = await r.json().catch(()=>({}));
    throw new Error('OpenAI: ' + (err.error?.message || r.status));
  }
  const data = await r.json();
  if(data.error) throw new Error('OpenAI: ' + data.error.message);
  const txt = data.choices?.[0]?.message?.content;
  if(!txt) throw new Error('OpenAI: réponse vide');
  return normalizeReport(JSON.parse(txt), localFallbackReport(ctx));
}

// ─── FALLBACKS (si une seule IA) ─────────────────────────────────────────────
async function callOpenAIVision(openaiKey, ctx){
  const imageContent = ctx.frames.filter(f=>f.image).map(f=>({
    type:'image_url',
    image_url:{url:f.image, detail:'low'}
  }));
  if(!imageContent.length) return 'Pas d images disponibles.';
  const r = await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+openaiKey},
    body:JSON.stringify({
      model:'gpt-4o-mini',
      max_tokens:1000,
      messages:[{role:'user',content:[
        {type:'text',text:'Analyse ces '+imageContent.length+' frames d\'une video TikTok famille/drama (~'+ctx.duration+'s). Decris avec precision: expressions des personnes, sous-titres visibles (taille/couleur/lisibilite), qualite image, mouvements, rythme, moments forts/faibles, ce qui accroche et ce qui fait partir. Cite ce que tu VOIS vraiment.'},
        ...imageContent
      ]}]
    })
  });
  if(!r.ok){const e=await r.json().catch(()=>({})); if(e.error?.code==='invalid_request_error') return ''; throw new Error('OpenAI vision: '+(e.error?.message||r.status));}
  const data=await r.json();
  return data.choices?.[0]?.message?.content||'';
}

async function callOpenAIReport(openaiKey, ctx, visionAnalysis){
  const prompt = buildUltraPrompt(ctx, visionAnalysis);
  const r = await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+openaiKey},
    body:JSON.stringify({
      model:'gpt-4o-mini',
      max_tokens:3000,
      temperature:0.2,
      response_format:{type:'json_object'},
      messages:[
        {role:'system',content:'Tu es un expert TikTok senior ultra-critique. Tu analyses des videos avec la rigueur d\'un chirurgien. Tu donnes des notes BASSES si la video est mauvaise (1-4/10). Tu es factuel, precis, et tu donnes des phrases exactes a copier. JSON valide uniquement.'},
        {role:'user',content:prompt}
      ]
    })
  });
  if(!r.ok){const e=await r.json().catch(()=>({})); throw new Error('OpenAI: '+(e.error?.message||r.status));}
  const data=await r.json();
  const txt=data.choices?.[0]?.message?.content;
  if(!txt) throw new Error('OpenAI: reponse vide');
  return normalizeReport(JSON.parse(txt), localFallbackReport(ctx));
}

async function callGeminiReport(geminiKey, ctx, visionAnalysis){
  const prompt = buildUltraPrompt(ctx, visionAnalysis);
  const txt = await geminiPost(geminiKey, GEMINI_TEXT_MODELS, {
    contents:[{parts:[{text:prompt}]}],
    generationConfig:{temperature:0.2, responseMimeType:'application/json'}
  });
  return normalizeReport(JSON.parse(txt.replace(/```json|```/g,'')), localFallbackReport(ctx));
}

function buildUltraPrompt(ctx, visionAnalysis){
  const vision = visionAnalysis ? '\n\nANALYSE VISUELLE DES FRAMES:\n'+visionAnalysis+'\n' : '';
  return 'Tu es un expert TikTok senior ultra-critique qui a analyse des milliers de videos virales. Tu DOIS etre severe et honnete: une video sans hook = 1-2/10, pas 6/10.\n\nALGORITHME TIKTOK 2025 (ce que tu sais):\n- Taux de completion >70% = viral. <40% = mort.\n- Revisionnage = signal le plus fort de viralite.\n- Partages > Commentaires > Likes\n- Premiere fenetre critique: 3 PREMIERES SECONDES\n- TikTok Vision AI scanne: sous-titres, couleurs, coupes, dynamisme\n- Videos >1min = payees double\n- Hook absent = 90% des gens partent en 2sec\n\nVIDEO:\n- Nom: '+ctx.videoName+'\n- Type: '+ctx.contentType+'\n- Hook actuel: "'+ctx.hook+'"\n- Duree: ~'+ctx.duration+'s'+vision+'\n\nREGLES ABSOLUES:\n1. Si la video est mauvaise, DIS-LE. Note 1-4/10 si necessaire.\n2. Timeline TOUTES LES 5 SECONDES avec action precise.\n3. Phrases EXACTES a dire/ecrire, pas des conseils vagues.\n4. Critique FACTUELLE: cite exactement ce qui ne va pas.\n5. Audience 12-65 ans: explique simplement.\n\nReponds en JSON exact:\n{"score_global":<1.0-10.0>,"scores":{"hook":<1-10>,"visuel":<1-10>,"viralite":<1-10>,"coherence":<1-10>,"retention":<1-10>,"magnetisme":<1-10>},"potentiel":"<phrase critique courte>","plan_action":{"structure":"<correction structure - phrase exacte>","technique":"<correction technique - ce qu\'il faut faire>","strategie":"<strategie future - serie, format, etc>"},"analyse_hook":"<analyse 0-3s ultra-critique avec timestamp et phrase de remplacement exacte>","dynamisme_visuel":"<analyse rythme, sous-titres, coupes, couleurs - critique precise>","script_storytelling":"<analyse narration, tension, coherence - tres critique>","potentiel_viral":"<analyse partageabilite, emotion, angle - precise>","audio_ambiance":"<analyse voix, musique, effets - critique>","call_to_action":"<analyse CTA - timing exact et phrase de remplacement>","timeline":[["0-5s","<ce qui se passe + note /10 + action precise>"],["5-10s","<...>"],["10-15s","<...>"],["15-20s","<...>"],["20-25s","<...>"],["25-30s","<...>"],["30-35s","<...>"],["35-40s","<...>"],["40-45s","<...>"],["45-50s","<...>"],["50-55s","<...>"],["55-60s","<...>"],["60s+","<si applicable>"]],"hooks":["<hook viral 1 - phrase exacte>","<hook viral 2>","<hook viral 3>","<hook viral 4>","<hook viral 5>"],"titres":["<titre TikTok viral 1>","<titre 2>","<titre 3>","<titre 4>","<titre 5>"],"hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8"],"pub_heure":"<ex: Vendredi 19h30>","pub_raison":"<pourquoi cet horaire>","miniature":{"texte":"<TEXTE GROS MAX 5 MOTS>","couleurs":"<palette exacte>","scene":"<scene a capturer>"},"transcription":"<transcription approximative du contenu audio/textes vus>","beginner_tips":["<conseil 1 simple pour debutant>","<conseil 2>","<conseil 3>","<conseil 4>","<conseil 5>"]}';
}


function normalizeReport(r, base){
  if(!r||typeof r!=='object') return base;
  // Support both old format (score/100) and new format (score_global/10)
  if(r.score && !r.score_global) r.score_global = (r.score/10).toFixed(1)*1;
  if(r.score_global && !r.score) r.score = Math.round(r.score_global*10);
  return {
    ...base,...r,
    scores:{...base.scores,...(r.scores||{})},
    plan_action:{...base.plan_action,...(r.plan_action||{})},
    miniature:{...base.miniature,...(r.miniature||{})},
    timeline:r.timeline?.length?r.timeline:base.timeline,
    hooks:r.hooks?.length?r.hooks:base.hooks,
    titres:r.titres?.length?r.titres:base.titres,
    hashtags:r.hashtags?.length?r.hashtags:base.hashtags,
    beginner_tips:r.beginner_tips?.length?r.beginner_tips:base.beginner_tips,
  };
}


function ensureReport(r){
  const base = localFallbackReport({});
  r = r || {};
  return {
    ...base, ...r,
    scores:{...base.scores,...(r.scores||{})},
    cards:{...base.cards,...(r.cards||{})},
    deep:{...base.deep,...(r.deep||{})},
    beginner:{...base.beginner,...(r.beginner||{})},
    timeline:(r.timeline&&r.timeline.length)?r.timeline:base.timeline,
    hooks:(r.hooks&&r.hooks.length)?r.hooks:base.hooks,
    actions:(r.actions&&r.actions.length)?r.actions:base.actions,
    rewrite:(r.rewrite&&r.rewrite.length)?r.rewrite:base.rewrite,
    checklist:(r.checklist&&r.checklist.length)?r.checklist:base.checklist,
    errorsToAvoid:(r.errorsToAvoid&&r.errorsToAvoid.length)?r.errorsToAvoid:base.errorsToAvoid
  };
}
function localFallbackReport(p){
  return {
    score_global:5.0, score:50,
    potentiel:'Analyse non disponible - verifie ta cle API',
    scores:{hook:5,visuel:5,viralite:5,coherence:5,retention:5,magnetisme:5},
    plan_action:{
      structure:'Configure ta cle OpenAI.',
      technique:'Va dans les parametres et entre ta cle API OpenAI.',
      strategie:'Une fois configure, l\'analyse sera ultra-detaillee et critique.'
    },
    analyse_hook:'Non disponible - cle API requise.',
    dynamisme_visuel:'Non disponible.',
    script_storytelling:'Non disponible.',
    potentiel_viral:'Non disponible.',
    audio_ambiance:'Non disponible.',
    call_to_action:'Non disponible.',
    timeline:[
      ['0-5s','Analyse non disponible'],['5-10s','Analyse non disponible'],
      ['10-15s','Analyse non disponible'],['15-20s','Analyse non disponible'],
      ['20-25s','Analyse non disponible'],['25-30s','Analyse non disponible'],
      ['30-35s','Analyse non disponible'],['35-40s','Analyse non disponible'],
      ['40-45s','Analyse non disponible'],['45-50s','Analyse non disponible'],
      ['50-55s','Analyse non disponible'],['55-60s','Analyse non disponible'],
    ],
    hooks:['Ca a degénere direct...','Attends sa reaction...','Personne n\'attendait ca.','Tu aurais fait quoi ?','La suite arrive...'],
    titres:['Titre a generer avec cle API','Titre 2','Titre 3','Titre 4','Titre 5'],
    hashtags:['#famille','#drama','#tiktokfr','#couple','#reaction','#viral','#lifestyle','#humour'],
    pub_heure:'Vendredi 19h30',
    pub_raison:'Meilleur creneau pour la niche famille/drama',
    miniature:{texte:'CA A DEGÉNERE',couleurs:'Fond rouge, texte blanc',scene:'Expression de surprise'},
    transcription:'Transcription non disponible - cle API requise.',
    beginner_tips:['Configure ta cle OpenAI','Lance l\'analyse','Lis le rapport','Applique les corrections','Reanalyse apres corrections']
  };
}

function renderHistoryInto(el, h){
  if(!h||!h.length){
    el.innerHTML='<div class="empty-card"><h2>Aucune analyse</h2><p>Lance une premiere analyse pour la voir ici.</p></div>';
    return;
  }
  el.innerHTML = h.map(item => {
    const r = item.report || {};
    const sg = r.score_global || (r.score ? r.score/10 : 5);
    const sc = r.scores || {};
    const pa = r.plan_action || {};
    const planTxt = [pa.structure,pa.technique,pa.strategie].filter(Boolean).join(' ').substring(0,200);
    const col = sg>=7.5?'#16a34a':sg>=5?'#d97706':'#dc2626';
    const scoreBar = (val, label) => {
      const pct = Math.round((val||0)*10);
      const c = (val||0)>=7?'#16a34a':(val||0)>=5?'#d97706':'#dc2626';
      return '<div class="vly-score-row"><span>'+label+'</span><div class="vly-bar"><div class="vly-bar-fill" style="width:'+pct+'%;background:'+c+'"></div></div><b style="color:'+c+'">'+((val||0).toFixed?val.toFixed(0):val)+'/10</b></div>';
    };
    return '<div class="vly-video-card" onclick="openReportModal('+item.id+')" style="cursor:pointer">'
      +'<div class="vly-thumb">'+(item.thumb?'<img src="'+item.thumb+'" alt="thumb">':'<div class="vly-thumb-ph">🎬</div>')+'</div>'
      +'<div class="vly-mid">'
        +'<div class="vly-vid-name">'+item.video+'</div>'
        +'<div class="vly-vid-meta"><span class="vly-badge-ok">Termine</span> <span>'+item.date+'</span></div>'
        +(planTxt?'<div class="vly-plan-preview"><b>Plan d\'Action :</b> '+planTxt+'...</div>':'')
      +'</div>'
      +'<div class="vly-right">'
        +'<div class="vly-score-global"><span>Score Global</span><b style="color:'+col+'">'+sg.toFixed(1)+'</b><span class="vly-den">/10</span></div>'
        +scoreBar(sc.hook,'Hook')
        +scoreBar(sc.visuel,'Visuel')
        +scoreBar(sc.viralite,'Viralite')
        +scoreBar(sc.coherence,'Coherence')
        +scoreBar(sc.retention,'Retention')
        +scoreBar(sc.magnetisme,'Magnetisme')
      +'</div>'
      +'<div class="vly-actions">'
        +'<button class="vly-btn-primary" onclick="event.stopPropagation();openReportModal('+item.id+')">Voir l\'analyse</button>'
        +'<button class="vly-btn-del" onclick="event.stopPropagation();delEntry('+item.id+')">Supprimer</button>'
      +'</div>'
    +'</div>';
  }).join('');
}

function renderReportInto(target, r){
  if(!r||typeof r!=='object') r = {};
  const sg = r.score_global || (r.score?r.score/10:5);
  const sc = r.scores || {};
  const pa = r.plan_action || {};
  const col = (v) => v>=7?'#16a34a':v>=5?'#d97706':'#dc2626';
  const bar6 = (label, val) => {
    const v = val||0;
    const pct = Math.round(v*10);
    return '<div class="rpt-score-row"><span class="rpt-score-label">'+label+'</span>'
      +'<div class="rpt-bar-wrap"><div class="rpt-bar-fill" style="width:'+pct+'%;background:'+col(v)+'"></div></div>'
      +'<span class="rpt-score-val" style="color:'+col(v)+'">'+Math.round(v)+'/10</span></div>';
  };
  const section = (icon, title, content) =>
    '<div class="rpt-section"><h3 class="rpt-section-title">'+icon+' '+title+'</h3><p class="rpt-section-body">'+content+'</p></div>';
  const timeline = (r.timeline||[]).map(t => {
    const time = t[0]||''; const conseil = t[1]||'';
    return '<div class="rpt-tl-item"><b class="rpt-tl-time">'+time+'</b><span>'+conseil+'</span></div>';
  }).join('');
  const hooks = (r.hooks||[]).map((h,i) =>
    '<div class="rpt-hook-item" data-copy="1"><span class="rpt-hook-num">'+('0'+(i+1)).slice(-2)+'</span><span class="rpt-hook-txt">'+h+'</span><span class="rpt-copy">Copier</span></div>'
  ).join('');
  const titres = (r.titres||[]).map((t,i) =>
    '<div class="rpt-titre-item" data-copy="1"><b>'+(i+1)+'.</b> <span class="rpt-titre-txt">'+t+'</span><span class="rpt-copy">Copier</span></div>'
  ).join('');
  

function bar(label,val){return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${val*10}%"></i></div><b>${val}/10</b></div>`}
function reportToText(r=lastAnalysis?.report||{}){if(!r)return'';return `${r.summaryTitle}\nScore: ${r.score}/100\n\n${r.summaryText}\n\nHooks:\n- ${r.hooks.join('\n- ')}\n\nActions:\n- ${r.actions.join('\n- ')}`}
function copyReport(){navigator.clipboard.writeText(reportToText()).then(()=>alert('Rapport copié'))}
function saveHistory(item){const h=JSON.parse(localStorage.getItem('TA_HISTORY')||'[]'); h.unshift(item); localStorage.setItem('TA_HISTORY',JSON.stringify(h.slice(0,30))); lastAnalysis=item;}
function getHistory(){return JSON.parse(localStorage.getItem('TA_HISTORY')||'[]')}
function renderHistory(){
  const h=getHistory(); if(qs('historyCount')) qs('historyCount').textContent=h.length;
  const el=qs('historyList'); if(!el)return;
  renderHistoryInto(el, h);
}

function renderHistoryInto(el, h){
  if(!h||!h.length){el.innerHTML='<div class="empty-card"><h2>Aucune analyse</h2><p>Lance une première analyse pour la voir apparaître ici.</p></div>'; return;}
  el.innerHTML=h.map(item=>{
    const sc=item.report&&item.report.score||0;
    const col=sc>=80?'#00c48c':sc>=65?'#6c47ff':sc>=50?'#ff8c00':'#ff3d5a';
    const title=item.report&&item.report.summaryTitle||item.report&&item.report.potential||'--';
    const thumbHtml = item.thumb
      ? `<img src="${item.thumb}" class="hist-thumb-img" alt="miniature">`
      : `<div class="hist-thumb-placeholder">🎬</div>`;
    return `<div class="history-item-new" onclick="openReportModal(${item.id})">
      <div class="hist-thumb-wrap">${thumbHtml}</div>
      <div class="hist-info-main">
        <div class="hist-video-name">${item.video||'Vidéo'}</div>
        <div class="hist-analysis-title">${title}</div>
        <div class="hist-date">${item.date||''}</div>
      </div>
      <div class="hist-score-col">
        <div class="hist-score-big" style="color:${col}">${sc}<span class="hist-score-den">/100</span></div>
        <div class="hist-score-badge" style="background:${col}20;color:${col}">
          ${sc>=80?'Excellent':sc>=65?'Bon':sc>=50?'Correct':'À améliorer'}
        </div>
      </div>
    </div>`;
  }).join('');
}
// Copy delegation for report items
document.addEventListener('click', function(e){
  const item = e.target.closest('[data-copy]');
  if(!item) return;
  const txt = item.querySelector('.rpt-hook-txt,.rpt-titre-txt');
  if(txt){ navigator.clipboard.writeText(txt.textContent).then(()=>{ item.classList.add('copied'); setTimeout(()=>item.classList.remove('copied'),1500); }); }
  const tag = e.target.closest('.rpt-tag');
  if(tag){ navigator.clipboard.writeText(tag.textContent).then(()=>{ tag.style.background='#dcfce7'; setTimeout(()=>tag.style.background='',1000); }); }
});

function openReportModal(id){
  const item=getHistory().find(x=>x.id===id); if(!item)return; lastAnalysis=item;
  const modal=qs('reportModal'); if(!modal)return;
  qs('modalVideoTitle').textContent=item.video||'Rapport';
  qs('modalVideoMeta').textContent=item.date+' · Score '+((item.report&&item.report.score)||0)+'/100';
  const body=qs('reportModalBody');
  body.innerHTML='<div class="loading-card"><div class="spinner"></div><h2>Chargement du rapport...</h2></div>';
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
  setTimeout(()=>{ body.innerHTML=''; renderReportInto(body, item.report); }, 80);
}
function closeReportModal(){
  const modal=qs('reportModal'); if(modal) modal.classList.add('hidden');
  document.body.style.overflow='';
}
function openHistoryModal(id){openReportModal(id);}
function openHistory(id){openReportModal(id);}
function clearHistory(){localStorage.removeItem('TA_HISTORY'); renderHistory();}
function fillPlannerFromLast(){const r=lastAnalysis?.report || getHistory()[0]?.report; if(!r){alert('Fais une analyse avant.');return;} qs('plannerTitle').value=r.hooks[0]||r.summaryTitle; qs('plannerHook').value=r.hooks[1]||''}
function savePlan(){const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); plans.unshift({id:Date.now(),title:qs('plannerTitle').value||'Nouvelle vidéo',season:qs('plannerSeason').value,episode:qs('plannerEpisode').value,date:qs('plannerDate').value,time:qs('plannerTime').value,hook:qs('plannerHook').value}); localStorage.setItem('TA_PLANS',JSON.stringify(plans)); renderPlans();}
function renderPlans(){const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); const el=qs('plannerList'); if(!el)return; el.innerHTML=plans.map(p=>`<div class="plan-item"><h3>S${p.season} EP${p.episode} -- ${p.title}</h3><p>${p.date||'Date à choisir'} à ${p.time||'--:--'} · Hook : ${p.hook||'à écrire'}</p></div>`).join('')}
async function generateScript(){const idea=qs('scriptInput').value.trim() || (lastAnalysis? reportToText(lastAnalysis.report):''); if(!idea){alert('Mets une idée ou lance une analyse avant.');return;} qs('scriptOutput').textContent='Génération en cours...'; const script=`HOOK 0-2 sec :\n${idea.split('\n')[0].slice(0,90)}\n\nDÉROULÉ :\n1. Montrer tout de suite le moment fort.\n2. Expliquer en une phrase ce qui se passe.\n3. Relancer : "Et là, ça part encore plus loin..."\n4. Garder seulement les réactions utiles.\n5. Finir par : "Tu aurais fait quoi à sa place ?"\n\nSOUS-TITRES CONSEILLÉS :\n- Gros texte blanc, contour noir.\n- Mots importants en jaune.\n- Une phrase courte par écran.`; qs('scriptOutput').textContent=script;}
function generateScriptFromLast(){const r=lastAnalysis?.report || getHistory()[0]?.report; if(!r){alert('Fais une analyse avant.');return;} qs('scriptInput').value=reportToText(r); generateScript();}
function renderIdeas(){const el=qs('ideasList'); if(!el)return; ['Le moment où tout bascule','Avant / après la dispute','La phrase qui a mis le feu','Ce qu\'on n\'a pas vu au début','La réaction que personne n\'attendait'].forEach(t=>el.innerHTML+=`<div class="pill">${t}</div>`)}

// THUMBNAILS
function initThumbnail(){setTimeout(renderThumbnail,100)}
function setThumbStyle(style,btn){thumbState.style=style; document.querySelectorAll('.style-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderThumbnail();}
function loadVideoForThumb(){if(selectedVideo){prepareThumbVideo(selectedVideo)}else alert('Analyse ou choisis une vidéo avant.')}
function prepareThumbSource(file){
  if(!file)return;
  if(file.type && file.type.startsWith('video/')) return prepareThumbVideo(file);
  if(file.type && file.type.startsWith('image/')) return prepareThumbImage(file);
  alert('Format non reconnu. Glisse une vidéo MP4/MOV ou une image PNG/JPG.');
}
function thumbDragOver(e){e.preventDefault(); qs('thumbDropZone')?.classList.add('drag')}
function thumbDragLeave(e){e.preventDefault(); qs('thumbDropZone')?.classList.remove('drag')}
function thumbDrop(e){
  e.preventDefault();
  qs('thumbDropZone')?.classList.remove('drag');
  const f=e.dataTransfer.files && e.dataTransfer.files[0];
  prepareThumbSource(f);
}
function prepareThumbVideo(file){if(!file)return; thumbState.videoFile=file; if(thumbState.videoUrl && thumbState.videoUrl!==selectedVideoUrl) URL.revokeObjectURL(thumbState.videoUrl); thumbState.videoUrl=URL.createObjectURL(file); const v=qs('thumbVideo'); v.src=thumbState.videoUrl; v.onloadedmetadata=()=>captureThumbFrame();}
function prepareThumbImage(file){if(!file)return; const img=new Image(); img.onload=()=>{thumbState.image=img; renderThumbnail();}; img.src=URL.createObjectURL(file);}
function seekThumbFrame(){const v=qs('thumbVideo'); if(!v.duration)return; v.currentTime=(qs('thumbTime').value/100)*v.duration; v.onseeked=()=>captureThumbFrame();}
function captureThumbFrame(){const v=qs('thumbVideo'); if(!v.videoWidth)return; const imgCanvas=document.createElement('canvas'); imgCanvas.width=v.videoWidth; imgCanvas.height=v.videoHeight; imgCanvas.getContext('2d').drawImage(v,0,0); const img=new Image(); img.onload=()=>{thumbState.image=img; renderThumbnail();}; img.src=imgCanvas.toDataURL('image/jpeg',0.9);}
function renderThumbnail(){
  const canvas=qs('thumbCanvas'); if(!canvas)return; const fmt=qs('thumbFormat')?.value||'tiktok'; if(fmt==='tiktok'){canvas.width=1080;canvas.height=1920}else if(fmt==='youtube'){canvas.width=1280;canvas.height=720}else{canvas.width=1080;canvas.height=1080}
  const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
  const styles={viral:['#ffcc00','#ff004c','rgba(0,0,0,.62)'],drama:['#ff3b30','#111827','rgba(0,0,0,.68)'],clean:['#ffffff','#6d4cff','rgba(12,18,38,.45)'],mystery:['#22d3ee','#7c3aed','rgba(0,0,0,.72)'],humour:['#fff200','#00d4ff','rgba(0,0,0,.55)']}; const [a,b,shade]=styles[thumbState.style]||styles.viral;
  ctx.fillStyle='#111827';ctx.fillRect(0,0,W,H);
  if(thumbState.image){const img=thumbState.image; const scale=Math.max(W/img.width,H/img.height); const w=img.width*scale,h=img.height*scale; ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);} else {const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#111827');g.addColorStop(.45,'#34206f');g.addColorStop(1,'#030712');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(255,255,255,.12)';ctx.font=`900 ${Math.round(W/9)}px Arial`;ctx.textAlign='center';ctx.fillText('CHOISIS UNE IMAGE',W/2,H/2)}
  ctx.fillStyle=shade; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=b; ctx.beginPath(); ctx.roundRect(W*.06,H*.045,W*.28,H*.06,24); ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`900 ${Math.round(W*.038)}px Arial`; ctx.textAlign='center'; ctx.fillText(`S${qs('thumbSeason')?.value||1}  EP${qs('thumbEpisode')?.value||1}`,W*.20,H*.085);
  ctx.fillStyle=a; ctx.fillRect(0,H*.69,W,H*.015); ctx.fillStyle=b; ctx.fillRect(0,H*.705,W,H*.012);
  const text=(qs('thumbText')?.value||'ÇA A DÉGÉNÉRÉ').toUpperCase(); const sub=qs('thumbSubtext')?.value||'Regarde jusqu\'à la fin';
  drawStrokeText(ctx,text,W*.06,H*.73,W*.88,Math.round(W*.105),'#fff','#000',10);
  ctx.fillStyle=a; ctx.font=`900 ${Math.round(W*.045)}px Arial`; ctx.textAlign='left'; ctx.fillText(sub.toUpperCase(),W*.07,H*.90);
  ctx.fillStyle='rgba(0,0,0,.75)';ctx.beginPath();ctx.roundRect(W*.06,H*.925,W*.88,H*.045,22);ctx.fill();ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(W*.03)}px Arial`;ctx.textAlign='center';ctx.fillText('NOUVEL ÉPISODE · RÉACTION EN COMMENTAIRE',W/2,H*.955);
  updatePrompt();
}
function drawStrokeText(ctx,text,x,y,maxWidth,fontSize,fill,stroke,lineHeight){ctx.textAlign='left';ctx.lineJoin='round';let size=fontSize;let words=text.split(' '),lines=[];do{ctx.font=`1000 ${size}px Arial Black, Arial`;lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}lines.push(line); if(lines.length*size*1.05>fontSize*2.4) size-=4; else break;}while(size>32); ctx.font=`1000 ${size}px Arial Black, Arial`; lines.forEach((l,i)=>{const yy=y+i*size*1.05;ctx.strokeStyle=stroke;ctx.lineWidth=lineHeight;ctx.strokeText(l,x,yy);ctx.fillStyle=fill;ctx.fillText(l,x,yy);});}
function updatePrompt(){const prompt=`Miniature TikTok verticale 9:16, style ${thumbState.style}, très viral, gros texte lisible, contraste fort, badge S${qs('thumbSeason')?.value||1} EP${qs('thumbEpisode')?.value||1}, émotion forte, sujet: ${qs('thumbText')?.value||'ça a dégénéré'}, image réaliste, couleurs puissantes, composition claire pour mobile, pas de texte illisible.`; if(qs('leonardoPrompt')) qs('leonardoPrompt').textContent=prompt;}
function copyLeonardoPrompt(){navigator.clipboard.writeText(qs('leonardoPrompt').textContent); alert('Prompt copié')}
function downloadThumbnail(){const a=document.createElement('a'); a.download=`miniature_S${qs('thumbSeason').value}_EP${qs('thumbEpisode').value}.png`; a.href=qs('thumbCanvas').toDataURL('image/png'); a.click();}


// ══════════════════════════════════════
// ONGLETS SOURCE (Fichier / URL)
// ══════════════════════════════════════
function switchSourceTab(tab) {
  qs('tabFile').classList.toggle('active', tab === 'file');
  qs('tabUrl').classList.toggle('active', tab === 'url');
  if (qs('panelFile')) qs('panelFile').classList.toggle('hidden', tab !== 'file');
  if (qs('panelUrl'))  qs('panelUrl').classList.toggle('hidden', tab !== 'url');
}

// ══════════════════════════════════════
// ANALYSE VIA URL TIKTOK
// ══════════════════════════════════════
let urlVideoData = null;

async function loadFromUrl() {
  const url = (qs('tiktokUrlInput') && qs('tiktokUrlInput').value.trim()) || '';
  if (!url) { alert('Colle un lien TikTok ou YouTube.'); return; }

  const preview = qs('urlVideoPreview');
  preview.innerHTML = '<div class="loading-card"><div class="spinner"></div><p>Chargement des infos vidéo...</p></div>';
  preview.classList.remove('hidden');

  try {
    const res = await fetch('/api/tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'video_info', url })
    });
    const data = await res.json();
    if (data.ok && data.video) {
      urlVideoData = data.video;
      preview.innerHTML = `
        <div class="video-preview" style="margin-top:0">
          <div class="preview-icon" style="background:#f0edff;font-size:22px">
            ${data.video.thumbnail ? '<img src="' + data.video.thumbnail + '" style="width:46px;height:46px;object-fit:cover;border-radius:12px">' : '🎬'}
          </div>
          <div>
            <strong>${data.video.title || 'Vidéo TikTok'}</strong>
            <small>Par ${data.video.author || '--'}</small>
          </div>
          <button onclick="analyzeFromUrl()" class="primary-btn" style="margin-left:auto;padding:10px 16px;font-size:13px">
            🚀 Analyser cette vidéo
          </button>
        </div>`;
      qs('contextPanel').classList.remove('hidden');
      qs('step2').classList.add('active');
    } else {
      preview.innerHTML = '<div class="loading-card" style="color:#dc2626">❌ ' + (data.error || 'Vidéo introuvable ou privée') + '</div>';
    }
  } catch (e) {
    preview.innerHTML = '<div class="loading-card" style="color:#dc2626">❌ Erreur : ' + e.message + '</div>';
  }
}

async function analyzeFromUrl() {
  if (!urlVideoData) { alert("Charge une video via le lien d'abord."); return; }
  const k = getKeys();
  if (!k.claude && !k.openai && !k.gemini) { alert("Configure une cle API d'abord."); return; }

  qs('results').classList.remove('hidden');
  qs("results").innerHTML = `<div class="loading-card"><div class="spinner"></div><h2>Analyse en cours...</h2><p>Analyse via le lien en cours.</p></div>`;
  qs('analyzeBtn').disabled = true;
  qs('analysisStatus').textContent = 'Analyse en cours...';
  qs('step3').classList.add('active');

  const payload = {
    action: 'analyze',
    claudeKey: k.claude, openaiKey: k.openai, geminiKey: k.gemini,
    videoName: urlVideoData.title || 'Vidéo TikTok',
    videoUrl:  urlVideoData.url,
    author:    urlVideoData.author,
    duration:  qs('durationSelect') ? qs('durationSelect').value : '75',
    contentType: qs('contentType') ? qs('contentType').value : 'famille/drama',
    hook:      qs('hookInput') ? qs('hookInput').value : '',
    frames:    []
  };

  let report = null;
  try {
    const k2 = getKeys();
    if(k2.openai){
      report = await callOpenAIReport(k2.openai, payload, '');
    } else if(k2.gemini){
      report = await callGeminiReport(k2.gemini, payload, '');
    }
  } catch (e) { console.warn(e); }
  if (!report) report = localFallbackReport(payload);

  const item = { id: Date.now(), date: new Date().toLocaleString('fr-FR'), video: urlVideoData.title || 'Vidéo TikTok', report };
  saveHistory(item); lastAnalysis = item;
  renderReport(report);
  renderHistory();
  qs('analysisStatus').textContent = 'Analyse terminée !';
  qs('analyzeBtn').disabled = false;
}

// ══════════════════════════════════════
// RECHERCHE CHAINE TIKTOK
// ══════════════════════════════════════
async function searchChannel() {
  const input = qs('channelInput');
  const username = (input ? input.value.trim() : '').replace('@', '');
  if (!username) { alert("Entre un nom de chaine TikTok (ex: @moncompte)"); return; }

  const card = qs('channelCard');
  card.classList.remove('hidden');
  card.innerHTML = '<div class="loading-card" style="padding:16px"><div class="spinner"></div><p>Recherche de la chaîne @' + username + '...</p></div>';

  try {
    const res = await fetch('/api/tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'channel_info', username })
    });
    const data = await res.json();

    if (data.ok && data.channel) {
      const ch = data.channel;
      const fmt = n => {
        if (!n && n !== 0) return '--';
        if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
        if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
        return n.toLocaleString('fr-FR');
      };
      card.innerHTML = `
        <div class="channel-card-inner">
          <div class="channel-avatar-wrap">
            ${ch.avatar
              ? '<img src="' + ch.avatar + '" class="channel-avatar" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              : ''}
            <div class="channel-avatar-fallback" style="${ch.avatar ? 'display:none' : ''}">
              ${ch.displayName ? ch.displayName[0].toUpperCase() : '?'}
            </div>
          </div>
          <div class="channel-info">
            <div class="channel-name">${ch.displayName || ch.handle}</div>
            <div class="channel-handle">${ch.handle}</div>
            <a href="${ch.url}" target="_blank" class="channel-link">Voir sur TikTok ↗</a>
          </div>
          <div class="channel-stats">
            <div class="channel-stat">
              <span class="stat-val">${fmt(ch.followers)}</span>
              <span class="stat-lbl">Abonnés</span>
            </div>
            <div class="channel-stat">
              <span class="stat-val">${fmt(ch.videos)}</span>
              <span class="stat-lbl">Vidéos</span>
            </div>
            <div class="channel-stat">
              <span class="stat-val">${fmt(ch.likes)}</span>
              <span class="stat-lbl">J'aimes</span>
            </div>
          </div>
        </div>`;
    } else {
      card.innerHTML = '<div class="loading-card" style="color:#dc2626">❌ ' + (data.error || 'Chaîne introuvable') + '</div>';
    }
  } catch (e) {
    card.innerHTML = '<div class="loading-card" style="color:#dc2626">❌ Erreur : ' + e.message + '</div>';
  }
}

// Permet de lancer searchChannel avec la touche Entrée
document.addEventListener('DOMContentLoaded', () => {
  const inp = qs('channelInput');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') searchChannel(); });
  const urlInp = qs('tiktokUrlInput');
  if (urlInp) urlInp.addEventListener('keydown', e => { if (e.key === 'Enter') loadFromUrl(); });
});

// ══════════════════════════════════════
// MA CHAINE + CONCURRENTS
// ══════════════════════════════════════

function getMyChannels(){ return JSON.parse(localStorage.getItem('TA_MY_CHANNELS')||'[]'); }
function getCompetitors(){ return JSON.parse(localStorage.getItem('TA_COMPETITORS')||'[]'); }

function addMyChannel(){ qs('channelModal').classList.remove('hidden'); document.body.style.overflow='hidden'; setTimeout(()=>{ const inp=qs('channelModalInput'); if(inp) inp.focus(); },100); }
function closeChannelModal(){ qs('channelModal').classList.add('hidden'); document.body.style.overflow=''; }

async function confirmAddChannel(){
  const inp=qs('channelModalInput');
  const username=(inp?inp.value.trim():'').replace('@','');
  if(!username){ qs('channelModalStatus').textContent='Entre un nom de chaine.'; return; }
  qs('channelModalStatus').textContent='Recherche en cours...';
  const ch = await fetchChannelInfo(username);
  const channels = getMyChannels().filter(c=>c.handle!=='@'+username);
  channels.unshift(ch);
  localStorage.setItem('TA_MY_CHANNELS', JSON.stringify(channels.slice(0,5)));
  closeChannelModal();
  renderMyChannel();
}

async function addCompetitor(){
  const inp=qs('competitorInput');
  const username=(inp?inp.value.trim():'').replace('@','');
  const cat=qs('competitorCategory')?qs('competitorCategory').value:'Famille/Drama';
  if(!username){ alert('Entre un nom de chaine.'); return; }
  const ch = await fetchChannelInfo(username, cat);
  const list=getCompetitors().filter(c=>c.handle!=='@'+username);
  list.unshift(ch);
  localStorage.setItem('TA_COMPETITORS', JSON.stringify(list.slice(0,20)));
  if(inp) inp.value='';
  renderCompetitors();
}

async function fetchChannelInfo(username, category){
  const handle = username.replace('@','').trim();
  let avatar='', displayName='@'+handle, bio='';
  try{
    const r=await fetch('/api/tiktok',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'channel_info', username:handle})
    });
    const data=await r.json();
    if(data.ok && data.channel){
      avatar      = data.channel.avatar      || '';
      displayName = data.channel.displayName || ('@'+handle);
      bio         = data.channel.bio         || '';
    }
  }catch(e){ console.warn('Channel fetch error:', e); }
  return {
    handle:'@'+handle,
    displayName,
    avatar,
    bio,
    url:'https://www.tiktok.com/@'+handle,
    category: category || 'Ma chaîne',
    addedAt: new Date().toLocaleDateString('fr-FR')
  };
}

function renderMyChannel(){
  const el=qs('myChannelCard'); if(!el)return;
  const channels=getMyChannels();
  if(!channels.length){
    el.innerHTML='<div class="no-channel-msg"><p>👆 Clique sur "Ajouter / Changer ma chaîne" pour configurer ton compte TikTok.</p></div>';
  } else {
    const ch=channels[0];
    el.innerHTML=`<div class="channel-profile-inner">
      <div class="channel-profile-avatar">
        ${ch.avatar
          ? `<img src="${ch.avatar}" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\'avatar-fallback\'>${(ch.displayName||'?')[0].toUpperCase()}</div>'" alt="avatar">`
          : `<div class="avatar-fallback">${(ch.displayName||'?')[0].toUpperCase()}</div>`}
      </div>
      <div class="channel-profile-info" style="flex:1">
        <div class="channel-profile-name">${ch.displayName}</div>
        <div class="channel-profile-handle">${ch.handle}</div>
        ${ch.bio ? `<div class="channel-bio">${ch.bio}</div>` : ''}
        <a href="${ch.url}" target="_blank" class="channel-profile-link">Voir sur TikTok ↗</a>
      </div>
    </div>`;
  }
  // History for this channel
  const histEl=qs('myChannelHistory'); if(!histEl)return;
  renderHistoryInto(histEl, getHistory());
}

function renderCompetitors(){
  const el=qs('competitorList'); if(!el)return;
  const list=getCompetitors();
  if(!list.length){
    el.innerHTML='<div class="empty-card"><h2>Aucun concurrent</h2><p>Ajoute des chaînes pour les suivre ici.</p></div>';
    return;
  }
  el.innerHTML=list.map((ch,i)=>`
    <div class="competitor-card">
      <div class="competitor-avatar">
        ${ch.avatar?`<img src="${ch.avatar}" onerror="this.style.display='none'" alt="avatar">`:'<div class="avatar-fallback">'+(ch.displayName||'?')[0].toUpperCase()+'</div>'}
      </div>
      <div class="competitor-info">
        <div class="competitor-name">${ch.displayName}</div>
        <div class="competitor-handle">${ch.handle}</div>
        <span class="competitor-cat">${ch.category||'Autre'}</span>
      </div>
      <div class="competitor-actions">
        <a href="${ch.url}" target="_blank" class="secondary-btn" style="padding:8px 14px;font-size:12px;text-decoration:none">Voir ↗</a>
        <button onclick="removeCompetitor(${i})" class="del-btn" style="margin-left:6px">🗑</button>
      </div>
    </div>`).join('');
}

function removeCompetitor(i){
  const list=getCompetitors(); list.splice(i,1);
  localStorage.setItem('TA_COMPETITORS',JSON.stringify(list));
  renderCompetitors();
}

}
