const cache = new Map();
const CACHE_TTL = 60 * 1000;

async function fetchSingleFeed(feed) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'GBFSExplorer/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        feed_name: feed.name,
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      feed_name: feed.name,
      data,
      error: null,
    };
  } catch (error) {
    return {
      feed_name: feed.name,
      data: null,
      error: error.message || 'Unknown error',
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { feeds } = req.body || {};

    if (!feeds || !Array.isArray(feeds)) {
      return res.status(400).json({ error: 'feeds array is required' });
    }

    const cacheKey = JSON.stringify(feeds.map((f) => f.url).sort());
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json(cached.data);
    }

    const results = await Promise.all(feeds.map(fetchSingleFeed));

    cache.set(cacheKey, { data: results, timestamp: Date.now() });

    return res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
