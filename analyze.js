// api/analyze.js — Test de connexion seulement
// L'ANALYSE REELLE se fait directement depuis le browser (bypass Vercel timeout)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.body || {};

  // Test de connexion rapide uniquement
  if (body.action === 'test') {
    let provider = 'none';
    if (body.openaiKey) provider = 'openai';
    if (body.geminiKey) provider = 'gemini+openai';
    return res.status(200).json({ ok: true, provider });
  }

  // Securite: si quelqu'un appelle /api/analyze pour une analyse, lui dire d'utiliser le browser
  return res.status(200).json({
    ok: false,
    error: 'Analyse effectuee directement depuis le browser pour eviter les timeouts Vercel'
  });
}
