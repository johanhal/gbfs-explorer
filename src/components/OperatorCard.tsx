

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, ExternalLink, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import brain from "brain";
import { GetOperatorMapPointsWithFeedsData } from "types";
import { createFriendlyError, getErrorColor, getErrorSuggestion } from "utils/errorUtils";
import OperatorMap from 'components/OperatorMap';
import StatusIndicator from 'components/StatusIndicator';
import { GBFSSystem } from 'utils/gbfsUtils';

// This robust function can handle UNIX timestamps (in seconds), ISO 8601 strings, or pre-formatted numbers.
function formatTimestamp(timestamp: string | number | null | undefined): string {
  if (timestamp === null || timestamp === undefined) return "N/A";

  let date: Date;

  // Check if it's a numeric value (could be seconds, milliseconds, or a numeric string)
  if (typeof timestamp === 'number' || (typeof timestamp === 'string' && /^\d+$/.test(timestamp))) {
    const numTimestamp = Number(timestamp);
    // If the number is less than 1 Jan 2000 in seconds, it's likely a UNIX timestamp in seconds.
    // Otherwise, assume it's already in milliseconds.
    if (numTimestamp < 946684800000 && numTimestamp > 10000000) {
      date = new Date(numTimestamp * 1000);
    } else {
      date = new Date(numTimestamp);
    }
  } else if (typeof timestamp === 'string') {
    // If it's a string, try parsing it directly. This handles ISO 8601, etc.
    date = new Date(timestamp);
  } else {
    return "N/A";
  }

  // Check if the created date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Use 24-hour format for clarity
  });
}

