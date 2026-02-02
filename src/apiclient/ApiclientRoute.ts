import {
  CheckHealthData,
  GBFSFeedsRequest,
  GetConfigData,
  GetGbfsFeedsDataData,
  GetMobilityFeedsData,
  GetOperatorMapPointsData,
  GetOperatorMapPointsWithFeedsData,
  HealthCheckData,
  OperatorFeedsRequest,
  ProxyGbfsUrlData,
} from "./data-contracts";

export namespace Apiclient {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * @description Fetches data from multiple GBFS feeds concurrently and caches the results.
   * @tags dbtn/module:gbfs_v2
   * @name get_gbfs_feeds_data
   * @summary Get Gbfs Feeds Data
   * @request POST:/routes/v2/gbfs-feeds
   */
  export namespace get_gbfs_feeds_data {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = GBFSFeedsRequest;
    export type RequestHeaders = {};
    export type ResponseBody = GetGbfsFeedsDataData;
  }

  /**
   * @description Proxies a request to an external GBFS URL to bypass CORS issues. Typically used to fetch gbfs.json auto-discovery files. Sets a User-Agent and checks Content-Type for JSON.
   * @tags dbtn/module:gbfs_data
   * @name proxy_gbfs_url
   * @summary Proxy Gbfs Url
   * @request GET:/routes/proxy
   */
  export namespace proxy_gbfs_url {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Target Url */
      target_url: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ProxyGbfsUrlData;
  }

  /**
   * @description Get GBFS feeds with intelligent caching for performance.
   * @tags dbtn/module:mobility_database
   * @name get_mobility_feeds
   * @summary Get Mobility Feeds
   * @request GET:/routes/feeds
   */
  export namespace get_mobility_feeds {
    export type RequestParams = {};
    export type RequestQuery = {
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
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetMobilityFeedsData;
  }

  /**
   * @description Health check endpoint to verify API connectivity.
   * @tags dbtn/module:mobility_database
   * @name health_check
   * @summary Health Check
   * @request GET:/routes/health
   */
  export namespace health_check {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = HealthCheckData;
  }

  /**
   * @description Get map points (stations or vehicles) for a specific operator.
   * @tags dbtn/module:operator_map
   * @name get_operator_map_points
   * @summary Get Operator Map Points
   * @request GET:/routes/operators/{operator_id}/map-points
   */
  export namespace get_operator_map_points {
    export type RequestParams = {
      /** Operator Id */
      operatorId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetOperatorMapPointsData;
  }

  /**
   * @description Get map points for an operator given their feed URLs.
   * @tags dbtn/module:operator_map
   * @name get_operator_map_points_with_feeds
   * @summary Get Operator Map Points With Feeds
   * @request POST:/routes/operators/{operator_id}/map-points
   */
  export namespace get_operator_map_points_with_feeds {
    export type RequestParams = {
      /** Operator Id */
      operatorId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = OperatorFeedsRequest;
    export type RequestHeaders = {};
    export type ResponseBody = GetOperatorMapPointsWithFeedsData;
  }

  /**
   * @description Get client configuration including Mapbox token
   * @tags dbtn/module:config
   * @name get_config
   * @summary Get Config
   * @request GET:/routes/config
   */
  export namespace get_config {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetConfigData;
  }
}
