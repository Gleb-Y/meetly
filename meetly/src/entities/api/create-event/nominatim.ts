export type NominatimAddress = {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
};

export type AddressSuggestion = {
  id: string;
  address: string;
  coordinate: { latitude: number; longitude: number };
};

export type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

export type NominatimReverseResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

// ---------- CONFIG ----------
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const headers = {
  "User-Agent": "MeetlyApp/1.0 (contact@yourmail.com)",
};

// ---------- ADDRESS FORMATTER ----------
export const buildDisplayAddress = (
  address?: NominatimAddress,
  fallback?: string
): string => {
  if (!address) return fallback || "Адрес не найден";

  const road = address.road;
  const house = address.house_number;

  if (road && house) return `${road} ${house}`;
  if (road) return road;

  return fallback || "Адрес не найден";
};

// ---------- SEARCH CACHE ----------
const searchCache = new Map<string, any>();

export async function searchNominatim(
  query: string
): Promise<AddressSuggestion[]> {
  const key = query.toLowerCase().trim();
  if (searchCache.has(key)) return searchCache.get(key);

  const url =
    `${NOMINATIM_BASE}/search?` +
    `format=json&addressdetails=1&limit=5&countrycodes=kz&q=${encodeURIComponent(
      key + ", Алматы, Казахстан"
    )}`;

  const response = await fetch(url, { headers });
  const json = (await response.json()) as NominatimSearchResult[];

  const results: AddressSuggestion[] = json.map((item, idx) => ({
    id: `${item.place_id}-${idx}`,
    address: buildDisplayAddress(item.address, item.display_name),
    coordinate: {
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    },
  }));

  searchCache.set(key, results);
  return results;
}

// ---------- REVERSE CACHE ----------
const reverseCache = new Map<string, string>();

export async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number
): Promise<string> {
  const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

  if (reverseCache.has(key)) return reverseCache.get(key)!;

  const url =
    `${NOMINATIM_BASE}/reverse?` +
    `format=json&addressdetails=1&lat=${latitude}&lon=${longitude}&zoom=18`;

  const res = await fetch(url, { headers });
  const json = (await res.json()) as NominatimReverseResult;

  const formatted = buildDisplayAddress(json.address, json.display_name);

  reverseCache.set(key, formatted);
  return formatted;
}
