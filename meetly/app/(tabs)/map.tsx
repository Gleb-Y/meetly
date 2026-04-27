import MapScreen from "@/src/pages/map/map-page";
import { useLocalSearchParams } from "expo-router";
import React from "react";

export default function MapTab() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  // Передай eventId как пропс, если нужно
  return <MapScreen />;
}
