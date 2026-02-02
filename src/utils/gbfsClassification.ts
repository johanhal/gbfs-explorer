

/**
 * GBFS cross-version compliant operator classification utility
 * 
 * Determines operator type (station-based vs free-floating) based on available
 * endpoints in gbfs.json discovery file, following GBFS 2.x through 3.1+ specifications.
 */

export type OperatorType = 'station_based' | 'free_floating' | 'unknown';

/**
 * Feed names for station-based systems (required together)
 */
const STATION_FEED_NAMES = [
  'station_information',
  'station_status'
];

/**
 * Feed names for free-floating/dockless systems across GBFS versions
 */
const VEHICLE_FEED_NAMES = [
  'vehicle_status',     // GBFS 3.0+ (preferred)
  'free_bike_status'    // GBFS 2.x (legacy)
];

/**
 * Deterministically classify operator type based on available GBFS feeds.
 * 
 * Classification logic per GBFS specification:
 * 1. Station-based: Both station_information AND station_status present
 * 2. Free-floating: vehicle_status (3.0+) OR free_bike_status (2.x) present
 * 3. Scooter Override: If vehicle_types shows scooters, always classify as free_floating
 * 4. Hybrid: If both station and vehicle feeds exist, prefer station_based (for bikes)
 * 5. Unknown: Neither valid combination available
 * 
 * @param feedsFromDiscovery - Object mapping feed names to URLs from gbfs.json
 * @param operatorName - Operator name for logging purposes
 * @param vehicleTypesData - Optional vehicle_types.json data for scooter override
 * @returns Determined operator type
 */
export function classifyOperatorType(
  feedsFromDiscovery: Record<string, string>,
  operatorName: string = 'Unknown',
  vehicleTypesData?: any
): OperatorType {
  if (!feedsFromDiscovery || Object.keys(feedsFromDiscovery).length === 0) {
    console.warn(`classifyOperatorType (${operatorName}): No feeds available for classification`);
    return 'unknown';
  }

  const availableFeeds = Object.keys(feedsFromDiscovery);
  
  // SCOOTER OVERRIDE: Check vehicle_types for scooters first
  if (vehicleTypesData && vehicleTypesData.vehicle_types) {
    const vehicleTypes = vehicleTypesData.vehicle_types;
    if (Array.isArray(vehicleTypes)) {
      const hasScooters = vehicleTypes.some(vt => 
        vt.form_factor && vt.form_factor.includes('scooter')
      );
      
      if (hasScooters) {
        console.log(`classifyOperatorType (${operatorName}): Scooter system detected - forcing free_floating classification`);
        return 'free_floating';
      }
    }
  }
  
  // Check for station-based system
  const hasStationFeeds = STATION_FEED_NAMES.every(feedName => 
    availableFeeds.includes(feedName)
  );
  
  // Check for free-floating system (cross-version compatible)
  const hasVehicleFeeds = VEHICLE_FEED_NAMES.some(feedName => 
    availableFeeds.includes(feedName)
  );
  
  // Classification logic - "prefer stations" policy (for non-scooter systems)
  if (hasStationFeeds) {
    // POLICY: If station feeds exist, classify as station-based (unless overridden by scooters above)
    console.log(`classifyOperatorType (${operatorName}): Station-based system detected`);
    return 'station_based';
  } else if (hasVehicleFeeds) {
    // Only classify as free-floating if no station feeds exist
    const vehicleFeedType = VEHICLE_FEED_NAMES.find(feedName => 
      availableFeeds.includes(feedName)
    );
    console.log(`classifyOperatorType (${operatorName}): Free-floating system detected using ${vehicleFeedType}`);
    return 'free_floating';
  } else {
    // No valid classification possible
    console.warn(`classifyOperatorType (${operatorName}): Unable to classify - missing required feeds. Available: ${availableFeeds.join(', ')}`);
    return 'unknown';
  }
}

/**
 * Get the appropriate vehicle feed name for the operator's GBFS version.
 * Returns the first available vehicle feed name, preferring vehicle_status (3.0+) over free_bike_status (2.x).
 * 
 * @param feedsFromDiscovery - Object mapping feed names to URLs from gbfs.json
 * @returns Vehicle feed name if available, null otherwise
 */
export function getVehicleFeedName(feedsFromDiscovery: Record<string, string>): string | null {
  for (const feedName of VEHICLE_FEED_NAMES) {
    if (feedsFromDiscovery[feedName]) {
      return feedName;
    }
  }
  return null;
}

/**
 * Check if operator has both station and vehicle feeds (hybrid system).
 * 
 * @param feedsFromDiscovery - Object mapping feed names to URLs from gbfs.json
 * @returns True if operator publishes both station and vehicle feeds
 */
export function isHybridSystem(feedsFromDiscovery: Record<string, string>): boolean {
  const hasStationFeeds = STATION_FEED_NAMES.every(feedName => 
    feedsFromDiscovery[feedName]
  );
  const hasVehicleFeeds = VEHICLE_FEED_NAMES.some(feedName => 
    feedsFromDiscovery[feedName]
  );
  return hasStationFeeds && hasVehicleFeeds;
}

/**
 * Get human-readable description of the classification result.
 * 
 * @param operatorType - The classified operator type
 * @param feedsFromDiscovery - Object mapping feed names to URLs from gbfs.json
 * @returns Human-readable classification description
 */
export function getClassificationDescription(
  operatorType: OperatorType, 
  feedsFromDiscovery: Record<string, string>
): string {
  switch (operatorType) {
    case 'station_based':
      if (isHybridSystem(feedsFromDiscovery)) {
        return 'Station-based with dockless vehicles (hybrid)';
      }
      return 'Station-based (docked bikes)';
    case 'free_floating':
      const vehicleFeed = getVehicleFeedName(feedsFromDiscovery);
      const gbfsVersion = vehicleFeed === 'vehicle_status' ? '3.0+' : '2.x';
      return `Free-floating (dockless, GBFS ${gbfsVersion})`;
    case 'unknown':
      return 'Unknown system type';
    default:
      return 'Unclassified';
  }
}
