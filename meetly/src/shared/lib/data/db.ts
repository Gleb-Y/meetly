import type { Region } from "react-native-maps";

export type EventCategory = "party" | "gym" | "basketball" | "cocktail";

export type EventMarkerData = {
  id: string;
  title: string;
  category: EventCategory;
  coordinate: { latitude: number; longitude: number };
  address?: string;
};

// мок‑ивенты вокруг Алматы
export const EVENT_MARKERS: EventMarkerData[] = [
  {
    id: "party-1",
    title: "Rave на набережной",
    category: "party",
    coordinate: { latitude: 43.2485, longitude: 76.8797 },
    address: "Набережная реки Есентай, Алматы",
  },
  {
    id: "party-2",
    title: "Disco rooftop",
    category: "party",
    coordinate: { latitude: 43.2292, longitude: 76.905 },
    address: "ул. Достык, 162, Алматы",
  },
  {
    id: "gym-1",
    title: "Ночная прокачка",
    category: "gym",
    coordinate: { latitude: 43.245, longitude: 76.865 },
    address: "пр. Абая, 52, Алматы",
  },
  {
    id: "gym-2",
    title: "Утренний воркаут",
    category: "gym",
    coordinate: { latitude: 43.2285, longitude: 76.915 },
    address: "мкр. Самал-2, Алматы",
  },
  {
    id: "bb-1",
    title: "3x3 турнир",
    category: "basketball",
    coordinate: { latitude: 43.252, longitude: 76.868 },
    address: "Парк 28 панфиловцев, Алматы",
  },
  {
    id: "bb-2",
    title: "Ночная площадка",
    category: "basketball",
    coordinate: { latitude: 43.244, longitude: 76.924 },
    address: "ул. Сатпаева, 90, Алматы",
  },
  {
    id: "ct-1",
    title: "Бар с коктейлями",
    category: "cocktail",
    coordinate: { latitude: 43.2305, longitude: 76.872 },
    address: "ул. Панфилова, 115, Алматы",
  },
  {
    id: "ct-2",
    title: "Чилл & напитки",
    category: "cocktail",
    coordinate: { latitude: 43.2485, longitude: 76.906 },
    address: "пр. Аль-Фараби, 77, Алматы",
  },
];

export const ALMATY_REGION: Region = {
  latitude: 43.238949,
  longitude: 76.889709,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};
