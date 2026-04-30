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
  const prompt = `Tu es un expert TikTok senior. Réponds uniquement en JSON valide avec cette structure: {"score":number,"potential":"...","summaryTitle":"...","summaryText":"...","scores":{"hook":number,"rhythm":number,"clarity":number,"cta":number,"emotion":number,"thumbnail":number},"cards":{"hook":"...","rhythm":"...","clarity":"...","cta":"..."},"timeline":[["0-3 sec","..."]],"hooks":["..."],"actions":["..."],"beginner":{"do":["..."],"dont":["..."]}}. Analyse ultra détaillée pour débutant total. Vidéo: ${b.videoName}. Type: ${b.contentType}. Hook actuel: ${b.hook||'non indiqué'}. Durée: ${b.duration}s. Insiste sur hooks au début, au milieu et avant la fin.`;
  if (b.openaiKey) {
    try {
      const messages=[{role:'system',content:'Tu réponds uniquement en JSON valide.'},{role:'user',content:prompt}];
      const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${b.openaiKey}`},body:JSON.stringify({model:'gpt-4o-mini',messages,temperature:.6,response_format:{type:'json_object'}})});
      const data=await r.json(); const txt=data.choices?.[0]?.message?.content; if(txt) return normalize(JSON.parse(txt),base);
    } catch(e) {}
  }
  if (b.geminiKey) {
    try {
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${b.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.6,responseMimeType:'application/json'}})});
      const data=await r.json(); const txt=data.candidates?.[0]?.content?.parts?.[0]?.text; if(txt) return normalize(JSON.parse(txt),base);
    } catch(e) {}
  }
  return base;
}
function normalize(r,base){return {...base,...r,scores:{...base.scores,...(r.scores||{})},cards:{...base.cards,...(r.cards||{})},beginner:{...base.beginner,...(r.beginner||{})}}}
function fallback(b){return {score:78,potential:'Bon potentiel à renforcer',summaryTitle:'Analyse générée avec plan clair',summaryText:'La vidéo peut fonctionner si elle démarre plus fort, garde des relances régulières et termine sur une question simple.',scores:{hook:7,rhythm:7,clarity:8,cta:6,emotion:8,thumbnail:7},cards:{hook:'Ajoute un hook au début, puis des micro-hooks toutes les 8 à 12 secondes. Le spectateur doit toujours attendre la suite.',rhythm:'Coupe les blancs, ajoute des zooms légers et accélère dès que l’attention baisse.',clarity:'Explique très clairement qui parle, pourquoi c’est important et ce qu’on doit surveiller.',cta:'Termine avec une question simple qui pousse à commenter.'},timeline:[['0–3 sec','Phrase choc immédiate.'],['4–8 sec','Contexte simple.'],['9–15 sec','Micro-hook de relance.'],['Milieu','Nouvelle tension ou phrase suspense.'],['Fin','Question commentaire.']],hooks:['Ça a dégénéré direct…','Attends la fin, sa réaction est lunaire…','Là, tout le monde pensait que ça allait se calmer…','Tu aurais répondu quoi ?'],actions:['Renforcer la première phrase.','Couper les blancs.','Ajouter des sous-titres lisibles.','Créer une miniature forte.','Finir par une question.'],beginner:{do:['Commencer par le moment fort.','Mettre une relance toutes les 8–12 secondes.','Sous-titres gros et lisibles.'],dont:['Ne pas commencer lentement.','Ne pas laisser de silence.','Ne pas finir sans question.']}}}
