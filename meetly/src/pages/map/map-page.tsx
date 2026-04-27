import { useEvents } from "@/src/entities/api/events/events.queries";
import type { EventResponse } from "@/src/entities/api/events/events.types";
import { ALMATY_REGION } from "@/src/shared/lib/data/db";
import { MapControls } from "@/src/shared/ui/map-controls";
import { FullscreenLayout } from "@/src/widgets/layout/full-screen-layout";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "@/src/entities/api/user/user.query";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SelectedEventCard } from "../../features/map/event-card";
import { EventMarker } from "../../features/map/event-marker";

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [region, setRegion] = useState<Region>(ALMATY_REGION);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Загружаем ивенты из API
  const { data: events, isLoading, error } = useEvents();

  // 🔍 Логирование
  useEffect(() => {
    console.log("📍 Map Screen mounted");
    console.log("Events loading:", isLoading);
    console.log("Events data:", events);
    console.log("Events count:", events?.length || 0);
    console.log("Error:", error);
  }, [events, isLoading, error]);

  const selectedEvent = events?.find((e) => e.id === selectedEventId);

  const animateToRegion = useCallback((target: Region) => {
    setRegion(target);
    mapRef.current?.animateToRegion(target, 400);
  }, []);

  useEffect(() => {
    if (eventId && events) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        console.log("🎯 Auto-selecting event:", event.title);
        setSelectedEventId(event.id);
        animateToRegion({
          latitude: event.latitude,
          longitude: event.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    }
  }, [eventId, events, animateToRegion]);

  const handleLocateMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const userLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = userLocation.coords;

      animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });

      setSelectedEventId(null);
    } catch (e) {
      console.warn("Location error", e);
    }
  }, [animateToRegion]);

  const handleZoomIn = useCallback(() => {
    const factor = 0.5;
    const next: Region = {
      ...region,
      latitudeDelta: region.latitudeDelta * factor,
      longitudeDelta: region.longitudeDelta * factor,
    };
    animateToRegion(next);
    setSelectedEventId(null);
  }, [region, animateToRegion]);

  const handleZoomOut = useCallback(() => {
    const factor = 2;
    const next: Region = {
      ...region,
      latitudeDelta: region.latitudeDelta * factor,
      longitudeDelta: region.longitudeDelta * factor,
    };
    animateToRegion(next);
    setSelectedEventId(null);
  }, [region, animateToRegion]);

  const handleSelectEvent = useCallback(
    (event: EventResponse) => {
      console.log("📍 Selecting event:", event.title);
      setSelectedEventId((prevId) => {
        if (prevId === event.id) return prevId;

        animateToRegion({
          latitude: event.latitude,
          longitude: event.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });

        return event.id;
      });
    },
    [animateToRegion]
  );

  return (
    <FullscreenLayout>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={ALMATY_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={setRegion}
        >
          {events?.map((event) => {
            console.log(
              "🗺️ Rendering marker for:",
              event.title,
              event.latitude,
              event.longitude
            );
            return (
              <Marker
                key={event.id}
                coordinate={{
                  latitude: event.latitude,
                  longitude: event.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
              >
                <Pressable onPress={() => handleSelectEvent(event)}>
                  <EventMarker
                    event={event}
                    isSelected={selectedEventId === event.id}
                  />
                </Pressable>
              </Marker>
            );
          })}
        </MapView>

        {selectedEvent && (
          <SelectedEventCard
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
          />
        )}

        <View style={styles.controlsContainer}>
          <MapControls
            onLocateMe={handleLocateMe}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </View>

        {isLoading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#22D3EE" />
            <Text style={styles.loaderText}>Загрузка ивентов...</Text>
          </View>
        )}

        {!isLoading && events?.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Нет ивентов поблизости</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>
              Ошибка загрузки: {error.message}
            </Text>
          </View>
        )}
      </View>
    </FullscreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  controlsContainer: {
    position: "absolute",
    right: 16,
    top: 360,
    alignItems: "flex-end",
  },
  loader: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(5, 8, 22, 0.9)",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  loaderText: {
    color: "#22D3EE",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(5, 8, 22, 0.9)",
    padding: 16,
    borderRadius: 12,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  errorState: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
});
