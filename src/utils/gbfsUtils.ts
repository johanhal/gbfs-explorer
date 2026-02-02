
import brain from 'brain';

// Define the expected structure of a GBFS system
export interface GBFSSystem {
  countryCode: string;
  name: string;
  location: string;
  systemId: string;
  url: string;
  autoDiscoveryUrl?: string;
  provider?: string;
  status?: string;
  entity_type?: string;
  features?: string[];
  note?: string;
}

export interface CitySystemGroup {
  city: string;
  countryCode: string;
  operators: GBFSSystem[];
  systemIds: string[];
}

// Cache variables
let cachedSystems: GBFSSystem[] = [];
let isFetching = false;
let fetchPromise: Promise<GBFSSystem[]> | null = null;

/**
 * Clears the cached systems data to force a fresh fetch.
 */
export function clearSystemsCache(): void {
  console.log('🧹 Clearing frontend systems cache...');
  cachedSystems = [];
  isFetching = false;
  fetchPromise = null;
}

/**
 * Fetches GBFS systems data using the brain client.
 * @returns A promise that resolves to an array of GBFSSystem objects.
 */
export async function fetchAndParseGBFSData(): Promise<GBFSSystem[]> {
  if (cachedSystems.length > 0) {
    console.log(`📋 Using cached systems: ${cachedSystems.length}`);
    return Promise.resolve([...cachedSystems]);
  }

  if (isFetching && fetchPromise) {
    return fetchPromise;
  }

  isFetching = true;
  fetchPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('🔄 Fetching GBFS systems via brain client...');
      
      const response = await brain.get_mobility_feeds();
      const data = await response.json();
      
      console.log('🔍 Raw API response structure:', Object.keys(data));
      console.log('🔍 Systems array length:', data.systems?.length || 0);
      
      const systems: GBFSSystem[] = data.systems || [];
      
      // Debug: Check first few systems structure
      if (systems.length > 0) {
        console.log('🔍 First system structure:', Object.keys(systems[0]));
        console.log('🔍 First system sample:', {
          name: systems[0].name,
          location: systems[0].location,
          systemId: systems[0].systemId
        });
        
        // Check Oslo systems specifically
        const osloSystems = systems.filter(s => 
          s.name?.toLowerCase().includes('oslo') || 
          s.location?.toLowerCase().includes('oslo')
        );
        console.log(`🔍 Oslo systems found: ${osloSystems.length}`);
        osloSystems.slice(0, 2).forEach((system, i) => {
          console.log(`🔍 Oslo system ${i+1}:`, {
            name: system.name,
            location: system.location,
            systemId: system.systemId
          });
        });
      }
      
      console.log(`✅ Loaded ${systems.length} GBFS systems`);
      cachedSystems = [...systems];
      resolve([...cachedSystems]);
    } catch (error) {
      console.error('❌ Error fetching GBFS data:', error);
      reject(error);
    } finally {
      isFetching = false;
      fetchPromise = null;
    }
  });
  
  return fetchPromise;
}

/**
 * Searches for GBFS systems based on a query string.
 * @param systems An array of GBFSSystem objects.
 * @param query The search query string.
 * @returns A filtered array of GBFSSystem objects.
 */
export function searchSystems(systems: GBFSSystem[], query: string): GBFSSystem[] {
  console.log(`🔍 Searching ${systems.length} systems for query: "${query}"`);
  
  if (!query) {
    console.log('🔍 Empty query, returning empty results');
    return [];
  }
  
  const lowerCaseQuery = query.toLowerCase();
  const results = systems.filter(system => {
    const nameMatch = system.name?.toLowerCase().includes(lowerCaseQuery) || false;
    const locationMatch = system.location?.toLowerCase().includes(lowerCaseQuery) || false;
    return nameMatch || locationMatch;
  });
  
  console.log(`🔍 Search results: ${results.length} systems found`);
  if (results.length > 0) {
    console.log('🔍 First few results:', results.slice(0, 3).map(s => ({ name: s.name, location: s.location })));
  }
  
  return results;
}

/**
 * Groups GBFS systems by city (location).
 * @param systems An array of GBFSSystem objects.
 * @returns An array of CitySystemGroup objects.
 */
export function groupSystemsByCity(systems: GBFSSystem[]): CitySystemGroup[] {
  if (!systems || systems.length === 0) {
    return [];
  }

  const cityMap: Map<string, CitySystemGroup> = new Map();

  systems.forEach(system => {
    const cityKey = system.location.toLowerCase();
    let group = cityMap.get(cityKey);

    if (!group) {
      group = {
        city: system.location,
        countryCode: system.countryCode,
        operators: [],
        systemIds: []
      };
      cityMap.set(cityKey, group);
    }
    group.operators.push(system);
    group.systemIds.push(system.systemId);
  });

  return Array.from(cityMap.values());
}
