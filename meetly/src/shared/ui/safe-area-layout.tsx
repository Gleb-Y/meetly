import React from "react";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SafeAreaLayoutProps {
  children: React.ReactNode;
}

export const SafeAreaLayout: React.FC<SafeAreaLayoutProps> = ({ children }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6", // вместо bg-background
  },
});
