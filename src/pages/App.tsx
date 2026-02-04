import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MapPin, Users, Clock, AlertCircle, Loader2 } from 'lucide-react';
import brain from 'brain';
import { classifyOperatorType } from 'utils/gbfsClassification';
import { fetchAndParseGBFSData, searchSystems, GBFSSystem, groupSystemsByCity, CitySystemGroup, clearSystemsCache } from "../utils/gbfsUtils";
import { useDebouncedCallback } from "../utils/useDebounce";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCountryFlagEmoji } from "utils/countryUtils";
import OperatorCard, { OperatorDisplayData } from "components/OperatorCard";
import SkeletonOperatorCard from "components/SkeletonOperatorCard";
import { GetGbfsFeedsDataData, GBFSFeed } from "brain/data-contracts";

// Helper to fetch and parse a GBFS feed via proxy, centralizing error handling
async function fetchAndParseGbfsFeed(feedUrl: string, proxyEndpoint: 'proxy_gbfs_url' | 'proxy_gbfs_url_post' = 'proxy_gbfs_url', ttl?: number): Promise<{ data: any; last_updated: any; ttl: number; }> {
  const response = await brain.proxy_gbfs_url({ target_url: feedUrl });
  if (response.status !== 200) {
    const errorText = await response.text();
    throw new Error(`Proxy fetch failed with status ${response.status}: ${errorText.substring(0, 150)}`);
  }
  const parsed = await response.json();
  return {
    data: parsed.data,
    last_updated: parsed.last_updated,
    ttl: parsed.ttl,
  };
}

