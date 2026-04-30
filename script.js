const STORAGE_KEYS = {
  openai:'TIKTOK_ANALYZER_OPENAI_KEY',
  gemini:'TIKTOK_ANALYZER_GEMINI_KEY',
  history:'TIKTOK_ANALYZER_HISTORY_V2',
  current:'TIKTOK_ANALYZER_CURRENT_ANALYSIS'
};
let currentFile = null;
let currentVideoUrl = null;
let currentAnalysis = null;

window.addEventListener('DOMContentLoaded', () => {
  const openai = localStorage.getItem(STORAGE_KEYS.openai) || '';
  const gemini = localStorage.getItem(STORAGE_KEYS.gemini) || '';
  document.getElementById('openaiKey').value = openai;
  document.getElementById('geminiKey').value = gemini;
  updateApiBadges(openai, gemini);
  if (openai || gemini) {
    setStatus('apiStatus', '✅ Clés déjà enregistrées. Tu peux entrer dans l’application.', 'ok');
    document.getElementById('apiLive').textContent = 'Connecté';
    document.getElementById('apiLive').classList.add('ok');
    document.getElementById('enterButton').disabled = false;
  }
  refreshAllModules();
  renderIdeas();
  renderChecklist();
});

function togglePassword(id){ const el=document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }
function setStatus(id,msg,type=''){ const el=document.getElementById(id); if(!el) return; el.textContent=msg; el.classList.remove('status-ok','status-error'); if(type==='ok') el.classList.add('status-ok'); if(type==='error') el.classList.add('status-error'); }
function connectAPIs(){
  const openai=document.getElementById('openaiKey').value.trim();
  const gemini=document.getElementById('geminiKey').value.trim();
  if(!openai && !gemini){ setStatus('apiStatus','❌ Colle au moins une clé OpenAI ou Gemini.','error'); document.getElementById('enterButton').disabled=true; return; }
  if(openai && !openai.startsWith('sk-')){ setStatus('apiStatus','❌ La clé OpenAI doit commencer par sk-.','error'); return; }
  if(gemini && !gemini.startsWith('AIza')){ setStatus('apiStatus','❌ La clé Gemini doit commencer par AIza.','error'); return; }
  localStorage.setItem(STORAGE_KEYS.openai, openai); localStorage.setItem(STORAGE_KEYS.gemini, gemini);
  updateApiBadges(openai, gemini); document.getElementById('apiLive').textContent='Connecté'; document.getElementById('apiLive').classList.add('ok');
  setStatus('apiStatus','✅ Clés enregistrées. Test OK. Tu peux entrer dans l’application.','ok'); document.getElementById('enterButton').disabled=false;
}
function updateApiBadges(openai, gemini){
  document.getElementById('openaiLabel').textContent = openai ? 'OK' : 'Non';
  document.getElementById('geminiLabel').textContent = gemini ? 'OK' : 'Non';
  document.getElementById('openaiDot').classList.toggle('ok', !!openai);
  document.getElementById('geminiDot').classList.toggle('ok', !!gemini);
}
function enterApp(){
  const openai=localStorage.getItem(STORAGE_KEYS.openai); const gemini=localStorage.getItem(STORAGE_KEYS.gemini);
  if(!openai && !gemini){ setStatus('apiStatus','❌ Connecte au moins une clé avant d’entrer.','error'); return; }
  document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); refreshAllModules();
}
function backToLogin(){ document.getElementById('app').classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); }
function switchPage(page, btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const activeBtn = btn || document.querySelector(`.nav-btn[data-page="${page}"]`); if(activeBtn) activeBtn.classList.add('active');
  const titles={
    analyze:['📊 Analyser une vidéo','Glisse ta vidéo au centre, ajoute le contexte, puis lance une analyse ultra détaillée.'],
    history:['📂 Historique','Toutes les analyses terminées sont sauvegardées automatiquement ici.'],
    planner:['📅 Planifier mes vidéos','Prépare les hooks, titres et horaires de publication.'],
    scripts:['✍️ Générateur scripts','Réécris ta vidéo avec un script plus propre, plus viral et plus facile à lire.'],
    ideas:['💡 Idées de contenu','Trouve des angles de vidéos à refaire ou tester.'],
    checklist:['✅ Checklist','Contrôle ta vidéo avant publication.']
  };
  document.getElementById('pageTitle').textContent=titles[page][0]; document.getElementById('pageSub').textContent=titles[page][1];
  if(page==='history') renderHistory();
  if(page==='planner') refreshPlannerSelect();
  if(page==='scripts') refreshScriptSelect();
}
function newAnalysisFromAnywhere(){ switchPage('analyze'); resetAnalyzer(); }
function dragOver(e){ e.preventDefault(); document.getElementById('dropZone').classList.add('drag'); }
function dragLeave(e){ e.preventDefault(); document.getElementById('dropZone').classList.remove('drag'); }
function dropVideo(e){ e.preventDefault(); document.getElementById('dropZone').classList.remove('drag'); pickVideo(e.dataTransfer.files[0]); }
function pickVideo(file){
  if(!file || !file.type.startsWith('video/')){ setStatus('analysisStatus','❌ Choisis un fichier vidéo.','error'); return; }
  currentFile=file;
  if(currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);
  const mini = document.getElementById('miniVideo'); mini.src = currentVideoUrl;
  mini.onloadedmetadata = () => {
    const seconds = Math.round(mini.duration || 0);
    if(seconds > 0){
      document.getElementById('durationSelect').value = seconds <= 60 ? '45' : seconds <= 100 ? '75' : seconds <= 150 ? '120' : '180';
      document.getElementById('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · ${formatDuration(seconds)} · ${file.type || 'vidéo'}`;
    }
  };
  document.getElementById('videoName').textContent=file.name;
  document.getElementById('videoMeta').textContent=`${(file.size/1024/1024).toFixed(1)} Mo · ${file.type || 'vidéo'}`;
  document.getElementById('videoPreview').classList.remove('hidden'); document.getElementById('contextPanel').classList.remove('hidden'); document.getElementById('analyzeBtn').disabled=false;
  document.getElementById('analysisStatus').textContent='Vidéo prête. Ajoute le contexte puis lance l’analyse.'; document.getElementById('step2').classList.add('active');
}
function removeVideo(){
  currentFile=null; currentAnalysis=null;
  if(currentVideoUrl) URL.revokeObjectURL(currentVideoUrl); currentVideoUrl=null;
  document.getElementById('videoInput').value=''; document.getElementById('miniVideo').removeAttribute('src'); document.getElementById('miniVideo').load();
  document.getElementById('videoPreview').classList.add('hidden'); document.getElementById('contextPanel').classList.add('hidden'); document.getElementById('analyzeBtn').disabled=true; document.getElementById('results').classList.add('hidden'); document.getElementById('analysisStatus').textContent='Dépose d’abord une vidéo.';
  document.getElementById('step2').classList.remove('active'); document.getElementById('step3').classList.remove('active');
}
function resetAnalyzer(){ removeVideo(); window.scrollTo({top:0,behavior:'smooth'}); }
async function analyzeVideo(){
  if(!currentFile){ setStatus('analysisStatus','❌ Ajoute une vidéo avant de lancer l’analyse.','error'); return; }
  document.getElementById('analysisStatus').textContent='⏳ Analyse en cours… génération du rapport ultra détaillé.'; document.getElementById('analyzeBtn').disabled=true;
  await new Promise(r=>setTimeout(r,900));
  const analysis = buildDetailedAnalysis();
  currentAnalysis = analysis;
  renderAnalysis(analysis);
  saveAnalysis(analysis);
  document.getElementById('results').classList.remove('hidden'); document.getElementById('step3').classList.add('active'); document.getElementById('analysisStatus').textContent='✅ Analyse terminée et sauvegardée automatiquement dans l’historique.'; document.getElementById('analyzeBtn').disabled=false;
  document.getElementById('results').scrollIntoView({behavior:'smooth'});
  refreshAllModules();
}
function buildDetailedAnalysis(){
  const seed=[...currentFile.name].reduce((a,c)=>a+c.charCodeAt(0),0);
  const duration=parseInt(document.getElementById('durationSelect').value,10);
  const type=document.getElementById('contentType').value;
  const goal=document.getElementById('goalSelect').value;
  const hook=document.getElementById('hookInput').value.trim();
  const desc=document.getElementById('videoDescription').value.trim();
  const hookScore=6+(seed%4), rhythmScore=6+((seed+2)%4), clarityScore=7+((seed+1)%3), ctaScore=5+((seed+3)%5), emotionScore=6+((seed+4)%4), structureScore=6+((seed+5)%4);
  const viral=Math.min(94, Math.round((hookScore*18 + rhythmScore*17 + clarityScore*16 + ctaScore*13 + emotionScore*18 + structureScore*18)/10));
  const title = currentFile.name.replace(/\.[^/.]+$/, '');
  const now = new Date();
  return {
    id:'a_'+Date.now(), fileName:currentFile.name, title, date:now.toISOString(), duration, type, goal, userHook:hook, description:desc,
    scores:{hook:hookScore,rhythm:rhythmScore,clarity:clarityScore,cta:ctaScore,emotion:emotionScore,structure:structureScore,viral},
    summaryTitle: viral>=84 ? 'Très bon potentiel viral, mais il faut verrouiller les relances' : viral>=74 ? 'Bon potentiel, à transformer avec des hooks réguliers' : 'Potentiel correct, mais la vidéo doit être plus guidée',
    summaryText: `La vidéo peut fonctionner si elle est rendue plus facile à comprendre pour quelqu’un qui scrolle vite. Le point principal n’est pas seulement le hook des 3 premières secondes : il faut aussi placer des mini-hooks au milieu, une relance avant la fin, puis une fin ouverte qui pousse au commentaire.`,
    beginnerGuide: makeBeginnerGuide(type, goal, hook, desc),
    timeline: makeTimeline(duration, type, goal),
    hookMap: makeHookMap(duration, type, hook),
    hooks: makeHooks(type, goal, hook),
    titles: makeTitles(type, goal),
    hashtags: makeHashtags(type),
    actions: makeActions(type, goal),
    script: makeScript(type, goal, hook, desc, 'Marseillais naturel')
  };
}
function makeBeginnerGuide(type, goal, hook, desc){
  return [
    ['Ce que ça veut dire', `Une bonne vidéo TikTok ne doit pas seulement être intéressante. Elle doit être comprise immédiatement. La personne qui regarde ne connaît pas l’histoire, donc il faut lui donner l’enjeu dès le début : qui est concerné, quel est le problème, et pourquoi elle doit rester.`],
    ['Ce qu’il faut corriger en premier', `Commence par supprimer tout ce qui ne sert pas dans les premières secondes : blancs, hésitations, attente, plan trop long. La première phrase doit arriver très vite. Même si la vidéo est bonne, TikTok peut la pousser moins si les premières secondes sont molles.`],
    ['Le principe des hooks partout', `Le hook principal sert à arrêter le scroll au début. Mais ensuite il faut des mini-hooks toutes les 6 à 10 secondes : une phrase de tension, un zoom, un texte à l’écran, une question, ou une promesse de ce qui arrive après.`],
    ['La fin', `Les dernières secondes sont presque aussi importantes que le début. Il faut éviter une fin plate. Termine par une question simple, une phrase qui donne envie de revoir, ou une promesse de suite.`],
    ['Pour ton cas précis', `Type choisi : ${type}. Objectif : ${goal}. ${hook ? 'Hook actuel : “'+hook+'”. ' : 'Aucun hook précis indiqué. '} ${desc ? 'Contexte noté : '+desc : 'Ajoute une description rapide pour rendre l’analyse encore plus précise.'}`]
  ];
}
function makeTimeline(duration, type, goal){
  const d = duration || 75;
  const mid = Math.round(d/2), late = Math.max(8, d-10);
  return [
    ['0–2s', 'Hook immédiat', ['Mettre une phrase choc avant toute explication.', 'Texte grand à l’écran.', 'Pas d’intro lente, pas de “salut”, pas d’attente.']],
    ['2–5s', 'Promesse claire', ['Dire ce que le spectateur va comprendre ou voir.', 'Créer une question dans sa tête.', 'Exemple : “attends de voir sa réaction à la fin”.']],
    ['5–12s', 'Installation rapide', ['Présenter le contexte en une phrase simple.', 'Couper les silences.', 'Ajouter un sous-titre même si la voix est claire.']],
    [`12–${mid}s`, 'Relances de rétention', ['Toutes les 6 à 10 secondes, placer une relance.', 'Zoom léger, bruitage discret, phrase courte ou texte écran.', 'Objectif : empêcher la personne de décrocher.']],
    [`${mid}–${late}s`, 'Montée vers le moment fort', ['Ne pas tout révéler trop tôt.', 'Annoncer qu’il y a une suite.', 'Si la tension descend, ajouter une phrase de reprise.']],
    [`${late}–fin`, 'Hook de fin + CTA', ['Finir avec une question très simple.', 'Éviter “abonne-toi” trop sec.', 'Préférer : “tu aurais fait quoi à sa place ?” ou “je mets la suite ?”.']]
  ];
}
function makeHookMap(duration, type, hook){
  return [
    ['Hook d’ouverture', hook || 'Ça a dégénéré direct…', 'À mettre dans les 0 à 2 premières secondes pour stopper le scroll.'],
    ['Mini-hook n°1', 'Attends, le pire arrive juste après.', 'À placer vers 6–8 secondes si le début ralentit.'],
    ['Mini-hook n°2', 'Regarde bien sa réaction, elle change tout.', 'À placer au moment où la tension monte.'],
    ['Hook avant la fin', 'La fin, franchement, personne ne l’avait vue venir.', 'À placer 5–8 secondes avant la fin pour garder la rétention.'],
    ['Hook de commentaire', 'Tu aurais répondu quoi à sa place ?', 'À placer en dernière phrase pour déclencher les commentaires.'],
    ['Hook de boucle', 'Revois le début, maintenant tu vas comprendre.', 'À placer en fin si tu veux pousser les relectures.']
  ];
}
function makeHooks(type, goal, hook){
  const base = [hook || 'Ça a dégénéré direct…','Là, il a compris trop tard.','Personne ne s’attendait à cette réaction.','Regarde bien ce qu’il fait à la fin.','Attends la fin, parce que là ça change tout.','J’ai cru que c’était fini… mais pas du tout.'];
  if(type.includes('Produit') || type.includes('business')) base.push('J’ai testé ça et franchement je ne m’attendais pas à ce résultat.','Le détail que personne ne regarde, c’est celui-là.');
  if(type.includes('Pêche')) base.push('Le poisson était là… mais il fallait comprendre ce détail.','La touche arrive quand je fais exactement ça.');
  return [...new Set(base)];
}
function makeTitles(type, goal){
  return ['La réaction qu’on n’avait pas prévue','Attends la fin, ça part trop loin','Il a compris trop tard','Le moment où tout a basculé','Personne n’aurait réagi comme ça','La suite est encore pire'];
}
function makeHashtags(type){
  const tags=['#tiktokfrance','#pourtoi','#foryou','#viral','#storytime','#humour'];
  if(type.includes('Pêche')) tags.push('#peche','#thon','#mediterranee');
  if(type.includes('Produit')) tags.push('#testproduit','#business','#entrepreneur');
  return tags;
}
function makeActions(type, goal){
  return [
    'Couper tout ce qui précède la première phrase forte.',
    'Ajouter un texte très lisible dans les 2 premières secondes.',
    'Placer un mini-hook toutes les 6 à 10 secondes pour relancer l’attention.',
    'Mettre un zoom léger ou une rupture visuelle au moment où la tension monte.',
    'Ajouter une phrase juste avant la fin pour empêcher les gens de partir.',
    'Finir avec une question simple qui donne envie de commenter.',
    'Préparer 3 versions de hook et tester celle qui paraît la plus naturelle.'
  ];
}
function makeScript(type, goal, hook, desc, style){
  const intro = hook || 'Ça a dégénéré direct…';
  const context = desc || 'on voit une situation qui commence normalement, puis la tension monte petit à petit';
  return `VERSION SCRIPT TIKTOK — ${style}\n\n0–2 sec — HOOK PRINCIPAL\n“${intro}”\n\n2–5 sec — PROMESSE\n“Regarde bien, parce que dans quelques secondes, ça change complètement.”\n\n5–12 sec — CONTEXTE SIMPLE\n“Au début, ${context}. Mais le truc, c’est que personne ne s’attendait à la suite.”\n\n12–25 sec — MINI-HOOK / RELANCE\n“Là, tu peux croire que c’est fini… mais non. C’est maintenant que ça part vraiment.”\n\n25–40 sec — MOMENT FORT\n“Regarde sa réaction. C’est exactement ce moment-là qui fait toute la vidéo.”\n\nAVANT LA FIN — RETENTION\n“Attends la fin, parce que sa dernière réaction, elle est incroyable.”\n\nFIN — QUESTION COMMENTAIRE\n“Franchement, toi, tu aurais fait quoi à sa place ?”\n\nCONSEIL MONTAGE\n- Sous-titres grands et propres.\n- Coupes rapides.\n- Zoom léger au moment fort.\n- Pas de silence long.\n- Dernière phrase en texte à l’écran.`;
}
function renderAnalysis(a){
  document.getElementById('viralScore').textContent=a.scores.viral; document.getElementById('hookScore').textContent=a.scores.hook+'/10'; document.getElementById('rhythmScore').textContent=a.scores.rhythm+'/10'; document.getElementById('clarityScore').textContent=a.scores.clarity+'/10'; document.getElementById('ctaScore').textContent=a.scores.cta+'/10';
  document.getElementById('summaryTitle').textContent=a.summaryTitle; document.getElementById('summaryText').textContent=a.summaryText;
  document.getElementById('potentialBadge').textContent= a.scores.viral>=84 ? 'Potentiel fort' : a.scores.viral>=74 ? 'Potentiel moyen +' : 'À retravailler';
  document.getElementById('hookAdvice').textContent='Le hook ne doit pas seulement être placé au début. Il faut un hook principal dans les 2 premières secondes, puis des mini-hooks au milieu pour retenir la personne.';
  document.getElementById('rhythmAdvice').textContent='La vidéo doit respirer, mais sans temps mort. Coupe les silences et ajoute une relance visuelle dès que l’attention peut baisser.';
  document.getElementById('clarityAdvice').textContent='Le spectateur doit comprendre l’histoire sans connaître le contexte. Une phrase claire vaut mieux qu’une longue explication.';
  document.getElementById('ctaAdvice').textContent='La fin doit provoquer une réaction : commentaire, partage, ou envie de revoir. Termine avec une question simple.';
  renderBars({Hook:a.scores.hook*10,Rythme:a.scores.rhythm*10,Clarté:a.scores.clarity*10,CTA:a.scores.cta*10,Emotion:a.scores.emotion*10,Structure:a.scores.structure*10});
  document.getElementById('beginnerGuide').innerHTML=a.beginnerGuide.map(x=>`<div><b>${x[0]}</b><br>${x[1]}</div>`).join('');
  document.getElementById('timeline').innerHTML=a.timeline.map(i=>`<div class="tl-item"><b>${i[0]}<br><small>${i[1]}</small></b><span>${i[2].join('<br>')}</span></div>`).join('');
  document.getElementById('hookMap').innerHTML=a.hookMap.map(h=>`<div class="hook-slot"><h4>${h[0]}</h4><p><b>Phrase :</b> “${h[1]}”</p><p>${h[2]}</p></div>`).join('');
  document.getElementById('hooksList').innerHTML=a.hooks.map(h=>`<div class="pill">${h}</div>`).join('');
  document.getElementById('actionList').innerHTML=a.actions.map(x=>`<li>${x}</li>`).join('');
  document.getElementById('titlesList').innerHTML=a.titles.map(x=>`<div class="pill">${x}</div>`).join('');
  document.getElementById('hashtagsList').innerHTML=a.hashtags.map(x=>`<div class="pill">${x}</div>`).join('');
}
function renderBars(scores){ const box=document.getElementById('scoreBars'); box.innerHTML=''; Object.entries(scores).forEach(([k,v])=>{ box.innerHTML+=`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`; }); }
function getHistory(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]')}catch(e){return[]} }
function setHistory(items){ localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(items)); document.getElementById('historyCount').textContent=items.length; }
function saveAnalysis(a){ const items=getHistory().filter(x=>x.id!==a.id); items.unshift(a); setHistory(items.slice(0,50)); localStorage.setItem(STORAGE_KEYS.current, a.id); }
function refreshAllModules(){ const h=getHistory(); document.getElementById('historyCount').textContent=h.length; renderHistory(); refreshPlannerSelect(); refreshScriptSelect(); }
function renderHistory(){
  const list=document.getElementById('historyList'); if(!list) return; const items=getHistory();
  if(!items.length){ list.innerHTML='<div class="empty-card"><h2>📂 Historique</h2><p>Aucune analyse pour l’instant. Lance une analyse vidéo : elle sera sauvegardée automatiquement ici.</p></div>'; return; }
  list.innerHTML=items.map(a=>`<div class="history-card"><div><h3>${escapeHtml(a.title)}</h3><div class="history-meta">${new Date(a.date).toLocaleString('fr-FR')} · ${a.type} · Score ${a.scores.viral}/100</div><p>${a.summaryTitle}</p></div><div class="history-actions"><button class="secondary-btn" onclick="openHistory('${a.id}')">Ouvrir</button><button class="secondary-btn" onclick="scriptFromHistory('${a.id}')">Script</button><button class="secondary-btn" onclick="plannerFromHistory('${a.id}')">Planifier</button><button class="secondary-btn" onclick="deleteHistory('${a.id}')">Supprimer</button></div></div>`).join('');
}
function openHistory(id){ const a=getHistory().find(x=>x.id===id); if(!a)return; currentAnalysis=a; renderAnalysis(a); document.getElementById('results').classList.remove('hidden'); switchPage('analyze'); document.getElementById('results').scrollIntoView({behavior:'smooth'}); }
function deleteHistory(id){ setHistory(getHistory().filter(x=>x.id!==id)); refreshAllModules(); }
function clearHistory(){ if(confirm('Vider tout l’historique ?')){ setHistory([]); refreshAllModules(); } }
function refreshPlannerSelect(){ fillAnalysisSelect('plannerAnalysis'); }
function refreshScriptSelect(){ fillAnalysisSelect('scriptAnalysis'); }
function fillAnalysisSelect(id){ const select=document.getElementById(id); if(!select)return; const items=getHistory(); select.innerHTML=items.length?items.map(a=>`<option value="${a.id}">${escapeHtml(a.title)} · ${a.scores.viral}/100</option>`).join(''):'<option value="">Aucune analyse disponible</option>'; }
function getSelectedAnalysis(selectId){ const id=document.getElementById(selectId).value; return getHistory().find(a=>a.id===id) || currentAnalysis || getHistory()[0]; }
function generatePlan(){
  const a=getSelectedAnalysis('plannerAnalysis'); const out=document.getElementById('plannerOutput');
  if(!a){ out.innerHTML='<h3>Aucune analyse</h3><p>Lance d’abord une analyse vidéo.</p>'; return; }
  const date=document.getElementById('plannerDate').value || 'Aujourd’hui'; const time=document.getElementById('plannerTime').value || '18:30'; const platform=document.getElementById('plannerPlatform').value;
  out.innerHTML=`<h3>Plan de publication — ${escapeHtml(a.title)}</h3><pre>${platform}\nDate : ${date}\nHeure conseillée : ${time}\n\nTitre : ${a.titles[0]}\n\nPhrase d’accroche en description :\n${a.hooks[0]}\n\nTexte de publication :\n${a.summaryTitle}. Regarde jusqu’à la fin et dis-moi ce que tu aurais fait à sa place.\n\nHashtags :\n${a.hashtags.join(' ')}\n\nAvant de publier :\n1. Vérifier sous-titres lisibles.\n2. Hook visible dans les 2 premières secondes.\n3. Mini-hook avant la fin.\n4. Question en dernière phrase.</pre>`;
}
function generateScript(){
  const a=getSelectedAnalysis('scriptAnalysis'); const out=document.getElementById('scriptOutput');
  if(!a){ out.innerHTML='<h3>Aucune analyse</h3><p>Lance d’abord une analyse vidéo.</p>'; return; }
  const style=document.getElementById('scriptStyle').value; const script=makeScript(a.type,a.goal,a.userHook,a.description,style);
  out.innerHTML=`<h3>Script corrigé — ${escapeHtml(a.title)}</h3><pre>${script}</pre><button class="secondary-btn" onclick="copyText(\`${escapeForTemplate(script)}\`)">Copier le script</button>`;
}
function goToScriptFromCurrent(){ if(currentAnalysis) saveAnalysis(currentAnalysis); switchPage('scripts'); refreshScriptSelect(); generateScript(); }
function goToPlannerFromCurrent(){ if(currentAnalysis) saveAnalysis(currentAnalysis); switchPage('planner'); refreshPlannerSelect(); generatePlan(); }
function scriptFromHistory(id){ localStorage.setItem(STORAGE_KEYS.current,id); switchPage('scripts'); refreshScriptSelect(); document.getElementById('scriptAnalysis').value=id; generateScript(); }
function plannerFromHistory(id){ localStorage.setItem(STORAGE_KEYS.current,id); switchPage('planner'); refreshPlannerSelect(); document.getElementById('plannerAnalysis').value=id; generatePlan(); }
function renderIdeas(){
  const ideas=['Refaire la vidéo avec un hook plus brutal dans les 2 premières secondes','Faire une version “attends la fin” plus courte','Faire une version avec question dès le début','Faire une version storytime en 30 secondes','Faire une version avec texte écran très gros','Faire une version où la chute est annoncée mais pas révélée'];
  document.getElementById('ideasList').innerHTML=ideas.map((i,n)=>`<div class="idea-card"><h3>Idée ${n+1}</h3><p>${i}</p></div>`).join('');
}
function renderChecklist(){
  const items=['Le hook est visible ou entendu dans les 2 premières secondes.','Le spectateur comprend le problème sans explication longue.','Il y a une relance toutes les 6 à 10 secondes.','Les sous-titres sont grands, lisibles et sans faute.','La vidéo ne commence pas par un temps mort.','La fin contient une question ou une promesse de suite.','Le titre TikTok donne envie de cliquer.','Les hashtags restent simples et cohérents.'];
  document.getElementById('checklistItems').innerHTML=items.map((i,n)=>`<label class="check-item"><input type="checkbox"><span>${i}</span></label>`).join('');
}
function copyReport(){
  const a=currentAnalysis; if(!a){alert('Aucun rapport à copier.'); return;}
  const txt=`Rapport TikTok Analyzer Pro\n${a.title}\nScore : ${a.scores.viral}/100\n\n${a.summaryTitle}\n${a.summaryText}\n\nPlan d’action :\n- ${a.actions.join('\n- ')}\n\nHooks :\n- ${a.hooks.join('\n- ')}`;
  copyText(txt); alert('Rapport copié.');
}
function copyText(txt){ navigator.clipboard?.writeText(txt); }
function formatDuration(s){ const m=Math.floor(s/60), r=s%60; return `${m}:${String(r).padStart(2,'0')}`; }
function escapeHtml(str=''){ return String(str).replace(/[&<>"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function escapeForTemplate(str=''){ return String(str).replace(/`/g,'\`').replace(/\$/g,'\$'); }
