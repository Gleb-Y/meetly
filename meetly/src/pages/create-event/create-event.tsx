import { useCreateEvent } from "@/src/entities/api/events/events.queries";
import type { EventCategory as APIEventCategory } from "@/src/entities/api/events/events.types";
import { EventBasicInfoStep } from "@/src/features/create-event/event-basic-info-step";
import { EventLocationStep } from "@/src/features/create-event/event-location-step";
import { EventSummaryStep } from "@/src/features/create-event/event-summary-step";
import { EventTypeStep } from "@/src/features/create-event/event-type-step";
import type { EventCategory } from "@/src/shared/lib/data/db";
import { colors } from "@/src/shared/theme/colors";
import { MainLayout } from "@/src/widgets/layout/main-layout";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export type CreateEventData = {
  title: string;
  category: EventCategory;
  description: string;
  maxParticipants: number;
  address: string;
  coordinate: { latitude: number; longitude: number };
  isPrivate: boolean;
};

const STEPS = ["Основное", "Локация", "Тип", "Проверка"];

export default function CreateEventScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [eventData, setEventData] = useState<Partial<CreateEventData>>({
    isPrivate: false,
    maxParticipants: 10,
    description: "",
  });

  const { mutate: createEvent, isPending } = useCreateEvent();

  const updateEventData = (data: Partial<CreateEventData>) => {
    setEventData((prev) => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCreate = () => {
    if (!eventData.title || !eventData.category || !eventData.coordinate) {
      Alert.alert("Ошибка", "Заполните все обязательные поля");
      return;
    }

    // Трансформируем данные в формат, который ожидает backend
    // Frontend: title → eventName, isPrivate → visibility, etc.
    const now = new Date();
    const isoDate = now.toISOString(); // Текущее время в ISO формате

    createEvent(
      {
        eventName: eventData.title,
        category: eventData.category as APIEventCategory,
        description: eventData.description || "",
        maxParticipants: eventData.maxParticipants || 10,
        locationAddress: eventData.address || "Unknown",
        locationLatitude: eventData.coordinate.latitude,
        locationLongitude: eventData.coordinate.longitude,
        visibility: eventData.isPrivate ? "PRIVATE" : "PUBLIC",
        date: isoDate,
        isAllDay: false,
      },
      {
        onSuccess: (data) => {
          console.log("Успех", "Ивент создан!", [
            {
              text: "OK",
              onPress: () => {
                router.replace({
                  pathname: "/(tabs)/map",
                  params: { eventId: data.id },
                });
              },
            },
          ]);
        },
        onError: (error: any) => {
          console.log(
            "Ошибка",
            error.response?.data?.message || "Не удалось создать ивент"
          );
        },
      }
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <EventBasicInfoStep
            data={eventData}
            onUpdate={updateEventData}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <EventLocationStep
            data={eventData}
            onUpdate={updateEventData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <EventTypeStep
            data={eventData}
            onUpdate={updateEventData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <EventSummaryStep
            data={eventData as CreateEventData}
            onBack={handleBack}
            onCreate={handleCreate}
            isLoading={isPending}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <View style={styles.container}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            {currentStep > 0 && (
              <Pressable onPress={handleBack} style={styles.backButton}>
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </Pressable>
            )}
            <Text style={styles.stepText}>
              Шаг {currentStep + 1} из {STEPS.length}
            </Text>
          </View>

          <View style={styles.progressBar}>
            {STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index <= currentStep && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.stepTitle}>{STEPS[currentStep]}</Text>
        </View>

        {/* Step Content */}
        <View style={styles.content}>{renderStep()}</View>
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.tabBarBorder,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: colors.tabBarBorder,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: colors.accentTurquoise,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
});
