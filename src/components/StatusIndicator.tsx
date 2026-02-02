

import React from "react";
import { parseTimestamp } from "utils/timestampUtils"; // Import the new parser

interface Props {
  lastUpdated: string | number | null | undefined;
  ttl?: number | null | undefined; 
}

const StatusIndicator: React.FC<Props> = ({ lastUpdated, ttl }) => {
  const feedTime = parseTimestamp(lastUpdated);

  if (!feedTime) {
    return (
      <span
        title="Feed status unknown"
        className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 bg-gray-400"
      />
    );
  }

  const now = new Date();
  const ageInSeconds = (now.getTime() - feedTime.getTime()) / 1000;

  // Define fixed thresholds in seconds
  const FRESH_THRESHOLD = 300; // 5 minutes
  const AGING_THRESHOLD = 3600; // 60 minutes

  const isFresh = ageInSeconds < FRESH_THRESHOLD;
  const isAging = ageInSeconds >= FRESH_THRESHOLD && ageInSeconds < AGING_THRESHOLD;

  if (isFresh) {
    return (
      <span
        title="Feed is fresh (updated within 5 mins)"
        className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 bg-green-500 animate-pulse"
      />
    );
  }

  if (isAging) {
    return (
      <span
        title="Feed is aging (updated 5-60 mins ago)"
        className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 bg-yellow-500"
      />
    );
  }

  // If neither fresh nor aging, it's stale.
  return (
    <span
      title="Feed is very stale (older than 60 mins)"
      className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 bg-red-500"
    />
  );
};

export default StatusIndicator;
