import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.walkingpaw.service",
  appName: "Walking Paw",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
