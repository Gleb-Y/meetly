import { colors } from "@/src/shared/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type CodePageProps = {
  contact: string; // email или phone
  contactType: "email" | "phone";
  onVerify: (code: string) => void;
  onResend?: () => void;
  onBack: () => void;
  isLoading?: boolean;
};

export function CodeScreen({
  contact,
  contactType,
  onVerify,
  onResend,
  onBack,
  isLoading = false,
}: CodePageProps) {
  const [code, setCode] = useState(["", "", "", ""]);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Автофокус на первый инпут
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Если вставили весь код
      const digits = text.replace(/\D/g, "").slice(0, 4).split("");
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 4) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);

      // Фокус на последний заполненный
      const lastFilledIndex = Math.min(index + digits.length - 1, 3);
      inputRefs.current[lastFilledIndex]?.focus();

      // Автоотправка если код полный
      if (newCode.filter((d) => d).length === 4) {
        Keyboard.dismiss();
        onVerify(newCode.join(""));
      }
      return;
    }

    // Обычный ввод одной цифры
    if (/^\d*$/.test(text)) {
      const newCode = [...code];
      newCode[index] = text;
      setCode(newCode);

      // Переход на следующий инпут
      if (text && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }

      // Автоотправка если код полный
      if (index === 3 && text) {
        Keyboard.dismiss();
        onVerify(newCode.join(""));
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const formatContact = () => {
    if (contactType === "email") {
      return contact;
    }

    // Форматирование телефона: +7 XXX XXX XX XX
    const digits = contact.replace(/\D/g, "");
    const cleaned = digits.startsWith("7") ? digits.slice(1) : digits;

    if (cleaned.length >= 10) {
      return `+7 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
        6,
        8
      )} ${cleaned.slice(8, 10)}`;
    }

    return `+7 ${cleaned}`;
  };

  const getTitle = () => {
    return contactType === "email" ? "Проверьте почту" : "Введите код";
  };

  const getSubtitle = () => {
    const formattedContact = formatContact();
    return contactType === "email"
      ? `Мы отправили 4-значный код на\n${formattedContact}`
      : `Мы отправили код на номер\n${formattedContact}`;
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        disabled={isLoading}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>
            {getSubtitle().split("\n")[0]}
            {"\n"}
            <Text style={styles.contact}>{getSubtitle().split("\n")[1]}</Text>
          </Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!isLoading}
            />
          ))}
        </View>

        {isLoading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.accentTurquoise} />
            <Text style={styles.loaderText}>Проверяем код...</Text>
          </View>
        )}

        {onResend && (
          <Pressable
            style={styles.resendButton}
            onPress={onResend}
            disabled={isLoading}
          >
            <Ionicons name="refresh" size={18} color={colors.accentTurquoise} />
            <Text style={styles.resendText}>Отправить код повторно</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 60,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  contact: {
    color: colors.accentTurquoise,
    fontWeight: "600",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    flex: 1,
    height: 56,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.tabBarBorder,
    fontSize: 24,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  codeInputFilled: {
    borderColor: colors.accentTurquoise,
    backgroundColor: colors.bg,
  },
  loader: {
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
  },
  resendText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accentTurquoise,
  },
});
