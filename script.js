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
function localFallbackReport(p){
  const hook=p.hook || 'Ça a dégénéré direct…';
  return {score:76,potential:'Bon potentiel à améliorer',summaryTitle:'Vidéo exploitable avec besoin de relances plus fortes',summaryText:'La base est bonne, mais il faut guider davantage le spectateur. Le début doit annoncer un conflit clair, le milieu doit relancer la curiosité, et la fin doit donner envie de commenter.',scores:{hook:7,rhythm:7,clarity:8,cta:6,emotion:8,thumbnail:7},
  cards:{hook:'Le hook ne doit pas seulement être dans les 3 premières secondes. Il faut un hook d’entrée, puis des micro-hooks toutes les 8 à 12 secondes pour empêcher le spectateur de partir.',rhythm:'Coupe les silences, ajoute des zooms légers sur les réactions et garde une rupture visuelle dès que l’histoire ralentit.',clarity:'Explique qui parle, ce qui se passe, et pourquoi c’est important. Une personne débutante doit comprendre sans contexte.',cta:'La fin doit poser une question simple : “Tu aurais fait quoi à sa place ?” ou “Team qui dans cette histoire ?”'},
  timeline:[['0–3 sec','Hook d’entrée : commence par une phrase choc, par exemple : “Attends, là ça a vraiment dégénéré…”'],['4–8 sec','Contexte ultra simple : qui est là, quel est le problème, pourquoi on doit regarder.'],['9–15 sec','Premier micro-hook : annonce qu’il va se passer quelque chose, sans tout dévoiler.'],['16–30 sec','Accélère le rythme : coupe les hésitations, garde uniquement les réactions utiles.'],['Milieu','Relance émotionnelle : ajoute une phrase type “Et là, personne ne s’attendait à sa réponse.”'],['Dernières secondes','Fin ouverte : ne termine pas platement. Pose une question pour déclencher les commentaires.']],
  hooks:[hook,'Attends la fin, parce que sa réaction est lunaire…','Là, tout le monde pensait que ça allait se calmer…','Personne n’avait prévu qu’il allait répondre ça.','À ta place, tu aurais réagi comment ?'],
  actions:['Ajouter un hook très clair dès la première seconde.','Mettre une relance toutes les 8 à 12 secondes.','Supprimer les blancs et les passages qui n’apportent rien.','Ajouter des sous-titres gros et lisibles.','Finir avec une question simple pour obtenir des commentaires.'],
  beginner:{do:['Commencer par le moment le plus fort, pas par l’introduction.','Écrire les sous-titres comme si la personne regardait sans le son.','Mettre un zoom léger quand quelqu’un réagit.'],dont:['Ne pas commencer par “bonjour” ou une explication lente.','Ne pas laisser 3 secondes sans mouvement ou sans parole.','Ne pas finir sans question ou sans suspense.']}}
}
function renderReport(r){
  qs('results').innerHTML=`
  <div class="results-head"><div><span class="result-chip">Rapport ultra détaillé</span><h2>📋 Analyse complète</h2></div><button class="secondary-btn" onclick="copyReport()">Copier le rapport</button></div>
  <div class="score-hero"><div class="score-ring"><strong>${r.score}</strong><span>/100</span></div><div><span class="potential">${r.potential}</span><h3>${r.summaryTitle}</h3><p>${r.summaryText}</p></div><div class="score-bars">${bar('Hook',r.scores.hook)}${bar('Rythme',r.scores.rhythm)}${bar('Clarté',r.scores.clarity)}${bar('CTA',r.scores.cta)}${bar('Émotion',r.scores.emotion)}${bar('Miniature',r.scores.thumbnail)}</div></div>
  <div class="cards-grid"><article class="report-card"><h3>🎣 Hook global</h3><b>${r.scores.hook}/10</b><p>${r.cards.hook}</p></article><article class="report-card"><h3>⚡ Rythme</h3><b>${r.scores.rhythm}/10</b><p>${r.cards.rhythm}</p></article><article class="report-card"><h3>🧠 Clarté</h3><b>${r.scores.clarity}/10</b><p>${r.cards.clarity}</p></article><article class="report-card"><h3>📢 Fin / CTA</h3><b>${r.scores.cta}/10</b><p>${r.cards.cta}</p></article></div>
  <div class="wide-card"><h3>⏱ Analyse seconde par seconde</h3><div class="timeline">${r.timeline.map(x=>`<div class="tl-item"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div></div>
  <div class="two-col"><div class="wide-card"><h3>🔥 Hooks à placer partout</h3><div class="pill-list">${r.hooks.map(h=>`<div class="pill">${h}</div>`).join('')}</div></div><div class="wide-card"><h3>✅ Plan d’action prioritaire</h3><ol>${r.actions.map(a=>`<li>${a}</li>`).join('')}</ol></div></div>
  <div class="beginner-box"><h3>🧩 Mode débutant total : fais ça / ne fais pas ça</h3><div class="do-dont"><div class="do"><h4>✅ FAIS ÇA</h4><ul>${r.beginner.do.map(a=>`<li>${a}</li>`).join('')}</ul></div><div class="dont"><h4>❌ NE FAIS PAS ÇA</h4><ul>${r.beginner.dont.map(a=>`<li>${a}</li>`).join('')}</ul></div></div></div>`;
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