// NEW: Concurrently fetch multiple feeds using the v2 endpoint
async function fetchAllGbfsFeedsConcurrently(feeds: GBFSFeed[]): Promise<GetGbfsFeedsDataData> {
  try {
    const response = await brain.get_gbfs_feeds_data({ feeds });
    if (response.status !== 200) {
      const errorText = await response.text();
      throw new Error(`Concurrent feed fetch failed with status ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in fetchAllGbfsFeedsConcurrently:", error);
    // Return a structure that matches the expected output, with errors indicated
    return feeds.map(feed => ({
      feed_name: feed.name,
      data: null,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }));
  }
}


// REWRITTEN resilient parser function based on correct data specification
const discoverFeeds = (rawGbfsJson: any, initialOperatorName: string): { discoveredFeedUrls: Record<string, string>; nameFromGbfsJson: string } => {
    let discoveredFeedUrls: Record<string, string> = {};
    let nameFromGbfsJson = initialOperatorName;

    // The rawGbfsJson might come from our v2 endpoint with an extra 'data' wrapper
    // Handle both direct GBFS content and wrapped content
    let gbfsContent = rawGbfsJson;
    if (rawGbfsJson.data && !rawGbfsJson.feeds) {
        gbfsContent = rawGbfsJson.data;
    }

    // 1. Primary Logic: Multi-Language Check
    // Check for language keys like 'en', 'nb', etc., at the root.
    const langPriority = ['en', 'nb']; 
    const allLangKeys = [...new Set([...langPriority, ...Object.keys(gbfsContent)])];

    for (const lang of allLangKeys) {
        const langData = gbfsContent[lang];
        if (langData && typeof langData === 'object' && langData.feeds && Array.isArray(langData.feeds)) {
            langData.feeds.forEach((feed: any) => {
                if (feed && typeof feed.name === 'string' && typeof feed.url === 'string') {
                    discoveredFeedUrls[feed.name] = feed.url;
                }
            });
            nameFromGbfsJson = langData.name || nameFromGbfsJson;
            if (Object.keys(discoveredFeedUrls).length > 0) {
                return { discoveredFeedUrls, nameFromGbfsJson };
            }
        }
    }

    // 2. Fallback Logic: Root-Level Feeds Check
    // If no language-specific feeds were found, check for a `feeds` array at the root level.
    if (gbfsContent.feeds && Array.isArray(gbfsContent.feeds)) {
        gbfsContent.feeds.forEach((feed: any) => {
            if (feed && typeof feed.name === 'string' && typeof feed.url === 'string') {
                discoveredFeedUrls[feed.name] = feed.url;
            }
        });
        nameFromGbfsJson = gbfsContent.name || nameFromGbfsJson;
         if (Object.keys(discoveredFeedUrls).length > 0) {
             return { discoveredFeedUrls, nameFromGbfsJson };
        }
    }
    
    return { discoveredFeedUrls, nameFromGbfsJson };
};


// Updated to handle both vehicle_status and free_bike_status with better checks
const countFreeFloatingVehicles = (parsedFeed: { data: any }, primaryFormFactor: string | null, operatorName: string): { total: number; available: number } | null => {
  if (!parsedFeed || !parsedFeed.data) return null;

  let vehicles: any[] = [];
  
  if (parsedFeed.data.vehicles && Array.isArray(parsedFeed.data.vehicles)) {
    vehicles = parsedFeed.data.vehicles;
  } else if (parsedFeed.data.bikes && Array.isArray(parsedFeed.data.bikes)) {
    vehicles = parsedFeed.data.bikes;
  } else {
    console.warn(`countFreeFloatingVehicles (${operatorName}): Neither .data.vehicles nor .data.bikes is a valid array.`);
    return null;
  }
  
  // Count total vehicles
  const totalVehicles = vehicles.length;
  
  // Count only available vehicles (not disabled or reserved)
  const availableVehicles = vehicles.filter(v => v.is_disabled === false && v.is_reserved === false);
  
  return {
    total: totalVehicles,
    available: availableVehicles.length
  };
};


// Updated to be more robust, especially for different GBFS versions
const parseStationStatusFeed = (parsedFeed: { data: any }, operatorName: string): { bikesAvailable: number; bikesTotal: number; docksAvailable: number; stationCount: number; error: string | null } | null => {
  if (!parsedFeed || !parsedFeed.data || !Array.isArray(parsedFeed.data.stations)) {
    console.warn(`parseStationStatusFeed (${operatorName}): Invalid or missing stations array.`);
    return null;
  }

  let totalBikesAvailable = 0;
  let totalBikesTotal = 0;
  let totalDocksAvailable = 0;
  const stationIds = new Set<string>();

  parsedFeed.data.stations.forEach((station: any) => {
    stationIds.add(station.station_id);

    // Sum up available bikes, checking multiple common properties
    let bikesAtStation = 0;
    if (station.vehicle_types_available && Array.isArray(station.vehicle_types_available)) {
      bikesAtStation = station.vehicle_types_available.reduce((sum: number, vt: any) => sum + (vt.count || 0), 0);
    } else {
      // Check for regular bikes
      if (typeof station.num_bikes_available === 'number') {
        bikesAtStation += station.num_bikes_available;
      } else if (typeof station.num_vehicles_available === 'number') {
        bikesAtStation += station.num_vehicles_available;
      }
      
      // Also check for e-bikes (many operators like Capital Bikeshare have separate counts)
      if (typeof station.num_ebikes_available === 'number') {
        bikesAtStation += station.num_ebikes_available;
      }
    }
    totalBikesAvailable += bikesAtStation;

    // Calculate total bikes at station (available + disabled)
    let totalBikesAtStation = bikesAtStation;
    
    // Add disabled bikes if available
    if (typeof station.num_bikes_disabled === 'number') {
      totalBikesAtStation += station.num_bikes_disabled;
    }
    if (typeof station.num_vehicles_disabled === 'number') {
      totalBikesAtStation += station.num_vehicles_disabled;
    }
    
    totalBikesTotal += totalBikesAtStation;

    // Sum up available docks
    if (typeof station.num_docks_available === 'number') {
      totalDocksAvailable += station.num_docks_available;
    }
  });
  
  return {
    bikesAvailable: totalBikesAvailable,
    bikesTotal: totalBikesTotal,
    docksAvailable: totalDocksAvailable,
    stationCount: stationIds.size,
    error: null,
  };
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [allSystems, setAllSystems] = useState<GBFSSystem[]>([]);
  const [suggestions, setSuggestions] = useState<CitySystemGroup[]>([]); // Changed to CitySystemGroup[]
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // --- New state for inline results rendering based on ?city ---
  const [activeCityGroup, setActiveCityGroup] = useState<CitySystemGroup | null>(null);
  const [isLoadingCityResults, setIsLoadingCityResults] = useState<boolean>(false);
  const [operatorDisplayData, setOperatorDisplayData] = useState<Record<string, OperatorDisplayData>>({});


  const DEBOUNCE_DELAY = 300; // 300ms debounce

  // Calculate total vehicle count from all loaded operators
  const totalVehicleCount = useMemo(() => {
    if (!activeCityGroup || !operatorDisplayData) return null;
    
    let total = 0;
    let hasValidData = false;
    
    activeCityGroup.operators.forEach(operator => {
      const data = operatorDisplayData[operator.systemId];
      if (data && 
          !data.isLoadingDiscovery && 
          !data.isLoadingSpecificFeed && 
          !data.discoveryError && 
          !data.feedError && 
          data.totalVehicleCount !== null && 
          data.totalVehicleCount !== undefined) {
        total += data.totalVehicleCount;
        hasValidData = true;
      }
    });
    
    return hasValidData ? total : null;
  }, [activeCityGroup, operatorDisplayData]);

  // Helper function to format numbers with spaces
  const formatNumberWithSpaces = (num: number | null): string => {
    if (num === null || num === undefined) return "";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  // Callback for debounced search
  const debouncedSearch = useDebouncedCallback((query: string, systems: GBFSSystem[]) => {
    if (query.length > 1) { // Start searching after 2 characters
      const filteredSystems = searchSystems(systems, query);
      const groupedByCity = groupSystemsByCity(filteredSystems);
      setSuggestions(groupedByCity);
      if (groupedByCity.length > 0) {
        setActiveIndex(0); // Select the first suggestion
      } else {
        setActiveIndex(-1); // No suggestions, so no active index
      }
      // We no longer manage dropdown visibility here; it's done in handleInputChange and onFocus
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, DEBOUNCE_DELAY);

  // Load all systems on component mount
  useEffect(() => {
    const loadSystems = async () => {
      try {
        // Clear cache to ensure we get fresh data from official CSV
        clearSystemsCache();
        
        const systems = await fetchAndParseGBFSData();
        setAllSystems(systems);
      } catch (error) {
        console.error('Failed to load GBFS systems:', error);
      }
    };
    loadSystems();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery, allSystems);
  }, [searchQuery, allSystems]);

  // Handle clicks outside the search input and dropdown to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Parse URL params ---
  const location = useLocation();

  // Embed mode: hide title/subtitle when ?embed=true
  const isEmbedMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("embed") === "true";
  }, [location.search]);

  // --- Parse ?city from URL and resolve results inline ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cityParam = params.get("city");

    if (!cityParam) {
      // No city provided, clear any previous inline results
      setActiveCityGroup(null);
      setOperatorDisplayData({});
      return;
    }

    // Ensure systems are loaded before resolving
    if (!allSystems || allSystems.length === 0) {
      // Will retry when allSystems updates
      return;
    }

    setIsLoadingCityResults(true);
    try {
      // Find an exact city match (case-insensitive)
      const grouped = groupSystemsByCity(allSystems);
      const match = grouped.find(g => g.city.toLowerCase() === cityParam.toLowerCase());

      if (match) {
        setActiveCityGroup(match);
        // Optionally update input for user clarity
        setSearchQuery(match.city);
        // Initialize display data for the operators in this group
        const initialData: Record<string, OperatorDisplayData> = {};
        match.operators.forEach(op => {
          initialData[op.systemId] = {
            operatorInfo: op,
            operatorType: 'unknown',
            isLoadingDiscovery: true,
            discoveryError: null,
            isLoadingSpecificFeed: false,
            feedError: null,
            vehicleCount: null,
            stationCount: null,
          } as OperatorDisplayData;
        });
        setOperatorDisplayData(initialData);

      } else {
        setActiveCityGroup(null);
        setOperatorDisplayData({});
      }
    } finally {
      setIsLoadingCityResults(false);
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    }
  }, [location.search, allSystems]);


  // REFACTORED EFFECT TO FETCH OPERATOR DETAILS
  useEffect(() => {
    if (!activeCityGroup) return;

    const processOperatorsInBulk = async (operators: GBFSSystem[]) => {
      // --- PHASE 1: DISCOVERY (gbfs.json) for all operators ---
      const discoveryFeedsToFetch: GBFSFeed[] = operators.map(op => ({
        name: op.systemId, // Use systemId as the unique identifier
        url: op.autoDiscoveryUrl || op.url,
      }));

      const discoveryResults = await fetchAllGbfsFeedsConcurrently(discoveryFeedsToFetch);

      const operatorDataMap: Record<string, Partial<OperatorDisplayData>> = {};
      const allOptionalFeedsToFetch: GBFSFeed[] = [];
      const allStatusFeedsToFetch: GBFSFeed[] = [];

      // --- Process Discovery Results ---
      discoveryResults.forEach(result => {
        const operator = operators.find(op => op.systemId === result.feed_name);
        if (!operator) return;

        let data: Partial<OperatorDisplayData> = { operatorInfo: operator, isLoadingDiscovery: false };

        if (result.error || !result.data) {
          data.discoveryError = result.error || "Failed to fetch or parse gbfs.json.";
        } else {
          // The v2 endpoint's `data` field IS the raw GBFS JSON.
          const rawGbfsJson = result.data; 
          data.gbfsDiscoveryRaw = rawGbfsJson;
          
          // The discoverFeeds function now gets the correct raw JSON.
          const { discoveredFeedUrls, nameFromGbfsJson } = discoverFeeds(rawGbfsJson, operator.name);
          data.operatorNameFromDiscovery = nameFromGbfsJson;
          data.feedsFromDiscovery = discoveredFeedUrls;

          if (Object.keys(discoveredFeedUrls).length === 0) {
            data.discoveryError = "Discovery failed: No valid feeds found in gbfs.json.";
            data.operatorType = 'unknown';
          } else {
            // --- PHASE 2: DETERMINISTIC CLASSIFICATION ---
            // Immediately classify based on available endpoints (no data parsing needed)
            data.operatorType = classifyOperatorType(
              discoveredFeedUrls, 
              data.operatorNameFromDiscovery || operator.name
            );
            
            // STEP 1: Queue optional feeds for fetching
            if (discoveredFeedUrls["system_information"]) {
              allOptionalFeedsToFetch.push({ name: `${operator.systemId}::system_information`, url: discoveredFeedUrls["system_information"] });
            }
            if (discoveredFeedUrls["vehicle_types"]) {
              allOptionalFeedsToFetch.push({ name: `${operator.systemId}::vehicle_types`, url: discoveredFeedUrls["vehicle_types"] });
            }
            
            // STEP 2: Queue status feeds based on operator type for vehicle counts
            if (data.operatorType === 'station_based' && discoveredFeedUrls["station_status"]) {
              allStatusFeedsToFetch.push({ name: `${operator.systemId}::station_status`, url: discoveredFeedUrls["station_status"] });
            } else if (data.operatorType === 'free_floating') {
              // Queue the appropriate vehicle feed (cross-version compatible)
              if (discoveredFeedUrls["vehicle_status"]) {
                allStatusFeedsToFetch.push({ name: `${operator.systemId}::vehicle_status`, url: discoveredFeedUrls["vehicle_status"] });
              } else if (discoveredFeedUrls["free_bike_status"]) {
                allStatusFeedsToFetch.push({ name: `${operator.systemId}::free_bike_status`, url: discoveredFeedUrls["free_bike_status"] });
              }
            }
          }
        }
        operatorDataMap[operator.systemId] = data;
      });
      
      // --- PHASE 2: CONCURRENTLY FETCH ALL OPTIONAL FEEDS ---
      const optionalFeedResults = await fetchAllGbfsFeedsConcurrently(allOptionalFeedsToFetch);

      // --- PHASE 3: PROCESS OPTIONAL FEEDS AND DETERMINE FINAL OPERATOR TYPE ---
      optionalFeedResults.forEach(result => {
          const [systemId, feedType] = result.feed_name.split('::');
          const data = operatorDataMap[systemId];
          if (!data || result.error || !result.data) return;
          
          // Handle the nested data structure from v2 endpoint
          const feedContent = result.data.data || result.data;

          if (feedType === 'system_information') {
              data.operatorUrlFromSystemInfo = feedContent.url || feedContent.operator_url || null;
              data.operatorEmailFromSystemInfo = feedContent.email || null;
          } else if (feedType === 'vehicle_types') {
              data.vehicleTypesRaw = feedContent;
              const vehicleTypes = feedContent.vehicle_types;
              if (Array.isArray(vehicleTypes)) {
                  const formFactors = vehicleTypes.map(vt => vt.form_factor).filter(Boolean);
                  if (formFactors.some(ff => ff.includes("scooter"))) data.primaryFormFactor = "scooter";
                  else if (formFactors.some(ff => ff.includes("bicycle"))) data.primaryFormFactor = "bicycle";
              }
          }
      });
      
      // --- RE-CLASSIFY OPERATORS BASED ON VEHICLE TYPES ---
      // Now that we have vehicle_types data, re-classify scooter systems as free_floating
      Object.values(operatorDataMap).forEach(data => {
        if (data.operatorType && data.feedsFromDiscovery && data.vehicleTypesRaw) {
          // Re-classify using vehicle_types data for scooter override
          const newOperatorType = classifyOperatorType(
            data.feedsFromDiscovery, 
            data.operatorNameFromDiscovery || data.operatorInfo?.name || 'Unknown',
            data.vehicleTypesRaw
          );
          
          // If classification changed, update it and adjust status feed queuing
          if (newOperatorType !== data.operatorType) {
            console.log(`Re-classification: ${data.operatorInfo?.name} changed from ${data.operatorType} to ${newOperatorType}`);
            data.operatorType = newOperatorType;
            
            // Update status feed queuing based on new classification
            const systemId = data.operatorInfo?.systemId;
            if (systemId && data.feedsFromDiscovery) {
              // Remove old status feeds for this operator
              const oldFeedIndex = allStatusFeedsToFetch.findIndex(feed => feed.name.startsWith(`${systemId}::`));
              if (oldFeedIndex >= 0) {
                allStatusFeedsToFetch.splice(oldFeedIndex, 1);
              }
              
              // Add correct status feed based on new classification
              if (newOperatorType === 'station_based' && data.feedsFromDiscovery["station_status"]) {
                allStatusFeedsToFetch.push({ name: `${systemId}::station_status`, url: data.feedsFromDiscovery["station_status"] });
              } else if (newOperatorType === 'free_floating') {
                if (data.feedsFromDiscovery["vehicle_status"]) {
                  allStatusFeedsToFetch.push({ name: `${systemId}::vehicle_status`, url: data.feedsFromDiscovery["vehicle_status"] });
                } else if (data.feedsFromDiscovery["free_bike_status"]) {
                  allStatusFeedsToFetch.push({ name: `${systemId}::free_bike_status`, url: data.feedsFromDiscovery["free_bike_status"] });
                }
              }
            }
          }
        }
      });
      
      // --- PHASE 4: FETCH and PROCESS STATUS FEEDS ---
      const statusFeedResults = await fetchAllGbfsFeedsConcurrently(allStatusFeedsToFetch);

      statusFeedResults.forEach(result => {
          const [systemId, feedType] = result.feed_name.split('::');
          const data = operatorDataMap[systemId];
          if (!data) return;

          if (result.error || !result.data) {
              data.feedError = result.error || "Failed to fetch status feed.";
          } else {
              // THIS IS THE CRITICAL FIX:
              // Re-create the exact object structure the V1 parsers expect.
              const parsedFeed = { 
                data: result.data.data || result.data, // Handle both structures
                last_updated: result.data.last_updated, // Extract from content
                ttl: result.data.ttl // Extract from content
              };
              
              if (feedType === 'station_status') {
                  const stationData = parseStationStatusFeed(parsedFeed, data.operatorNameFromDiscovery || '');
                  data.totalVehicleCount = stationData?.bikesTotal ?? null;
                  data.vehicleCount = stationData?.bikesAvailable ?? null;
                  data.stationCount = stationData?.stationCount ?? null;
                  data.docksAvailableAtStations = stationData?.docksAvailable ?? null;
                  if (stationData?.error) data.feedError = stationData.error;
              } else if (feedType === 'vehicle_status' || feedType === 'free_bike_status') {
                  const vehicleData = countFreeFloatingVehicles(parsedFeed, data.primaryFormFactor, data.operatorNameFromDiscovery || '');
                  data.totalVehicleCount = vehicleData?.total ?? null;
                  data.vehicleCount = vehicleData?.available ?? null;
              }
              data.feedLastUpdated = parsedFeed.last_updated;
              data.feedTtl = parsedFeed.ttl;
          }
      });

      // --- Final Update to State ---
      setOperatorDisplayData(prev => {
        const newState = { ...prev };
        Object.keys(operatorDataMap).forEach(systemId => {
          newState[systemId] = {
            ...prev[systemId],
            ...operatorDataMap[systemId],
            isLoadingDiscovery: false,
            isLoadingSpecificFeed: false,
          } as OperatorDisplayData;
        });
        return newState;
      });
    };

    const fetchAllOperatorData = async () => {
        if (!activeCityGroup?.operators) return;
        
        // Set initial loading state
        setOperatorDisplayData(prev => {
            const newState = { ...prev };
            activeCityGroup.operators.forEach(op => {
                newState[op.systemId] = {
                    ...(prev[op.systemId] || {}),
                    operatorInfo: op,
                    isLoadingDiscovery: true,
                } as OperatorDisplayData;
            });
            return newState;
        });
        
        await processOperatorsInBulk(activeCityGroup.operators);
    };

    fetchAllOperatorData();
  }, [activeCityGroup]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    // Only open the dropdown if the user is typing and there's a query
    if (query.length > 1) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const navigate = useNavigate(); // Added for navigation

  // Helper to build URL preserving embed param
  const buildUrl = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams();
    if (isEmbedMode) searchParams.set("embed", "true");
    Object.entries(params).forEach(([key, value]) => searchParams.set(key, value));
    return `/?${searchParams.toString()}`;
  };

  const handleSuggestionClick = (cityGroup: CitySystemGroup) => {
    // Update input to just the city name for a cleaner display
    setSearchQuery(cityGroup.city);
    // Clear the suggestions list immediately
    setSuggestions([]);
    // Explicitly close the dropdown
    setIsDropdownOpen(false);
    // Navigate to the city-specific view (preserving embed param)
    navigate(buildUrl({ city: cityGroup.city }));
  };

  const handleSearchClick = () => {
    // This function would be triggered when the main "Search" button is clicked
    // or when Enter is pressed without a specific item highlighted but suggestions are present.
    if (activeIndex >= 0 && suggestions.length > 0 && activeIndex < suggestions.length) {
        // If a suggestion is actively highlighted, use it
        handleSuggestionClick(suggestions[activeIndex]);
    } else if (searchQuery.trim() !== "") {
        // Fallback: derive a city value from the input and push root URL with ?city
        // If input is like "Oslo (NO)", strip the country part
        const raw = searchQuery.trim();
        const cityOnly = raw.includes("(") ? raw.split("(")[0].trim() : raw;
        if (cityOnly) {
          navigate(buildUrl({ city: cityOnly }));
        }
    }
    setIsDropdownOpen(false);
  };

  const handleTitleClick = () => {
    navigate(isEmbedMode ? "/?embed=true" : "/");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(prevIndex => (prevIndex + 1) % suggestions.length);
        scrollToActive();
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prevIndex => (prevIndex - 1 + suggestions.length) % suggestions.length);
        scrollToActive();
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSuggestionClick(suggestions[activeIndex]);
        } else if (suggestions.length > 0) {
          // If suggestions are visible but none specifically selected via arrows,
          // treat Enter as selecting the first one (which should be activeIndex = 0 by default now)
          handleSuggestionClick(suggestions[0]); 
        } else {
          // If no suggestions are visible, then allow the search button's logic to handle it
          // (which might involve a direct search or alert if the query is new)
          handleSearchClick();
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsDropdownOpen(false);
        setActiveIndex(-1);
        break;
    }
  };
  
  const scrollToActive = () => {
    if (dropdownRef.current && activeIndex >=0) {
      const activeItem = dropdownRef.current.children[activeIndex] as HTMLLIElement;
      if (activeItem) {
        dropdownRef.current.scrollTop = activeItem.offsetTop - dropdownRef.current.offsetTop;
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <main className={`flex-grow w-full max-w-4xl px-4 ${isEmbedMode ? 'pt-4 pb-4' : 'pt-8 pb-12'} text-center mx-auto`}>
        {!isEmbedMode && (
          <>
            <h1
              className="text-5xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={handleTitleClick}
            >
              GBFS Explorer
            </h1>
            <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
              Search and explore bikes, scooters, and other micromobility in cities worldwide with real-time GBFS data.
            </p>
          </>
        )}

        <Card className={`relative w-full max-w-2xl mx-auto ${isEmbedMode ? 'mt-0 mb-6' : 'mt-10 mb-12'} bg-card rounded-xl shadow-md border border-border`}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search for a city..."
                      value={searchQuery}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="w-full pl-12 pr-4 py-3 h-16 text-lg bg-transparent border-none focus:ring-0 focus:outline-none"
                      onFocus={() => {
                        // Only reopen dropdown on focus if there's already text and suggestions
                        if (searchQuery.length > 1 && suggestions.length > 0) {
                          setIsDropdownOpen(true);
                        }
                      }}
                    />
                </div>
                <Button onClick={handleSearchClick} disabled={isLoading} size="lg" className="h-14 px-8 text-base rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>

              {isDropdownOpen && (
                <Card className="absolute z-10 w-full mt-1 border rounded-md shadow-lg left-0">
                  <CardContent className="p-0">
                    <ul ref={dropdownRef} className="max-h-60 overflow-y-auto text-left">
                      {suggestions.length > 0 ? (
                        suggestions.map((group, index) => (
                          <li
                            key={group.city}
                            onClick={() => handleSuggestionClick(group)}
                            className={`px-4 py-3 cursor-pointer hover:bg-accent flex items-center justify-between ${activeIndex === index ? 'bg-accent' : ''}`}
                          >
                            <div>
                               <span className="font-semibold">{group.city}</span>
                               <span className="text-sm text-muted-foreground ml-2">({group.operators.length} operator{group.operators.length > 1 ? 's' : ''})</span>
                            </div>
                            <span className="text-xl">{getCountryFlagEmoji(group.countryCode)}</span>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-3 text-center text-muted-foreground">
                          No available GBFS feeds (yet)...
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </CardContent>
        </Card>

        {/* Inline Results Display Section */}
        {isLoadingCityResults && (
            <div className="flex justify-center items-center mt-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-4 text-lg text-muted-foreground">Loading operators for {searchQuery}...</span>
            </div>
        )}

        {activeCityGroup && (
          <div className="mt-8 text-left">
            <h2 className="text-2xl font-bold mb-4">
              Mobility operators in {activeCityGroup.city} {getCountryFlagEmoji(activeCityGroup.countryCode)}
              {(() => {
                // Check if any operators are still loading
                const isAnyOperatorLoading = activeCityGroup.operators.some(operator => {
                  const data = operatorDisplayData[operator.systemId];
                  return data && (data.isLoadingDiscovery || data.isLoadingSpecificFeed);
                });

                if (isAnyOperatorLoading) {
                  return (
                    <span className="text-lg font-normal text-muted-foreground ml-2 inline-flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Getting live data from operators...
                    </span>
                  );
                }

                if (totalVehicleCount !== null) {
                  return (
                    <span className="text-lg font-normal text-muted-foreground ml-2">
                      {formatNumberWithSpaces(totalVehicleCount)} vehicles in total
                    </span>
                  );
                }

                return null;
              })()}
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                // Check if any operators are still loading
                const isAnyOperatorLoading = activeCityGroup.operators.some(operator => {
                  const data = operatorDisplayData[operator.systemId];
                  return data && (data.isLoadingDiscovery || data.isLoadingSpecificFeed);
                });

                // Show skeleton cards while operators are loading
                if (isAnyOperatorLoading) {
                  return activeCityGroup.operators.map((operator, index) => (
                    <SkeletonOperatorCard key={`skeleton-${operator.systemId}-${index}`} />
                  ));
                }

                // Show sorted operator cards once all loading is complete
                return activeCityGroup.operators
                  // Filter operators that have display data
                  .filter(op => operatorDisplayData[op.systemId])
                  // Sort by total fleet size (largest first)
                  .sort((a, b) => {
                    const dataA = operatorDisplayData[a.systemId];
                    const dataB = operatorDisplayData[b.systemId];
                    
                    // Handle null/undefined values - put them at the end
                    if (dataA.totalVehicleCount === null || dataA.totalVehicleCount === undefined) {
                      if (dataB.totalVehicleCount === null || dataB.totalVehicleCount === undefined) {
                        return 0; // Both null, maintain original order
                      }
                      return 1; // A is null, B comes first
                    }
                    if (dataB.totalVehicleCount === null || dataB.totalVehicleCount === undefined) {
                      return -1; // B is null, A comes first
                    }
                    
                    // Sort by total fleet size (descending - largest first)
                    return dataB.totalVehicleCount - dataA.totalVehicleCount;
                  })
                  .map((op) => (
                    <OperatorCard
                      key={op.systemId}
                      operatorData={operatorDisplayData[op.systemId]}
                    />
                  ));
              })()}
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
