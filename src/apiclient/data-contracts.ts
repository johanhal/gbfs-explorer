/** ConfigResponse */
export interface ConfigResponse {
  /** Mapbox Token */
  mapbox_token: string;
}

/** GBFSFeed */
export interface GBFSFeed {
  /** Name */
  name: string;
  /** Url */
  url: string;
}

/** GBFSFeedData */
export interface GBFSFeedData {
  /** Feed Name */
  feed_name: string;
  /** Data */
  data: Record<string, any> | null;
  /** Error */
  error: string | null;
}

/** GBFSFeedsRequest */
export interface GBFSFeedsRequest {
  /** Feeds */
  feeds: GBFSFeed[];
}

/**
 * GBFSSystemsResponse
 * Response model for GBFS systems data compatible with existing frontend.
 */
export interface GBFSSystemsResponse {
  /** Systems */
  systems: Record<string, any>[];
  /** Total Count */
  total_count: number;
  /** Last Updated */
  last_updated: string;
  /**
   * Cache Hit
   * @default false
   */
  cache_hit?: boolean;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/** MapPoint */
export interface MapPoint {
  /** Lat */
  lat: number;
  /** Lon */
  lon: number;
}

/** MapPointsResponse */
export interface MapPointsResponse {
  /** Points */
  points: MapPoint[];
}

/** OperatorFeedsRequest */
export interface OperatorFeedsRequest {
  /** Feeds */
  feeds: Record<string, string>;
  /** Operator Type */
  operator_type: string;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type CheckHealthData = HealthResponse;

/** Response Get Gbfs Feeds Data */
export type GetGbfsFeedsDataData = GBFSFeedData[];

export type GetGbfsFeedsDataError = HTTPValidationError;

export interface ProxyGbfsUrlParams {
  /** Target Url */
  target_url: string;
}

export type ProxyGbfsUrlData = any;

export type ProxyGbfsUrlError = HTTPValidationError;

export interface GetMobilityFeedsParams {
  /**
   * Data Type
   * @default "gbfs"
   */
  data_type?: string;
  /** Limit */
  limit?: number;
  /**
   * Force Refresh
   * @default false
   */
  force_refresh?: boolean;
}

export type GetMobilityFeedsData = GBFSSystemsResponse;

export type GetMobilityFeedsError = HTTPValidationError;

export type HealthCheckData = any;

export interface GetOperatorMapPointsParams {
  /** Operator Id */
  operatorId: string;
}

export type GetOperatorMapPointsData = MapPointsResponse;

export type GetOperatorMapPointsError = HTTPValidationError;

export interface GetOperatorMapPointsWithFeedsParams {
  /** Operator Id */
  operatorId: string;
}

export type GetOperatorMapPointsWithFeedsData = MapPointsResponse;

export type GetOperatorMapPointsWithFeedsError = HTTPValidationError;

export type GetConfigData = ConfigResponse;