// Add English short-month formatter for "Last updated" display
const formatLastUpdated = (timestamp: string | number | null | undefined): string => {
  if (timestamp === null || timestamp === undefined) return "Last updated: N/A";

  let date: Date;
  if (typeof timestamp === "number" || (typeof timestamp === "string" && /^\d+$/.test(timestamp))) {
    const num = Number(timestamp);
    date = num < 946684800000 && num > 10000000 ? new Date(num * 1000) : new Date(num);
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else {
    return "Last updated: N/A";
  }

  if (isNaN(date.getTime())) return "Last updated: Invalid Date";

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `Last updated: ${day} ${month} ${year}, ${hours}:${minutes}`;
};

const formatNumberWithSpaces = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "N/A";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export interface OperatorDisplayData {
  // From initial operator data
  operatorInfo?: GBFSSystem;
  operatorType: "station_based" | "free_floating" | "unknown" | "station_based_bicycle" | "free_floating_bicycle" | "free_floating_scooter"; // Expanded types
  primaryFormFactor?: "bicycle" | "scooter" | "other" | null; // Store determined form factor

  // For gbfs.json discovery phase
  isLoadingDiscovery: boolean;
  discoveryError: string | null;
  operatorNameFromDiscovery?: string; // Name found in gbfs.json
  feedsFromDiscovery?: Record<string, string>; // Feeds listed in gbfs.json
  discoveryTtl: number | null; // TTL from gbfs.json in seconds
  gbfsDiscoveryRaw?: any; // Raw gbfs.json response
  vehicleTypesRaw?: any; // For storing vehicle_types.json raw data, if fetched

  // For system_information.json data
  isLoadingSystemInfo?: boolean;
  systemInfoError?: string | null;
  operatorUrlFromSystemInfo?: string | null;
  operatorEmailFromSystemInfo?: string | null;

  // For specific feed fetching phase (e.g., station_status, free_bike_status)
  isLoadingSpecificFeed: boolean;
  feedError: string | null;
  totalVehicleCount: number | null; // Total deployed vehicles (available + disabled)
  vehicleCount: number | null; // Available vehicles only
  stationCount: number | null;
  // Individual vehicle counts if available from specific feeds and relevant
  bikesAvailableAtStations?: number | null; 
  docksAvailableAtStations?: number | null;
}

interface Props {
  operatorData: OperatorDisplayData;
}

const OperatorCard: React.FC<Props> = ({ operatorData }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Prevent rendering if data is not yet available
  if (!operatorData) {
    return null;
  }

  const {
    operatorInfo,
    operatorNameFromDiscovery,
    isLoadingDiscovery,
    discoveryError,
    isLoadingSpecificFeed,
    feedError,
    totalVehicleCount,
    vehicleCount,
    stationCount,
    bikesAvailableAtStations,
    docksAvailableAtStations,
    operatorType,
    primaryFormFactor,
    operatorUrlFromSystemInfo,
    operatorEmailFromSystemInfo,
    discoveryTtl,
    feedTtl,
    feedsFromDiscovery,
  } = operatorData;

  const displayName = operatorNameFromDiscovery || operatorInfo?.name || "Unknown Operator";

  // Function to fetch map points for this operator
  const fetchMapPoints = async () => {
    if (!feedsFromDiscovery || !operatorInfo?.systemId) {
      return { points: [] };
    }

    try {
      const response = await brain.get_operator_map_points_with_feeds(
        { operatorId: operatorInfo.systemId },
        { 
          feeds: feedsFromDiscovery,
          operator_type: operatorType
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch map points:', error);
      return { points: [] };
    }
  };

  const renderContent = () => {
    if (isLoadingDiscovery || isLoadingSpecificFeed) {
      return (
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {isLoadingDiscovery ? "Getting live updates from operators..." : "Fetching live status..."}
          </span>
        </div>
      );
    }

    if (discoveryError) {
      const friendlyError = createFriendlyError(discoveryError);
      const suggestion = getErrorSuggestion(friendlyError.type);
      
      return (
        <div className="flex items-start space-x-2">
          <AlertCircle className={`h-5 w-5 mt-0.5 ${getErrorColor(friendlyError.type)}`} />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{friendlyError.title}</p>
            <p className="text-sm text-gray-600 mb-1">{friendlyError.message}</p>
            {suggestion && (
              <p className="text-xs text-gray-500 italic">{suggestion}</p>
            )}
          </div>
        </div>
      );
    }

    if (feedError) {
      const friendlyError = createFriendlyError(feedError);
      const suggestion = getErrorSuggestion(friendlyError.type);
      
      return (
        <div className="flex items-start space-x-2">
          <AlertCircle className={`h-5 w-5 mt-0.5 ${getErrorColor(friendlyError.type)}`} />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{friendlyError.title}</p>
            <p className="text-sm text-gray-600 mb-1">{friendlyError.message}</p>
            {suggestion && (
              <p className="text-xs text-gray-500 italic">{suggestion}</p>
            )}
          </div>
        </div>
      );
    }

    const isStationBased = operatorType.startsWith("station_based");

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        {/* Live Status - Now more prominent */}
        <div className="md:col-span-1 flex flex-col justify-center">
          <h4 className="font-semibold mb-1 text-muted-foreground">Total Fleet</h4>
          <p className="text-4xl font-bold">{formatNumberWithSpaces(totalVehicleCount)}</p>
          <div className="text-xs text-muted-foreground">
            {totalVehicleCount !== null && vehicleCount !== null ? (
              // Only show "In Use" if the difference is meaningful (more than just available vs available+disabled)
              totalVehicleCount > vehicleCount ? (
                <div>{formatNumberWithSpaces(vehicleCount)} Available | {formatNumberWithSpaces(totalVehicleCount - vehicleCount)} In Use</div>
              ) : (
                <div>{formatNumberWithSpaces(vehicleCount)} Available</div>
              )
            ) : totalVehicleCount !== null ? (
              <div>Total Vehicles</div>
            ) : vehicleCount !== null ? (
              <div>{formatNumberWithSpaces(vehicleCount)} Available</div>
            ) : (
              <div>Vehicle Status</div>
            )}
          </div>
           {operatorData.feedLastUpdated && (
            <div className="flex items-center text-xs text-muted-foreground mt-2">
              <StatusIndicator lastUpdated={operatorData.feedLastUpdated} ttl={feedTtl ?? discoveryTtl} />
              <span>{formatLastUpdated(operatorData.feedLastUpdated)}</span>
            </div>
          )}
        </div>

        {/* System Details */}
        <div className="md:col-span-1">
          <h4 className="font-semibold mb-2">System Details</h4>
          <p>Type: <span className="font-medium">{operatorType.replace(/_/g, " ")}</span></p>
          <p>Form Factor: <span className="font-medium">{primaryFormFactor || "N/A"}</span></p>
          {isStationBased && (
            <>
              <p>Stations: <span className="font-medium">{stationCount ?? "N/A"}</span></p>
              <p>Available Docks: <span className="font-medium">{docksAvailableAtStations ?? "N/A"}</span></p>
            </>
          )}
        </div>

        {/* Links */}
        <div className="md:col-span-1">
          <h4 className="font-semibold mb-2">Links</h4>
          {operatorUrlFromSystemInfo ? (
            <a
              href={operatorUrlFromSystemInfo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline block"
            >
              Operator Website
            </a>
          ) : (
            <p className="text-gray-500">No website listed</p>
          )}
          {operatorEmailFromSystemInfo && (
             <a
              href={`mailto:${operatorEmailFromSystemInfo}`}
              className="text-blue-600 hover:underline block mt-1"
            >
              {operatorEmailFromSystemInfo}
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {displayName}
          </CardTitle>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <MapPin className="h-4 w-4" />
            <span>Map</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
        
        {/* Expandable Map Section */}
        {isExpanded && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-semibold mb-3 text-sm text-gray-600">
              {operatorType.startsWith('station_based') ? 'Station Locations' : 'Vehicle Locations'}
            </h4>
            <OperatorMap 
              fetchPoints={fetchMapPoints} 
              cityName={operatorInfo?.location}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OperatorCard;