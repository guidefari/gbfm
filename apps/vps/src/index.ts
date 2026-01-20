import "@/lib/otel";
import app from "./app";

export const localVPSPort = 3003;

export default {
  port: localVPSPort,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 1000, // 1GB
};
