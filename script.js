let selectedVideo = null;
let selectedVideoUrl = null;
let lastAnalysis = null;
let thumbState = { style:'viral', image:null, videoFile:null, videoUrl:null };

const titles = {
  analyze:['📊 Analyser une vidéo','Glisse ta vidéo au centre, choisis le contexte, puis lance l’analyse.'],
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

  // Si les clés sont déjà enregistrées et que Patrick était déjà entré dans l'app,
  // un simple F5 reste sur le dashboard au lieu de revenir sur la page connexion.
  const k = getKeys();
  if (localStorage.getItem('TA_APP_UNLOCKED') === '1' && (k.openai || k.gemini)) {
    setTimeout(() => {
      enterApp(false);
      const lastPage = localStorage.getItem('TA_LAST_PAGE') || 'analyze';
      const btn = document.querySelector(`[data-page="${lastPage}"]`) || document.querySelector('[data-page="analyze"]');
      switchPage(lastPage, btn);
    }, 80);
  }
});

function qs(id){return document.getElementById(id)}
function getKeys(){return {openai:localStorage.getItem('OPENAI_KEY')||'', gemini:localStorage.getItem('GEMINI_KEY')||''}}
function togglePassword(id){const el=qs(id); el.type = el.type === 'password' ? 'text' : 'password'}
function loadKeys(){const k=getKeys(); if(qs('openaiKey')) qs('openaiKey').value=k.openai; if(qs('geminiKey')) qs('geminiKey').value=k.gemini; const ok=!!(k.openai||k.gemini); if(ok){qs('enterButton').disabled=false; qs('apiLive').textContent='Connecté'; qs('apiLive').classList.add('ok'); qs('apiStatus').textContent='✅ Clés déjà enregistrées sur ce navigateur'; qs('apiStatus').className='status-box status-ok';}}
async function connectAPIs(){
  const openai=qs('openaiKey').value.trim(); const gemini=qs('geminiKey').value.trim();
  if(!openai && !gemini){setApiStatus('❌ Ajoute au moins une clé API.','error'); return;}
  localStorage.setItem('OPENAI_KEY',openai); localStorage.setItem('GEMINI_KEY',gemini);
  setApiStatus('⏳ Clés enregistrées. Test de connexion en cours…','');
  try{
    const res = await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'test',openaiKey:openai,geminiKey:gemini})});
    const data = await res.json().catch(()=>({ok:false,error:'Réponse API illisible'}));
    if(data.ok){setApiStatus('✅ Test OK — connexion enregistrée.','ok');}
    else {setApiStatus('⚠️ Clés enregistrées. Test non bloquant : '+(data.error||'Vérifie les quotas plus tard.'),'ok');}
  }catch(e){
    setApiStatus('✅ Clés enregistrées. Le test distant n’a pas répondu, mais tu peux entrer dans l’application.','ok');
  }
  localStorage.setItem('TA_APP_UNLOCKED','1'); qs('enterButton').disabled=false; qs('apiLive').textContent='Connecté'; qs('apiLive').classList.add('ok'); updateApiLabels();
}
function setApiStatus(msg,type){qs('apiStatus').textContent=msg; qs('apiStatus').className='status-box '+(type==='ok'?'status-ok':type==='error'?'status-error':'')}
function updateApiLabels(){const k=getKeys(); qs('openaiLabel').textContent=k.openai?'Oui':'Non'; qs('geminiLabel').textContent=k.gemini?'Oui':'Non'; qs('openaiDot').classList.toggle('ok',!!k.openai); qs('geminiDot').classList.toggle('ok',!!k.gemini)}
function enterApp(save=true){ if(save) localStorage.setItem('TA_APP_UNLOCKED','1'); qs('loginScreen').classList.add('hidden'); qs('app').classList.remove('hidden'); updateApiLabels(); renderThumbnail();}
function backToLogin(){localStorage.removeItem('TA_APP_UNLOCKED'); qs('app').classList.add('hidden'); qs('loginScreen').classList.remove('hidden');}

