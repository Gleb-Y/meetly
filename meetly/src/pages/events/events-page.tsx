import { useEvents } from "@/src/entities/api/events/events.queries";
import type { EventResponse } from "@/src/entities/api/events/events.types";
import { EventFilters } from "@/src/features/events/event-filters";
import { EventListCard } from "@/src/features/events/event-list-card";
import { EventSearch } from "@/src/features/events/event-search";
import type { EventCategory } from "@/src/shared/lib/data/db";
import { colors } from "@/src/shared/theme/colors";
import { MainLayout } from "@/src/widgets/layout/main-layout";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function EventsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    EventCategory | "all"
  >("all");

  // Загружаем ивенты из API
  const { data: events, isLoading, error } = useEvents();

  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let filtered = events;

    // Фильтр по категории
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (event) => event.category === selectedCategory
      );
    }

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.address?.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [events, searchQuery, selectedCategory]);

  const handleEventPress = (event: EventResponse) => {
    router.push({
      pathname: "/(tabs)/map",
      params: { eventId: event.id },
    });
  };

  return (
    <MainLayout>
      <View style={styles.container}>
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventListCard event={item} onPress={handleEventPress} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Ивенты</Text>
                <Text style={styles.subtitle}>
                  {filteredEvents.length}{" "}
                  {filteredEvents.length === 1
                    ? "ивент"
                    : filteredEvents.length > 1 && filteredEvents.length < 5
                    ? "ивента"
                    : "ивентов"}
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <EventSearch
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={styles.filtersContainer}>
                <EventFilters
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={colors.accentTurquoise}
                />
                <Text style={styles.loadingText}>Загрузка ивентов...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Ошибка загрузки</Text>
                <Text style={styles.emptySubtext}>
                  Не удалось загрузить ивенты. Попробуйте позже.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Ивенты не найдены</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery || selectedCategory !== "all"
                    ? "Попробуйте изменить фильтры или поисковый запрос"
                    : "Создайте первый ивент!"}
                </Text>
              </View>
            )
          }
        />
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 12,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
