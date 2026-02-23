export type LatLng = [number, number];

type FetchLike = typeof fetch;

export async function geocodeLocation(query: string, fetchImpl: FetchLike = fetch) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
  });

  const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Geocoding request failed");
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (data.length === 0) {
    return null;
  }

  return [Number(data[0].lat), Number(data[0].lon)] as LatLng;
}

export async function reverseGeocodeLocation(point: LatLng, fetchImpl: FetchLike = fetch) {
  const params = new URLSearchParams({
    lat: String(point[0]),
    lon: String(point[1]),
    format: "json",
  });

  const response = await fetchImpl(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Reverse geocoding request failed");
  }

  const data = (await response.json()) as { display_name?: string };
  return data.display_name?.trim() || null;
}
