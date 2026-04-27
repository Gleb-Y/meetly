import type { CreateEventData } from "@/src/pages/create-event/create-event";
import { ALMATY_REGION } from "@/src/shared/lib/data/db";
import { colors } from "@/src/shared/theme/colors";
import { MapControls } from "@/src/shared/ui/map-controls";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Region } from "react-native-maps";

import {
  AddressSuggestion,
  reverseGeocodeNominatim,
  searchNominatim,
} from "@/src/entities/api/create-event/nominatim";
import { AnimatedMarker } from "@/src/shared/ui/animated-marker";

type Props = {
  data: Partial<CreateEventData>;
  onUpdate: (data: Partial<CreateEventData>) => void;
  onNext: () => void;
  onBack: () => void;
};

// ---------- Main component ----------

export function EventLocationStep({ data, onUpdate, onNext, onBack }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [markerBounceId, setMarkerBounceId] = useState(0);
  const [address, setAddress] = useState(data.address || "");
  const [region, setRegion] = useState<Region>(
    data.coordinate
      ? {
          latitude: data.coordinate.latitude,
          longitude: data.coordinate.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : ALMATY_REGION
  );

  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);

  const canProceed = address.trim().length > 0;

  const centerCoordinate = {
    latitude: region.latitude,
    longitude: region.longitude,
  };

  const animateToRegion = useCallback((target: Region) => {
    setRegion(target);
    mapRef.current?.animateToRegion(target, 400);
  }, []);

  useEffect(() => {
    // прыгаем только когда юзер реально изменил центр карты
    setMarkerBounceId((prev) => prev + 1);
  }, [region.latitude, region.longitude]);

  // ---------- REVERSE GEOCODE (движение карты → адрес) ----------

  useEffect(() => {
    if (isManualInput) return; // если юзер печатает — не трогаем

    let timeoutId: ReturnType<typeof setTimeout>;

    const fetchAddress = async () => {
      try {
        setIsLoadingAddress(true);
        const formatted = await reverseGeocodeNominatim(
          region.latitude,
          region.longitude
        );
        setAddress(formatted);
      } catch (e) {
        console.warn("Reverse geocoding error", e);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    timeoutId = setTimeout(fetchAddress, 400);

    return () => clearTimeout(timeoutId);
  }, [region.latitude, region.longitude, isManualInput]);

  // ---------- SEARCH / AUTOCOMPLETE (ввод → подсказки) ----------

  useEffect(() => {
    if (!isManualInput || address.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const search = async () => {
      try {
        setIsSearching(true);
        const results = await searchNominatim(address.trim());
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (e) {
        console.warn("Nominatim search error", e);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    };

    timeoutId = setTimeout(search, 400);

    return () => clearTimeout(timeoutId);
  }, [address, isManualInput]);

  // ---------- Handlers ----------

  const handleAddressChange = (text: string) => {
    setAddress(text);
    setIsManualInput(true);
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.address);
    setIsManualInput(false);
    setShowSuggestions(false);
    setSuggestions([]);

    animateToRegion({
      latitude: suggestion.coordinate.latitude,
      longitude: suggestion.coordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleLocateMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const userLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = userLocation.coords;

      setIsManualInput(false);
      animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (e) {
      console.warn("Location error", e);
    }
  }, [animateToRegion]);

  const handleZoomIn = useCallback(() => {
    const next: Region = {
      ...region,
      latitudeDelta: region.latitudeDelta * 0.5,
      longitudeDelta: region.longitudeDelta * 0.5,
    };
    animateToRegion(next);
  }, [region, animateToRegion]);

  const handleZoomOut = useCallback(() => {
    const next: Region = {
      ...region,
      latitudeDelta: region.latitudeDelta * 2,
      longitudeDelta: region.longitudeDelta * 2,
    };
    animateToRegion(next);
  }, [region, animateToRegion]);

  const handleNext = () => {
    if (!canProceed) return;
    onUpdate({ address: address.trim(), coordinate: centerCoordinate });
    onNext();
  };

  const handleMapInteraction = () => {
    setIsManualInput(false);
    setShowSuggestions(false);
  };

  // ---------- Render ----------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Адрес + поиск */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Адрес</Text>
          {(isLoadingAddress || isSearching) && (
            <ActivityIndicator size="small" color={colors.accentTurquoise} />
          )}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Например: Абая 55, Достык 18..."
            placeholderTextColor={colors.textSecondary}
            value={address}
            onChangeText={handleAddressChange}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
          />

          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => handleSelectSuggestion(item)}
                    style={[
                      styles.suggestionItem,
                      index < suggestions.length - 1 &&
                        styles.suggestionItemBorder,
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.address}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>

        <Text style={styles.hint}>
          {isManualInput
            ? isSearching
              ? "Ищем адрес..."
              : suggestions.length > 0
              ? "Выберите адрес из списка"
              : address.length >= 3
              ? "Адрес не найден, укажите точку на карте"
              : "Введите минимум 3 символа"
            : "Двигайте карту — адрес будет обновляться автоматически"}
        </Text>
      </View>

      {/* Карта */}
      <View style={styles.mapSection}>
        <Text style={styles.label}>Укажите точку на карте</Text>
        <Text style={styles.hint}>Двигайте карту, чтобы установить метку</Text>

        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
            onTouchStart={handleMapInteraction}
          />

          {/* Фиксированный маркер */}
          <AnimatedMarker trigger={markerBounceId} />

          {/* Кнопки управления */}
          <View style={styles.mapControls}>
            <MapControls
              onLocateMe={handleLocateMe}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
          </View>
        </View>
      </View>

      {/* Кнопки навигации */}
      <View style={styles.buttons}>
        <Pressable onPress={onBack} style={styles.buttonSecondary}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.buttonSecondaryText}>Назад</Text>
        </Pressable>

        <Pressable
          onPress={handleNext}
          disabled={!canProceed}
          style={[styles.button, !canProceed && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Далее</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    minHeight: 16,
  },
  inputContainer: {
    position: "relative",
    zIndex: 10,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  suggestionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  mapSection: {
    gap: 8,
  },
  mapWrapper: {
    height: 400,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24,
    marginTop: -48,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControls: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  coordinateInfo: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
  },
  coordinateText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTurquoise,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
