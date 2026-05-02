// api/tiktok.js — Récupère infos chaîne TikTok et vidéo via URL
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Methode non autorisee' });

  const { action, url, username } = req.body || {};

  try {
    // 1. Infos sur une VIDEO TikTok via son URL
    if (action === 'video_info') {
      if (!url) return res.status(400).json({ ok: false, error: 'URL manquante' });
      const oembedUrl = 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url);
      const r = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/1.0)' }
      });
      if (!r.ok) return res.status(200).json({ ok: false, error: 'Video introuvable ou privee' });
      const data = await r.json();
      return res.status(200).json({
        ok: true,
        video: {
          title:      data.title || 'Sans titre',
          author:     data.author_name || 'Inconnu',
          author_url: data.author_url || '',
          thumbnail:  data.thumbnail_url || '',
          url:        url
        }
      });
    }

    // 2. Infos sur une CHAINE TikTok via @username
    if (action === 'channel_info') {
      const handle = (username || '').replace('@', '').trim();
      if (!handle) return res.status(400).json({ ok: false, error: 'Nom de chaine manquant' });
      const profileUrl = 'https://www.tiktok.com/@' + handle;

      let avatar = '', displayName = handle;
      let followers = null, likes = null, videos = null;

      // oEmbed pour le nom et l'avatar
      try {
        const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(profileUrl), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/1.0)' }
        });
        if (r.ok) {
          const d = await r.json();
          displayName = d.author_name || handle;
          avatar      = d.thumbnail_url || '';
        }
      } catch (e) {}

      // Scraping leger des stats
      try {
        const pageR = await fetch(profileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9'
          }
        });
        if (pageR.ok) {
          const html = await pageR.text();
          const follMatch = html.match(/"followerCount":(\d+)/);
          const likeMatch = html.match(/"heartCount":(\d+)/);
          const vidMatch  = html.match(/"videoCount":(\d+)/);
          if (follMatch) followers = parseInt(follMatch[1]);
          if (likeMatch) likes = parseInt(likeMatch[1]);
          if (vidMatch)  videos = parseInt(vidMatch[1]);
          if (!avatar) {
            const m = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (m) avatar = m[1];
          }
        }
      } catch (e) {}

      return res.status(200).json({
        ok: true,
        channel: {
          handle:      '@' + handle,
          displayName: displayName,
          avatar:      avatar,
          url:         profileUrl,
          followers:   followers,
          likes:       likes,
          videos:      videos
        }
      });
    }

    return res.status(400).json({ ok: false, error: 'Action inconnue' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
