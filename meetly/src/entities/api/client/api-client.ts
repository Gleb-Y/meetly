import axios, { AxiosError, AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("🌐 API Base URL:", API_BASE_URL);
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Достань токен из AsyncStorage
        const token = await AsyncStorage.getItem("access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        console.log(
          `📤 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`
        );
        if (config.data) {
          console.log("Request data:", config.data);
        }
        if (token) {
          console.log("🔑 Token:", token.substring(0, 20) + "...");
        }

        return config;
      },
      (error) => {
        console.error("❌ Request error:", error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        if (error.response) {
          console.error(
            `❌ Response error [${error.response.status}]:`,
            error.response.data
          );

          // 401 = токен невалидный или истёк
          if (error.response.status === 401) {
            console.log("🚪 Unauthorized - clearing session");
            await AsyncStorage.removeItem("access_token");
            await AsyncStorage.removeItem("user");
            // TODO: Редирект на логин через router
          }
        } else if (error.request) {
          console.error("❌ No response from server");
          const url = error.config
            ? `${error.config.baseURL || ""}${error.config.url || ""}`
            : "unknown";
          console.error("URL:", url);
        } else {
          console.error("❌ Request setup error:", error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  public getClient() {
    return this.client;
  }
}

export const apiClient = new ApiClient().getClient();
