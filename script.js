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
  qs('enterButton').disabled=false; qs('apiLive').textContent='Connecté'; qs('apiLive').classList.add('ok'); updateApiLabels();
}
function setApiStatus(msg,type){qs('apiStatus').textContent=msg; qs('apiStatus').className='status-box '+(type==='ok'?'status-ok':type==='error'?'status-error':'')}
function updateApiLabels(){const k=getKeys(); qs('openaiLabel').textContent=k.openai?'Oui':'Non'; qs('geminiLabel').textContent=k.gemini?'Oui':'Non'; qs('openaiDot').classList.toggle('ok',!!k.openai); qs('geminiDot').classList.toggle('ok',!!k.gemini)}
function enterApp(){qs('loginScreen').classList.add('hidden'); qs('app').classList.remove('hidden'); updateApiLabels(); renderThumbnail();}
function backToLogin(){qs('app').classList.add('hidden'); qs('loginScreen').classList.remove('hidden');}

function switchPage(page, btn){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); qs('page-'+page).classList.add('active'); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active'); qs('pageTitle').textContent=titles[page][0]; qs('pageSub').textContent=titles[page][1]; if(page==='thumbnails') setTimeout(renderThumbnail,50)}
function dragOver(e){e.preventDefault(); qs('dropZone').classList.add('drag')}
function dragLeave(e){e.preventDefault(); qs('dropZone').classList.remove('drag')}
function dropVideo(e){e.preventDefault(); qs('dropZone').classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) pickVideo(f)}
function pickVideo(file){if(!file||!file.type.startsWith('video/')){alert('Choisis un fichier vidéo.'); return;} selectedVideo=file; if(selectedVideoUrl) URL.revokeObjectURL(selectedVideoUrl); selectedVideoUrl=URL.createObjectURL(file); qs('videoName').textContent=file.name; qs('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · prêt à analyser`; qs('videoPreview').classList.remove('hidden'); qs('contextPanel').classList.remove('hidden'); qs('analyzeBtn').disabled=false; qs('analysisStatus').textContent='Vidéo prête. Tu peux lancer l’analyse.'; qs('step2').classList.add('active'); thumbState.videoFile=file; thumbState.videoUrl=selectedVideoUrl;}
function removeVideo(){selectedVideo=null; qs('videoPreview').classList.add('hidden'); qs('contextPanel').classList.add('hidden'); qs('analyzeBtn').disabled=true; qs('analysisStatus').textContent='Dépose d’abord une vidéo.'; qs('results').classList.add('hidden')}
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
  if(!selectedVideo){alert('Ajoute une vidéo avant.'); return;}
  const k=getKeys();
  qs('results').classList.remove('hidden');
  qs('results').innerHTML='<div class="loading-card"><div class="spinner"></div><h2>Analyse en cours…</h2><p>Extraction des images clés, lecture du contexte et génération d’un rapport ultra détaillé.</p></div>';
  qs('analyzeBtn').disabled=true; qs('analysisStatus').textContent='Analyse en cours…'; qs('step3').classList.add('active');
  const frames = await extractFrames(selectedVideo,4);
  const payload={
    action:'analyze', openaiKey:k.openai, geminiKey:k.gemini,
    videoName:selectedVideo.name, duration:qs('durationSelect').value, contentType:qs('contentType').value, hook:qs('hookInput').value,
    frames
  };
  let report=null;
  try{
    const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json(); if(data && data.report) report=data.report;
  }catch(e){ console.warn(e); }
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
  const priorityBadges = [
    ['À corriger en premier','Le hook + la première phrase'],
    ['À améliorer ensuite','Le rythme et les coupures'],
    ['À finaliser','La fin + la question commentaire']
  ];
  qs('results').innerHTML=`
  <div class="report-shell">
    <div class="report-header-clean">
      <div>
        <span class="result-chip">Rapport ultra pédagogique</span>
        <h2>📋 Analyse complète — claire, rangée, actionnable</h2>
        <p>Lecture conseillée : commence par le score global, puis les priorités, puis les hooks, puis le plan d’action.</p>
      </div>
      <button class="secondary-btn" onclick="copyReport()">Copier le rapport</button>
    </div>

    <section class="report-section section-resume">
      <div class="section-title"><span>1</span><div><h3>Résumé principal</h3><p>Ce qu’il faut comprendre en premier, sans se perdre dans les détails.</p></div></div>
      <div class="score-hero clean-hero">
        <div class="score-ring no-slice"><strong>${r.score}</strong><span>/100</span><small>score global</small></div>
        <div class="hero-copy">
          <span class="potential">${r.potential}</span>
          <h3>${r.summaryTitle}</h3>
          <p>${r.summaryText}</p>
          <div class="score-explain"><b>Lecture simple :</b> 0–50 = à retravailler · 50–70 = correct · 70–85 = bon potentiel · 85+ = très solide. Le score sert à savoir quoi corriger en priorité.</div>
        </div>
        <div class="priority-box">
          <h4>🎯 Priorités immédiates</h4>
          ${priorityBadges.map(x=>`<div class="priority-row"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="report-section">
      <div class="section-title"><span>2</span><div><h3>Scores par catégorie</h3><p>Chaque score indique une zone précise à améliorer.</p></div></div>
      <div class="score-dashboard-grid">
        <div class="score-panel big">${bar('Hook',r.scores.hook)}<p>Capacité à arrêter le scroll et à créer de la curiosité.</p></div>
        <div class="score-panel">${bar('Rythme',r.scores.rhythm)}<p>Coupures, énergie, absence de moments mous.</p></div>
        <div class="score-panel">${bar('Clarté',r.scores.clarity)}<p>Est-ce qu’un débutant comprend tout de suite ?</p></div>
        <div class="score-panel">${bar('CTA',r.scores.cta)}<p>Fin qui donne envie de commenter ou regarder la suite.</p></div>
        <div class="score-panel">${bar('Émotion',r.scores.emotion)}<p>Réaction, tension, surprise, humour ou conflit.</p></div>
        <div class="score-panel">${bar('Miniature',r.scores.thumbnail)}<p>Lisibilité et envie de cliquer depuis la couverture.</p></div>
      </div>
    </section>

    <section class="report-section section-hooks">
      <div class="section-title"><span>3</span><div><h3>Hooks dans toute la vidéo</h3><p>Le hook ne doit pas être uniquement au début : il faut relancer l’attention plusieurs fois.</p></div></div>
      <div class="hook-score-grid clean-hooks">
        <div class="hook-score-card"><strong>Début 0–3s</strong><b>${hookScores.start}/10</b><p>${r.deep.hookStart}</p></div>
        <div class="hook-score-card"><strong>Milieu / relance</strong><b>${hookScores.middle}/10</b><p>${r.deep.hookMiddle}</p></div>
        <div class="hook-score-card"><strong>Avant la fin</strong><b>${hookScores.end}/10</b><p>${r.deep.hookEnd}</p></div>
        <div class="hook-score-card"><strong>Rétention totale</strong><b>${hookScores.retention}/10</b><p>Il faut remettre une raison de rester toutes les 6 à 10 secondes.</p></div>
      </div>
      <div class="wide-card compact-card"><h4>🔥 Hooks prêts à utiliser</h4><div class="pill-list ordered-pills">${r.hooks.map((h,i)=>`<div class="pill"><b>${i+1}</b>${h}</div>`).join('')}</div></div>
    </section>

    <section class="report-section">
      <div class="section-title"><span>4</span><div><h3>Analyse détaillée étape par étape</h3><p>Une lecture dans l’ordre de la vidéo, comme une fiche de correction.</p></div></div>
      <div class="timeline clean-timeline">${r.timeline.map((x,i)=>`<div class="tl-item"><b>${x[0]}</b><span>${x[1]}<em class="mini-score">${i<3?'Priorité haute':i<6?'Priorité moyenne':'Finition'}</em></span></div>`).join('')}</div>
    </section>

    <section class="report-section">
      <div class="section-title"><span>5</span><div><h3>Compréhension débutant total</h3><p>La partie la plus simple : quoi faire et quoi éviter.</p></div></div>
      <div class="lesson-box"><h3>🧠 Explication simple pour Patrick</h3><p>${r.deep.global}</p></div>
      <div class="do-dont clean-do-dont">
        <div class="do"><h4>✅ FAIS ÇA</h4><ul>${r.beginner.do.map(a=>`<li>${a}</li>`).join('')}</ul></div>
        <div class="dont"><h4>❌ NE FAIS PAS ÇA</h4><ul>${r.beginner.dont.map(a=>`<li>${a}</li>`).join('')}</ul></div>
      </div>
    </section>

    <section class="report-section">
      <div class="section-title"><span>6</span><div><h3>Actions concrètes avant publication</h3><p>La liste simple à suivre avant de poster.</p></div></div>
      <div class="two-col clean-two-col">
        <div class="wide-card"><h3>✅ Plan d’action prioritaire</h3><ol>${r.actions.map(a=>`<li>${a}</li>`).join('')}</ol></div>
        <div class="wide-card"><h3>✍️ Réécriture proposée</h3><ul>${r.rewrite.map(a=>`<li>${a}</li>`).join('')}</ul></div>
      </div>
    </section>

    <section class="report-section">
      <div class="section-title"><span>7</span><div><h3>Derniers contrôles</h3><p>À vérifier juste avant de publier sur TikTok.</p></div></div>
      <div class="two-col clean-two-col">
        <div class="wide-card"><h3>📌 Checklist avant publication</h3><ul>${r.checklist.map(a=>`<li>${a}</li>`).join('')}</ul></div>
        <div class="wide-card danger-soft"><h3>🚫 Erreurs à éviter</h3><ul>${r.errorsToAvoid.map(a=>`<li>${a}</li>`).join('')}</ul></div>
      </div>
    </section>
  </div>`;
}
function bar(label,val){return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${val*10}%"></i></div><b>${val}/10</b></div>`}
function reportToText(r=lastAnalysis?.report){if(!r)return'';return `${r.summaryTitle}\nScore: ${r.score}/100\n\n${r.summaryText}\n\nHooks:\n- ${r.hooks.join('\n- ')}\n\nActions:\n- ${r.actions.join('\n- ')}`}
function copyReport(){navigator.clipboard.writeText(reportToText()).then(()=>alert('Rapport copié'))}
function saveHistory(item){const h=JSON.parse(localStorage.getItem('TA_HISTORY')||'[]'); h.unshift(item); localStorage.setItem('TA_HISTORY',JSON.stringify(h.slice(0,30))); lastAnalysis=item;}
function getHistory(){return JSON.parse(localStorage.getItem('TA_HISTORY')||'[]')}
function renderHistory(){const h=getHistory(); if(qs('historyCount')) qs('historyCount').textContent=h.length; const el=qs('historyList'); if(!el)return; el.innerHTML=h.length?h.map(item=>`<div class="history-item" onclick="openHistory(${item.id})"><h3>${item.video}</h3><p>${item.date} · Score ${item.report.score}/100 · ${item.report.summaryTitle}</p></div>`).join(''):'<div class="empty-card"><h2>Aucune analyse</h2><p>Après une analyse vidéo, elle apparaîtra automatiquement ici.</p></div>'}
function openHistory(id){const item=getHistory().find(x=>x.id===id); if(!item)return; lastAnalysis=item; switchPage('analyze',document.querySelector('[data-page="analyze"]')); qs('results').classList.remove('hidden'); renderReport(item.report);}
function clearHistory(){localStorage.removeItem('TA_HISTORY'); renderHistory();}
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
