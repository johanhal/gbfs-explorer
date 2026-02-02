const USER_AGENT = 'GBFSExplorer/1.0 (+https://betamobility.com/tools/gbfs-explorer)';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = req.query.target_url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'target_url query parameter is required' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Provider error: ${response.status} - ${errorText.substring(0, 200)}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('application/geo+json')) {
      const text = await response.text();
      return res.status(502).json({
        error: `Unexpected Content-Type from ${targetUrl}: ${contentType}. Expected JSON. Response: ${text.substring(0, 200)}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(408).json({
        error: `Request to ${targetUrl} timed out after 7 seconds`,
      });
    }
    return res.status(502).json({
      error: `Network error fetching ${targetUrl}: ${error.message}`,
    });
  }
}
