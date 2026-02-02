const tokenManager = {
  accessToken: null,
  tokenExpiresAt: null,
};

let feedsCache = null;
const CACHE_DURATION_HOURS = 6;

function isTokenExpired() {
  if (!tokenManager.accessToken || !tokenManager.tokenExpiresAt) {
    return true;
  }
  const bufferTime = 5 * 60 * 1000;
  return new Date() >= new Date(tokenManager.tokenExpiresAt.getTime() - bufferTime);
}

async function refreshAccessToken() {
  const refreshToken = process.env.MOBILITY_DATABASE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('MOBILITY_DATABASE_REFRESH_TOKEN not configured');
  }

  const response = await fetch('https://api.mobilitydatabase.org/v1/tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh access token: ${response.status}`);
  }

  const tokenData = await response.json();
  tokenManager.accessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;
  tokenManager.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  return tokenManager.accessToken;
}

async function getAccessToken() {
  if (isTokenExpired()) {
    return refreshAccessToken();
  }
  return tokenManager.accessToken;
}

async function fetchAllGbfsFeeds(dataType = 'gbfs') {
  const accessToken = await getAccessToken();
  const baseUrl = 'https://api.mobilitydatabase.org';
  const allFeeds = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${baseUrl}/v1/feeds?data_type=${dataType}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feeds: ${response.status}`);
    }

    const data = await response.json();
    const pageFeeds = Array.isArray(data) ? data : data.results || data.feeds || data.data || [];

    if (pageFeeds.length === 0) {
      break;
    }

    allFeeds.push(...pageFeeds);

    if (pageFeeds.length < limit) {
      break;
    }

    offset += limit;
  }

  return allFeeds;
}

function extractLocationFromFeed(feed) {
  const provider = feed.provider || '';
  const sourceInfo = feed.source_info || {};
  const producerUrl = sourceInfo.producer_url || '';

  const cityPatterns = {
    oslo: ['Oslo', 'NO'],
    bergen: ['Bergen', 'NO'],
    trondheim: ['Trondheim', 'NO'],
    stockholm: ['Stockholm', 'SE'],
    copenhagen: ['Copenhagen', 'DK'],
    helsinki: ['Helsinki', 'FI'],
    paris: ['Paris', 'FR'],
    london: ['London', 'GB'],
    berlin: ['Berlin', 'DE'],
    amsterdam: ['Amsterdam', 'NL'],
    'new york': ['New York', 'US'],
    'san francisco': ['San Francisco', 'US'],
    chicago: ['Chicago', 'US'],
    toronto: ['Toronto', 'CA'],
    montreal: ['Montreal', 'CA'],
    vancouver: ['Vancouver', 'CA'],
    sydney: ['Sydney', 'AU'],
    melbourne: ['Melbourne', 'AU'],
  };

  const searchText = `${provider} ${producerUrl}`.toLowerCase();

  for (const [pattern, [city, country]] of Object.entries(cityPatterns)) {
    if (searchText.includes(pattern)) {
      return { location: city, countryCode: country };
    }
  }

  return { location: 'Unknown Location', countryCode: '' };
}

function processFeeds(feeds) {
  return feeds
    .filter((feed) => feed.data_type === 'gbfs')
    .map((feed) => {
      const sourceInfo = feed.source_info || {};
      const producerUrl = sourceInfo.producer_url || '';
      const { location, countryCode } = extractLocationFromFeed(feed);

      return {
        systemId: feed.id,
        name: feed.provider,
        location,
        countryCode,
        url: producerUrl,
        autoDiscoveryUrl: producerUrl,
        provider: feed.provider,
        status: feed.status || 'unknown',
        entity_type: feed.entity_type,
        features: feed.features || [],
        note: feed.note || '',
      };
    });
}

function isCacheValid() {
  if (!feedsCache) return false;
  const age = Date.now() - feedsCache.timestamp.getTime();
  return age < CACHE_DURATION_HOURS * 60 * 60 * 1000;
}

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

  try {
    const forceRefresh = req.query.force_refresh === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

    if (!forceRefresh && isCacheValid() && feedsCache) {
      let systems = feedsCache.data;
      if (limit && limit > 0) {
        systems = systems.slice(0, limit);
      }
      return res.status(200).json({
        systems,
        total_count: systems.length,
        last_updated: feedsCache.timestamp.toISOString(),
        cache_hit: true,
      });
    }

    const feeds = await fetchAllGbfsFeeds('gbfs');
    const systems = processFeeds(feeds);

    feedsCache = { data: systems, timestamp: new Date() };

    let resultSystems = systems;
    if (limit && limit > 0) {
      resultSystems = systems.slice(0, limit);
    }

    return res.status(200).json({
      systems: resultSystems,
      total_count: resultSystems.length,
      last_updated: new Date().toISOString(),
      cache_hit: false,
    });
  } catch (error) {
    console.error('Failed to fetch feeds:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch feeds',
    });
  }
}
