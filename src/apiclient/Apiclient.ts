import {
  CheckHealthData,
  GBFSFeedsRequest,
  GetConfigData,
  GetGbfsFeedsDataData,
  GetGbfsFeedsDataError,
  GetMobilityFeedsData,
  GetMobilityFeedsError,
  GetMobilityFeedsParams,
  GetOperatorMapPointsData,
  GetOperatorMapPointsError,
  GetOperatorMapPointsParams,
  GetOperatorMapPointsWithFeedsData,
  GetOperatorMapPointsWithFeedsError,
  GetOperatorMapPointsWithFeedsParams,
  HealthCheckData,
  OperatorFeedsRequest,
  ProxyGbfsUrlData,
  ProxyGbfsUrlError,
  ProxyGbfsUrlParams,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Apiclient<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/api/health
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/api/health`,
      method: "GET",
      ...params,
    });

  /**
   * @description Fetches data from multiple GBFS feeds concurrently and caches the results.
   *
   * @name get_gbfs_feeds_data
   * @summary Get Gbfs Feeds Data
   * @request POST:/api/v2/gbfs-feeds
   */
  get_gbfs_feeds_data = (data: GBFSFeedsRequest, params: RequestParams = {}) =>
    this.request<GetGbfsFeedsDataData, GetGbfsFeedsDataError>({
      path: `/api/v2/gbfs-feeds`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Proxies a request to an external GBFS URL to bypass CORS issues.
   *
   * @name proxy_gbfs_url
   * @summary Proxy Gbfs Url
   * @request GET:/api/proxy
   */
  proxy_gbfs_url = (query: ProxyGbfsUrlParams, params: RequestParams = {}) =>
    this.request<ProxyGbfsUrlData, ProxyGbfsUrlError>({
      path: `/api/proxy`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Get GBFS feeds with intelligent caching for performance.
   *
   * @name get_mobility_feeds
   * @summary Get Mobility Feeds
   * @request GET:/api/feeds
   */
  get_mobility_feeds = (query: GetMobilityFeedsParams = {}, params: RequestParams = {}) =>
    this.request<GetMobilityFeedsData, GetMobilityFeedsError>({
      path: `/api/feeds`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Health check endpoint to verify API connectivity.
   *
   * @name health_check
   * @summary Health Check
   * @request GET:/api/health
   */
  health_check = (params: RequestParams = {}) =>
    this.request<HealthCheckData, any>({
      path: `/api/health`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get map points (stations or vehicles) for a specific operator.
   *
   * @name get_operator_map_points
   * @summary Get Operator Map Points
   * @request GET:/api/operators/{operator_id}/map-points
   */
  get_operator_map_points = ({ operatorId, ...query }: GetOperatorMapPointsParams, params: RequestParams = {}) =>
    this.request<GetOperatorMapPointsData, GetOperatorMapPointsError>({
      path: `/api/operators/${operatorId}/map-points`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get map points for an operator given their feed URLs.
   *
   * @name get_operator_map_points_with_feeds
   * @summary Get Operator Map Points With Feeds
   * @request POST:/api/operators/{operator_id}/map-points
   */
  get_operator_map_points_with_feeds = (
    { operatorId, ...query }: GetOperatorMapPointsWithFeedsParams,
    data: OperatorFeedsRequest,
    params: RequestParams = {},
  ) =>
    this.request<GetOperatorMapPointsWithFeedsData, GetOperatorMapPointsWithFeedsError>({
      path: `/api/operators/${operatorId}/map-points`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Get client configuration including Mapbox token
   *
   * @name get_config
   * @summary Get Config
   * @request GET:/api/config
   */
  get_config = (params: RequestParams = {}) =>
    this.request<GetConfigData, any>({
      path: `/api/config`,
      method: "GET",
      ...params,
    });
}
