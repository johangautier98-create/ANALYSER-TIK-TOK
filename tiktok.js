// api/tiktok.js — Infos chaîne TikTok via oEmbed + scraping mobile
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { action, url, username } = req.body || {};

  try {
    if (action === 'video_info') {
      if (!url) return res.status(400).json({ ok: false, error: 'URL manquante' });
      const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      if (!r.ok) return res.status(200).json({ ok: false, error: 'Video introuvable (' + r.status + ')' });
      const d = await r.json();
      if (d.error) return res.status(200).json({ ok: false, error: d.error });
      return res.status(200).json({ ok: true, video: {
        title: d.title || 'Video TikTok',
        author: d.author_name || 'Inconnu',
        authorUrl: d.author_url || '',
        thumbnail: d.thumbnail_url || '',
        url
      }});
    }

    if (action === 'channel_info') {
      const handle = (username || '').replace('@', '').trim().toLowerCase();
      if (!handle) return res.status(400).json({ ok: false, error: 'Nom manquant' });
      const profileUrl = 'https://www.tiktok.com/@' + handle;
      let avatar = '', displayName = '@' + handle, bio = '';

      // oEmbed
      try {
        const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(profileUrl), {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (r.ok) {
          const d = await r.json();
          if (d.author_name) displayName = d.author_name;
          if (d.thumbnail_url) avatar = d.thumbnail_url;
        }
      } catch(e) {}

      // Scraping mobile
      if (!avatar) {
        try {
          const r = await fetch(profileUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html', 'Accept-Language': 'fr-FR'
            }
          });
          if (r.ok) {
            const html = await r.text();
            const av = html.match(/"avatarLarger":"([^"]+)"/);
            if (av) avatar = av[1].replace(/\\u002F/g, '/');
            const nn = html.match(/"nickname":"([^"]+)"/);
            if (nn) displayName = nn[1];
            const sg = html.match(/"signature":"([^"]+)"/);
            if (sg) bio = sg[1].replace(/\\n/g, ' ');
            if (!avatar) {
              const og = html.match(/<meta property="og:image" content="([^"]+)"/);
              if (og) avatar = og[1];
            }
          }
        } catch(e) {}
      }

      return res.status(200).json({ ok: true, channel: {
        handle: '@' + handle, displayName, avatar, bio, url: profileUrl
      }});
    }

    return res.status(400).json({ ok: false, error: 'Action inconnue' });
  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
