import { colors } from "@/src/shared/theme/colors";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FullscreenLayoutProps = {
  children: React.ReactNode;
};

export function FullscreenLayout({ children }: FullscreenLayoutProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
