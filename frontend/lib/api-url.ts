const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export function getApiBaseUrl(): string {
  if (configuredApiUrl.startsWith("/")) {
    return configuredApiUrl.replace(/\/$/, "");
  }
  if (typeof window === "undefined") return configuredApiUrl;

  const url = new URL(configuredApiUrl);
  if (
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    url.hostname = window.location.hostname;
  }
  return url.toString().replace(/\/$/, "");
}