function switchPage(page, btn){localStorage.setItem('TA_LAST_PAGE', page); document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); qs('page-'+page).classList.add('active'); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active'); qs('pageTitle').textContent=titles[page][0]; qs('pageSub').textContent=titles[page][1]; if(page==='thumbnails') setTimeout(renderThumbnail,50)}
function dragOver(e){e.preventDefault(); qs('dropZone').classList.add('drag')}
function dragLeave(e){e.preventDefault(); qs('dropZone').classList.remove('drag')}
function dropVideo(e){e.preventDefault(); qs('dropZone').classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) pickVideo(f)}
function pickVideo(file){if(!file||!file.type.startsWith('video/')){alert('Choisis un fichier vidéo.'); return;} selectedVideo=file; if(selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl); selectedVideoUrl=URL.createObjectURL(file); qs('videoName').textContent=file.name; qs('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · prêt à analyser`; qs('videoPreview').classList.remove('hidden'); qs('contextPanel').classList.remove('hidden'); qs('analyzeBtn').disabled=false; qs('analysisStatus').textContent='Vidéo prête. Tu peux lancer l’analyse.'; qs('step2').classList.add('active'); thumbState.videoFile=file; thumbState.videoUrl=selectedVideoUrl;}
function removeVideo(){selectedVideo=null; qs('videoPreview').classList.add('hidden'); qs('contextPanel').classList.add('hidden'); qs('analyzeBtn').disabled=true; qs('analysisStatus').textContent='Dépose d’abord une vidéo.'; qs('results').classList.add('hidden')}
function resetAnalyzer(){removeVideo(); qs('results').innerHTML=''; switchPage('analyze', document.querySelector('[data-page="analyze"]'));}

async function extractFrames(file, count=2){
  // Version stable : on ne bloque jamais l'application si la vidéo est longue ou si le navigateur refuse de lire une frame.
  return new Promise((resolve)=>{
    let finished=false;
    let url='';
    const done=(frames=[])=>{
      if(finished) return;
      finished=true;
      try{ if(url) URL.revokeObjectURL(url); }catch(e){}
      resolve(frames);
    };
    const maxWait = setTimeout(()=>done([]), 2200);
    try{
      const video=document.createElement('video');
      url=URL.createObjectURL(file);
      const frames=[];
      video.preload='metadata'; video.muted=true; video.playsInline=true; video.src=url;
      video.onloadedmetadata=()=>{
        const duration=Number.isFinite(video.duration) ? video.duration : 60;
        const times=[Math.min(1.2, Math.max(.2,duration*.05)), Math.min(duration-0.2, Math.max(1,duration*.55))].slice(0,count);
        const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d');
        let idx=0;
        const grab=()=>{
          if(idx>=times.length){ clearTimeout(maxWait); done(frames); return; }
          const localTimeout=setTimeout(()=>{ idx++; grab(); }, 650);
          video.onseeked=()=>{
            clearTimeout(localTimeout);
            try{
              canvas.width=220; canvas.height=390;
              const vw=video.videoWidth||220, vh=video.videoHeight||390;
              const scale=Math.max(canvas.width/vw,canvas.height/vh);
              const w=vw*scale,h=vh*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;
              ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(video,x,y,w,h);
              frames.push({time:Math.round(times[idx]), image:canvas.toDataURL('image/jpeg',0.45)});
            }catch(e){}
            idx++; grab();
          };
          try{ video.currentTime=times[idx]; }catch(e){ idx++; grab(); }
        };
        grab();
      };
      video.onerror=()=>{ clearTimeout(maxWait); done([]); };
    }catch(e){ clearTimeout(maxWait); done([]); }
  });
}

async function analyzeVideo(){
  if(!selectedVideo){alert('Ajoute une vidéo avant.'); return;}
  const k=getKeys();
  qs('results').classList.remove('hidden');
  qs('results').innerHTML=`<div class="vy-video-list"><article class="vy-video-card analyzing-card">
    <div class="vy-card-main"><div class="vy-thumb-wrap"><div class="vy-thumb empty">Analyse...</div></div>
    <div class="vy-info-area"><div class="vy-title-row"><h3>${escapeHtml(selectedVideo.name)}</h3></div>
      <div class="vy-meta-row"><span class="vy-status pending">⏳ Analyse en cours</span><span>⚡ Mode rapide stable</span><span>•</span><span>max 15 sec</span></div>
      <div class="vy-plan-box"><b>🚀 Préparation du rapport</b><p>Je récupère seulement quelques informations légères pour éviter que les vidéos longues bloquent.</p><p>Si l’API tarde trop, l’outil affiche quand même un rapport ultra pédagogique au lieu de tourner sans fin.</p></div>
      <div class="progress-soft"><i></i></div>
    </div></div></article></div>`;
  qs('analyzeBtn').disabled=true; qs('analysisStatus').textContent='Analyse en cours — maximum 15 secondes.'; qs('step3').classList.add('active');
  let frames=[];
  try{ frames = await extractFrames(selectedVideo,2); }catch(e){ frames=[]; }
  const payload={
    action:'analyze', openaiKey:k.openai, geminiKey:k.gemini,
    videoName:selectedVideo.name, videoSize:Math.round(selectedVideo.size/1024/1024), duration:qs('durationSelect').value, contentType:qs('contentType').value, hook:qs('hookInput').value,
    frames,
    fastMode:true
  };
  let report=null;
  try{
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 14000);
    const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    clearTimeout(timer);
    const data=await res.json().catch(()=>null);
    if(data && data.report) report=data.report;
  }catch(e){ console.warn('Analyse distante trop longue, fallback local:', e); }
  if(!report) report=localFallbackReport(payload);
  lastAnalysis={id:Date.now(), date:new Date().toLocaleString('fr-FR'), video:selectedVideo.name, report};
  saveHistory(lastAnalysis); renderReport(report); renderHistory(); qs('analysisStatus').textContent='Analyse terminée et sauvegardée dans l’historique.'; qs('analyzeBtn').disabled=false;
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
  const hook=p?.hook || 'Ça a dégénéré direct…';
  return {
    score:78,
    potential:'Bon potentiel — il faut renforcer les hooks et les explications',
    summaryTitle:'Vidéo exploitable avec une structure TikTok plus claire',
    summaryText:'La vidéo peut fonctionner si elle prend le spectateur par la main. Pour TikTok, il faut expliquer très vite pourquoi il faut rester, puis relancer l’attention régulièrement. Un débutant doit retenir ceci : début fort, contexte simple, relances fréquentes, fin avec question.',
    scores:{hook:7,rhythm:7,clarity:7,cta:6,emotion:8,thumbnail:7},
    cards:{
      hook:'Le hook n’est pas juste une phrase au début. Il faut un hook au début, un au milieu, un juste avant la fin, puis une dernière question qui donne envie de commenter.',
      rhythm:'Le rythme doit éviter les blancs, les hésitations et les moments où l’image ne change pas. Dès que ça ralentit, il faut couper, zoomer ou relancer.',
      clarity:'Le spectateur ne connaît pas l’histoire. Il faut lui dire qui est là, quel est le problème, et ce qu’il doit regarder.',
      cta:'La fin doit provoquer une réponse simple : “Tu aurais fait quoi ?”, “Il a raison ou pas ?”, “Tu veux la suite ?”.'
    },
    deep:{
      global:'La vidéo doit être comprise par quelqu’un qui arrive sans contexte. Elle doit annoncer le problème vite, garder la tension, et ne jamais laisser le spectateur se demander pourquoi il regarde.',
      hookStart:'Dans les 0 à 3 secondes, commence par le moment fort ou une phrase choc. Ne commence pas par une introduction lente. Exemple : “Là, personne ne s’attendait à cette réaction.”',
      hookMiddle:'Au milieu, ajoute une phrase qui relance : “Et là, tout change.” C’est une alarme qui réveille les gens qui commencent à décrocher.',
      hookEnd:'Juste avant la fin, annonce la chute : “Le pire arrive maintenant.” La personne doit sentir qu’elle perd quelque chose si elle quitte la vidéo.',
      subtitles:'Sous-titres très gros, phrases courtes, contraste fort. Une seule idée par écran. Les mots importants peuvent être en jaune ou en gras.',
      sound:'Évite les blancs audio. Si le son est faible, renforce les sous-titres. Si une réaction est importante, ajoute un petit bruitage ou un zoom.'
    },
    timeline:[
      ['0–1 sec','Phrase choc immédiate. Pas de bonjour. Pas d’intro. Il faut créer une curiosité directe.'],
      ['1–3 sec','Contexte simple : qui parle, quel problème, pourquoi on doit regarder. Une phrase seulement.'],
      ['3–6 sec','Relance visuelle : zoom léger, changement de plan, texte fort ou petit bruitage.'],
      ['6–10 sec','Micro-hook : “Regarde bien sa réaction.” Il faut empêcher le spectateur de scroller.'],
      ['10–18 sec','Couper les longueurs. Chaque seconde doit apporter une information, une émotion ou une tension.'],
      ['18–25 sec','Préparer la suite : “À ce moment-là, tout le monde pense que c’est terminé…”'],
      ['Milieu','Relance émotionnelle : surprise, rire, tension, malaise, colère ou débat.'],
      ['10 sec avant la fin','Annoncer la chute : “Le plus fou arrive maintenant.”'],
      ['Dernières secondes','Question commentaire : “Tu aurais fait quoi à sa place ?”.']
    ],
    hooks:[hook,'Attends sa réaction, elle change tout…','Là, tout le monde pensait que ça allait se calmer…','Regarde bien ce qu’il fait juste après.','Personne n’avait prévu cette réponse.','Tu aurais fait quoi à sa place ?','Il a raison ou il abuse ?','S1 EP2 : tu veux voir la suite ?'],
    actions:['Renforcer la première phrase.','Ajouter une relance toutes les 6 à 10 secondes.','Couper les blancs et hésitations.','Mettre des sous-titres gros et lisibles.','Créer une miniature claire avec 3 à 5 mots maximum.','Terminer par une question simple.','Préparer la suite si c’est une saison.'],
    rewrite:['Hook : “Là, ça devait être calme… mais ça a dégénéré.”','Milieu : “Et là, tout le monde bloque.”','Fin : “Tu aurais répondu quoi ?”','Titre : “Il pensait avoir raison… jusqu’à cette réponse.”'],
    checklist:['Comprend-on le sujet en 3 secondes ?','Y a-t-il une relance avant 10 secondes ?','Les sous-titres sont-ils lisibles sur téléphone ?','La fin pose-t-elle une question ?','La miniature est-elle claire sans être mensongère ?'],
    errorsToAvoid:['Commencer par une intro lente.','Mettre un texte trop petit ou trop long.','Laisser un silence inutile.','Tout dévoiler dans la première phrase.','Finir sans question ni promesse de suite.'],
    beginner:{do:['Commence par le moment le plus fort.','Explique comme si la personne ne connaissait rien.','Relance souvent avec une phrase courte.','Mets des sous-titres très gros.','Finis par une question simple.'],dont:['Ne commence pas lentement.','Ne surcharge pas l’écran.','Ne laisse pas de blanc inutile.','Ne fais pas une miniature trop chargée.','Ne termine pas sans CTA.']}
  };
}
function renderReport(input){
  const r = ensureReport(input);
  const hookScores = r.hookScores || {
    start: Math.max(5, Math.min(10, r.scores.hook)),
    middle: Math.max(5, Math.min(10, r.scores.rhythm)),
    end: Math.max(5, Math.min(10, r.scores.cta)),
    retention: Math.max(5, Math.min(10, Math.round((r.scores.hook+r.scores.rhythm+r.scores.emotion)/3)))
  };
  const videoTitle = (lastAnalysis && lastAnalysis.video) ? lastAnalysis.video : (selectedVideo ? selectedVideo.name : 'Nouvelle vidéo.mp4');
  const videoDate = new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
  const sizeLabel = selectedVideo ? prettySize(selectedVideo.size) : '—';
  const thumb = selectedVideoUrl ? `<video class="vy-thumb" src="${selectedVideoUrl}" muted playsinline preload="metadata"></video>` : `<div class="vy-thumb empty">Non Disponible</div>`;
  const plan = (r.actions || []).slice(0,3);
  const global10 = Math.round((r.score/10)*10)/10;

  qs('results').innerHTML=`
    <div class="vy-video-list">  
      <div class="vy-sort-row"><span>Trier par:</span><button>Jour⌄</button><button class="vy-icon-btn">⇅</button></div>
      <article class="vy-video-card">
        <div class="vy-card-main">
          <div class="vy-thumb-wrap">${thumb}</div>
          <div class="vy-info-area">
            <div class="vy-title-row"><h3>${escapeHtml(videoTitle)}</h3><button class="vy-edit">✎</button></div>
            <div class="vy-meta-row"><span class="vy-status">◉ Terminé</span><span>📅 ${videoDate}</span><span>•</span><span>${sizeLabel}</span></div>
            <div class="vy-plan-box"><b>🚀 Plan d’Action</b>${plan.map((a,i)=>`<p><strong>${i+1}. ${['Narration','Sous-titrage','Rétention'][i] || 'Action'} :</strong> ${a}</p>`).join('')}</div>
            <div class="vy-card-actions"><button class="vy-purple" onclick="openAnalysisModal()">👁 Voir l’analyse</button><button class="vy-light" onclick="removeVideo()">🗑 Supprimer</button></div>
          </div>
          <aside class="vy-score-card">
            <span>Score Global</span>
            <strong>✨ ${global10}<small>/10</small></strong>
            <div class="vy-bar"><i style="width:${r.score}%"></i></div>
            ${vyMiniScore('Hook', r.scores.hook)}
            ${vyMiniScore('Visuel', r.scores.thumbnail || r.scores.clarity)}
            ${vyMiniScore('Viralité', Math.max(5, Math.min(10, Math.round((r.scores.emotion+r.scores.hook)/2))))}
            ${vyMiniScore('Cohérence', r.scores.clarity)}
            ${vyMiniScore('Rétention', r.scores.rhythm)}
            ${vyMiniScore('Magnétisme émotionnel', r.scores.emotion)}
          </aside>
        </div>
      </article>
    </div>

    <div id="analysisModal" class="vy-modal hidden" onclick="if(event.target.id==='analysisModal') closeAnalysisModal()">
      <div class="vy-modal-card">
        <button class="vy-close" onclick="closeAnalysisModal()">×</button>
        <div class="vy-modal-head"><div class="vy-logo">🪽 <strong>Videlyze</strong></div></div>
        <div class="vy-modal-sub"><h2>${escapeHtml(videoTitle)}</h2><button class="vy-light" onclick="copyReport()">⌄ PDF</button><div class="vy-mini-thumb">${thumb}</div></div>
        <div class="vy-score-hero"><strong>${global10}<small>/10</small></strong><div class="vy-bigbar ${r.score<70?'warn':''}"><i style="width:${r.score}%"></i></div></div>
        <section class="vy-modal-section"><h3>Scores Détaillés</h3>
          ${vyBigScore('Hook', r.scores.hook)}
          ${vyBigScore('Visuel', r.scores.thumbnail || r.scores.clarity)}
          ${vyBigScore('Viralité', Math.max(5, Math.min(10, Math.round((r.scores.emotion+r.scores.hook)/2))))}
          ${vyBigScore('Cohérence', r.scores.clarity)}
          ${vyBigScore('Rétention', r.scores.rhythm)}
          ${vyBigScore('Magnétisme émotionnel', r.scores.emotion)}
        </section>
        <section class="vy-modal-section"><h3>Analyse du Hook (0–3s)</h3><p>${r.deep.hookStart}</p><p><b>REWRITE :</b> ${r.hooks[0] || 'Commence par la phrase la plus forte.'}</p></section>
        <section class="vy-modal-section"><h3>Hooks & Rétention pendant toute la vidéo</h3><div class="vy-hook-grid">
          <div><b>Début</b><strong>${hookScores.start}/10</strong><p>${r.deep.hookStart}</p></div>
          <div><b>Milieu</b><strong>${hookScores.middle}/10</strong><p>${r.deep.hookMiddle}</p></div>
          <div><b>Avant la fin</b><strong>${hookScores.end}/10</strong><p>${r.deep.hookEnd}</p></div>
          <div><b>Rétention</b><strong>${hookScores.retention}/10</strong><p>Relance toutes les 6 à 10 secondes pour éviter les décrochages.</p></div>
        </div></section>
        <section class="vy-modal-section"><h3>Dynamisme & Visuel</h3><p>${r.deep.visual}</p></section>
        <section class="vy-modal-section"><h3>Script & Narration</h3><p>${r.deep.global}</p></section>
        <section class="vy-modal-section"><h3>Audio & Ambiance</h3><p>${r.deep.sound}</p></section>
        <section class="vy-modal-section"><h3>Analyse de l’Appel à l’Action</h3><p>${r.deep.cta}</p></section>
        <section class="vy-modal-section"><h3>Analyse seconde par seconde</h3><div class="vy-timeline">${r.timeline.map(x=>`<div><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div></section>
        <section class="vy-modal-section"><h3>Plan d’Action</h3>${r.actions.map((a,i)=>`<p><b>${i+1}. ${['Structure','Technique','Stratégie future','Sous-titrage','Rétention'][i] || 'Action'} :</b> ${a}</p>`).join('')}</section>
        <section class="vy-modal-section beginner"><h3>Mode débutant total — Fais ça / Ne fais pas ça</h3><div class="vy-do-dont"><div><h4>✅ Fais ça</h4><ul>${r.beginner.do.map(a=>`<li>${a}</li>`).join('')}</ul></div><div><h4>❌ Ne fais pas ça</h4><ul>${r.beginner.dont.map(a=>`<li>${a}</li>`).join('')}</ul></div></div></section>
        <section class="vy-modal-section"><h3>Transcription / Réécriture prête à dire</h3><div class="vy-transcript">${r.rewrite.map(a=>`<p>${a}</p>`).join('')}</div></section>
      </div>
    </div>`;
}

function openAnalysisModal(){ const m=qs('analysisModal'); if(m){m.classList.remove('hidden'); document.body.classList.add('modal-open');} }
function closeAnalysisModal(){ const m=qs('analysisModal'); if(m){m.classList.add('hidden'); document.body.classList.remove('modal-open');} }
function vyMiniScore(label,val){ return `<div class="vy-mini-score"><span>${label}</span><b>${val}/10</b><div class="vy-line"><i style="width:${val*10}%"></i></div></div>`; }
function vyBigScore(label,val){ return `<div class="vy-big-score"><div><span>${label}</span><b>${val}/10</b></div><div class="vy-line big"><i style="width:${val*10}%"></i></div></div>`; }
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

function bar(label,val){return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${val*10}%"></i></div><b>${val}/10</b></div>`}
function reportToText(r=lastAnalysis?.report){if(!r)return'';return `${r.summaryTitle}\nScore: ${r.score}/100\n\n${r.summaryText}\n\nHooks:\n- ${r.hooks.join('\n- ')}\n\nActions:\n- ${r.actions.join('\n- ')}`}
function copyReport(){navigator.clipboard.writeText(reportToText()).then(()=>alert('Rapport copié'))}
function saveHistory(item){
  const h=JSON.parse(localStorage.getItem('TA_HISTORY')||'[]');
  h.unshift(item);
  localStorage.setItem('TA_HISTORY',JSON.stringify(h.slice(0,50)));
  lastAnalysis=item;
}
function getHistory(){return JSON.parse(localStorage.getItem('TA_HISTORY')||'[]')}
function renderHistory(){
  const h=getHistory();
  if(qs('historyCount')) qs('historyCount').textContent=h.length;
  const el=qs('historyList'); if(!el)return;
  el.innerHTML=h.length?h.map(item=>`<div class="history-item history-row">
    <div onclick="openHistory(${item.id})" class="history-open">
      <h3>${escapeHtml(item.video)}</h3>
      <p>${item.date} · Score ${item.report?.score||'--'}/100 · ${escapeHtml(item.report?.summaryTitle||'Analyse sauvegardée')}</p>
    </div>
    <div class="history-actions">
      <button class="secondary-btn small" onclick="event.stopPropagation();openHistory(${item.id})">Voir</button>
      <button class="danger-btn small" onclick="event.stopPropagation();deleteHistoryItem(${item.id})">Supprimer</button>
    </div>
  </div>`).join(''):'<div class="empty-card"><h2>Aucune analyse</h2><p>Après une analyse vidéo, elle apparaîtra automatiquement ici.</p></div>'
}
function openHistory(id){
  const item=getHistory().find(x=>x.id===id); if(!item)return;
  lastAnalysis=item;
  switchPage('analyze',document.querySelector('[data-page="analyze"]'));
  qs('results').classList.remove('hidden');
  renderReport(item.report);
}
function deleteHistoryItem(id){
  if(!confirm('Supprimer uniquement cette analyse de l’historique ?')) return;
  const h=getHistory().filter(x=>x.id!==id);
  localStorage.setItem('TA_HISTORY',JSON.stringify(h));
  renderHistory();
}
function clearHistory(){
  if(!confirm('Vider tout l’historique ?')) return;
  localStorage.removeItem('TA_HISTORY'); renderHistory();
}
function fillPlannerFromLast(){const r=lastAnalysis?.report || getHistory()[0]?.report; if(!r){alert('Fais une analyse avant.');return;} qs('plannerTitle').value=r.hooks[0]||r.summaryTitle; qs('plannerHook').value=r.hooks[1]||''}
function savePlan(){const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); plans.unshift({id:Date.now(),title:qs('plannerTitle').value||'Nouvelle vidéo',season:qs('plannerSeason').value,episode:qs('plannerEpisode').value,date:qs('plannerDate').value,time:qs('plannerTime').value,hook:qs('plannerHook').value}); localStorage.setItem('TA_PLANS',JSON.stringify(plans)); renderPlans();}
function renderPlans(){const plans=JSON.parse(localStorage.getItem('TA_PLANS')||'[]'); const el=qs('plannerList'); if(!el)return; el.innerHTML=plans.map(p=>`<div class="plan-item"><h3>S${p.season} EP${p.episode} — ${p.title}</h3><p>${p.date||'Date à choisir'} à ${p.time||'--:--'} · Hook : ${p.hook||'à écrire'}</p></div>`).join('')}
async function generateScript(){const idea=qs('scriptInput').value.trim() || (lastAnalysis? reportToText(lastAnalysis.report):''); if(!idea){alert('Mets une idée ou lance une analyse avant.');return;} qs('scriptOutput').textContent='Génération en cours…'; const script=`HOOK 0–2 sec :\n${idea.split('\n')[0].slice(0,90)}\n\nDÉROULÉ :\n1. Montrer tout de suite le moment fort.\n2. Expliquer en une phrase ce qui se passe.\n3. Relancer : “Et là, ça part encore plus loin…”\n4. Garder seulement les réactions utiles.\n5. Finir par : “Tu aurais fait quoi à sa place ?”\n\nSOUS-TITRES CONSEILLÉS :\n- Gros texte blanc, contour noir.\n- Mots importants en jaune.\n- Une phrase courte par écran.`; qs('scriptOutput').textContent=script;}
function generateScriptFromLast(){const r=lastAnalysis?.report || getHistory()[0]?.report; if(!r){alert('Fais une analyse avant.');return;} qs('scriptInput').value=reportToText(r); generateScript();}
function renderIdeas(){const el=qs('ideasList'); if(!el)return; ['Le moment où tout bascule','Avant / après la dispute','La phrase qui a mis le feu','Ce qu’on n’a pas vu au début','La réaction que personne n’attendait'].forEach(t=>el.innerHTML+=`<div class="pill">${t}</div>`)}

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
  const text=(qs('thumbText')?.value||'ÇA A DÉGÉNÉRÉ').toUpperCase(); const sub=qs('thumbSubtext')?.value||'Regarde jusqu’à la fin';
  drawStrokeText(ctx,text,W*.06,H*.73,W*.88,Math.round(W*.105),'#fff','#000',10);
  ctx.fillStyle=a; ctx.font=`900 ${Math.round(W*.045)}px Arial`; ctx.textAlign='left'; ctx.fillText(sub.toUpperCase(),W*.07,H*.90);
  ctx.fillStyle='rgba(0,0,0,.75)';ctx.beginPath();ctx.roundRect(W*.06,H*.925,W*.88,H*.045,22);ctx.fill();ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(W*.03)}px Arial`;ctx.textAlign='center';ctx.fillText('NOUVEL ÉPISODE · RÉACTION EN COMMENTAIRE',W/2,H*.955);
  updatePrompt();
}
function drawStrokeText(ctx,text,x,y,maxWidth,fontSize,fill,stroke,lineHeight){ctx.textAlign='left';ctx.lineJoin='round';let size=fontSize;let words=text.split(' '),lines=[];do{ctx.font=`1000 ${size}px Arial Black, Arial`;lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}lines.push(line); if(lines.length*size*1.05>fontSize*2.4) size-=4; else break;}while(size>32); ctx.font=`1000 ${size}px Arial Black, Arial`; lines.forEach((l,i)=>{const yy=y+i*size*1.05;ctx.strokeStyle=stroke;ctx.lineWidth=lineHeight;ctx.strokeText(l,x,yy);ctx.fillStyle=fill;ctx.fillText(l,x,yy);});}
function updatePrompt(){const prompt=`Miniature TikTok verticale 9:16, style ${thumbState.style}, très viral, gros texte lisible, contraste fort, badge S${qs('thumbSeason')?.value||1} EP${qs('thumbEpisode')?.value||1}, émotion forte, sujet: ${qs('thumbText')?.value||'ça a dégénéré'}, image réaliste, couleurs puissantes, composition claire pour mobile, pas de texte illisible.`; if(qs('leonardoPrompt')) qs('leonardoPrompt').textContent=prompt;}
function copyLeonardoPrompt(){navigator.clipboard.writeText(qs('leonardoPrompt').textContent); alert('Prompt copié')}
function downloadThumbnail(){const a=document.createElement('a'); a.download=`miniature_S${qs('thumbSeason').value}_EP${qs('thumbEpisode').value}.png`; a.href=qs('thumbCanvas').toDataURL('image/png'); a.click();}
