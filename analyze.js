module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Méthode non autorisée' });
  try {
    const body = req.body || {};
    if (body.action === 'test') return res.status(200).json({ ok:true, provider: body.openaiKey ? 'openai' : body.geminiKey ? 'gemini' : 'local' });
    const report = await makeReport(body);
    return res.status(200).json({ ok:true, report });
  } catch (e) {
    return res.status(200).json({ ok:false, error:e.message });
  }
}

async function makeReport(b){
  const base = fallback(b);
  const prompt = `Tu es un expert TikTok senior et un professeur très patient.
Réponds uniquement en JSON valide.
La personne qui lit est débutante totale : donne une analyse LONGUE, claire, avec exemples et actions précises.

Structure JSON obligatoire:
{"score":number,"potential":"...","summaryTitle":"...","summaryText":"...","scores":{"hook":number,"rhythm":number,"clarity":number,"cta":number,"emotion":number,"thumbnail":number},"cards":{"hook":"...","rhythm":"...","clarity":"...","cta":"..."},"deep":{"global":"...","hookStart":"...","hookMiddle":"...","hookEnd":"...","subtitles":"...","sound":"..."},"timeline":[["0-1 sec","..."],["1-3 sec","..."],["3-6 sec","..."],["6-10 sec","..."],["10-18 sec","..."],["18-25 sec","..."],["Milieu","..."],["10 sec avant la fin","..."],["Dernières secondes","..."]],"hooks":["..."],"actions":["..."],"rewrite":["..."],"checklist":["..."],"errorsToAvoid":["..."],"beginner":{"do":["..."],"dont":["..."]}}

Vidéo: ${b.videoName || 'sans nom'}
Type: ${b.contentType || 'non indiqué'}
Hook actuel: ${b.hook || 'non indiqué'}
Durée: ${b.duration || 'non indiquée'} secondes
Images clés: ${Array.isArray(b.frames)?b.frames.length:0}

Obligatoire:
- explique les hooks au début, au milieu, avant la fin et à la fin;
- explique quoi faire, pourquoi, comment;
- donne des phrases prêtes à dire;
- détaille sous-titres, rythme, CTA, miniature;
- fais très pédagogique, pas résumé.`;

  if (b.openaiKey) {
    try {
      const messages=[{role:'system',content:'Tu réponds uniquement en JSON valide. Très pédagogique, concret, long.'},{role:'user',content:prompt}];
      const r=await fetchWithTimeout('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${b.openaiKey}`},body:JSON.stringify({model:'gpt-4o-mini',messages,temperature:.45,max_tokens:2200,response_format:{type:'json_object'}})}, 6500);
      const data=await r.json(); const txt=data.choices?.[0]?.message?.content; if(txt) return normalize(JSON.parse(txt),base);
    } catch(e) {}
  }
  if (b.geminiKey) {
    try {
      const r=await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${b.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.45,maxOutputTokens:2200,responseMimeType:'application/json'}})}, 4500);
      const data=await r.json(); const txt=data.candidates?.[0]?.content?.parts?.[0]?.text; if(txt) return normalize(JSON.parse(txt),base);
    } catch(e) {}
  }
  return base;
}
async function fetchWithTimeout(url, options, ms){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), ms);
  try { return await fetch(url, {...options, signal: controller.signal}); }
  finally { clearTimeout(t); }
}

function normalize(r,base){
  return {...base,...r,
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
  }
}
function fallback(b){
  return {score:78,potential:'Bon potentiel — il faut renforcer les hooks et les explications',summaryTitle:'Vidéo exploitable avec une structure TikTok plus claire',summaryText:'La vidéo peut fonctionner si elle prend le spectateur par la main. Pour TikTok, il faut expliquer très vite pourquoi il faut rester, puis relancer l’attention régulièrement. Un débutant doit retenir ceci : début fort, contexte simple, relances fréquentes, fin avec question.',scores:{hook:7,rhythm:7,clarity:7,cta:6,emotion:8,thumbnail:7},cards:{hook:'Prévois 4 hooks : un au début, un au milieu, un juste avant la fin, et un dans la dernière phrase pour provoquer un commentaire.',rhythm:'Coupe les blancs et les hésitations. Dès que l’image ou le son devient plat, ajoute un zoom léger, un texte ou une relance.',clarity:'Explique en phrases courtes qui parle, quel est le problème, et pourquoi le spectateur doit regarder.',cta:'La fin doit poser une question simple. Exemple : “Tu aurais fait quoi à sa place ?”.'},deep:{global:'La vidéo doit être comprise par quelqu’un qui ne connaît rien à l’histoire. Elle doit annoncer le problème vite, garder la tension, et ne jamais laisser le spectateur seul.',hookStart:'Dans les 0 à 3 secondes, commence par le moment fort ou une phrase choc. Ne commence pas par une introduction.',hookMiddle:'Au milieu, ajoute une phrase qui relance : “Et là, tout change.” Cela empêche les gens de partir.',hookEnd:'Juste avant la fin, annonce la chute : “Le pire arrive maintenant.”',subtitles:'Sous-titres très gros, phrases courtes, contraste fort, une seule idée par écran.',sound:'Évite les blancs audio. Si le son est faible, renforce les sous-titres et le rythme.'},timeline:[['0–1 sec','Phrase choc immédiate.'],['1–3 sec','Contexte simple.'],['3–6 sec','Relance visuelle.'],['6–10 sec','Micro-hook.'],['10–18 sec','Couper les longueurs.'],['18–25 sec','Préparer la suite.'],['Milieu','Relancer émotionnellement.'],['10 sec avant la fin','Annoncer la chute.'],['Dernières secondes','Question commentaire.']],hooks:['Ça a dégénéré direct…','Attends sa réaction…','Là tout change…','Personne n’avait prévu ça…','Tu aurais fait quoi ?','Il a raison ou pas ?','Regarde jusqu’au bout…','S1 EP2 arrive.'],actions:['Renforcer la première phrase.','Ajouter des relances toutes les 6 à 10 secondes.','Couper les blancs.','Grossir les sous-titres.','Créer une miniature claire.','Terminer par une question.','Préparer la suite.'],rewrite:['Hook : “Là, ça devait être calme… mais ça a dégénéré.”','Milieu : “Et là, tout le monde bloque.”','Fin : “Tu aurais répondu quoi ?”','Titre : “Il pensait avoir raison…”'],checklist:['Comprend-on en 3 secondes ?','Relance avant 10 secondes ?','Sous-titres lisibles ?','Fin avec question ?','Miniature claire ?'],errorsToAvoid:['Intro lente.','Texte trop petit.','Silence trop long.','Tout dévoiler trop vite.','Fin plate.'],beginner:{do:['Commencer fort.','Expliquer simplement.','Relancer souvent.','Sous-titrer gros.','Finir par une question.'],dont:['Ne pas commencer lentement.','Ne pas surcharger l’écran.','Ne pas laisser de blanc.','Ne pas faire une miniature chargée.','Ne pas finir sans CTA.']}}
}
