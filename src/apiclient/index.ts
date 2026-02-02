import { Apiclient } from "./Apiclient";
import type { RequestParams } from "./http-client";

type BaseApiParams = Omit<RequestParams, "signal" | "baseUrl" | "cancelToken">;

const constructBaseApiParams = (): BaseApiParams => {
  return {
    credentials: "same-origin",
  };
};

const constructClient = () => {
  const baseApiParams = constructBaseApiParams();

  // Base URL is empty - all API calls are relative to same origin
  return new Apiclient({
    baseUrl: "",
    baseApiParams,
  });
};

const apiclient = constructClient();

export default apiclient;
