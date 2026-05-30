export default async function handler(req, res) {
  res.json({ ok:true, message:'Gemini est appelé par /api/analyze', keyExists:Boolean(process.env.GEMINI_API_KEY), model:process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
}
