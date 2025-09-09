// X (Twitter) Content Script - ES Module
import environmentConfig from "../config/environment.js";
import HumanRepliesAPI from "../core/api-service.js";
import { initXIntegration } from "../platforms/x-integration.js";

(async () => {
  try {
    // Initialize environment config
    await environmentConfig.loadEnvironment();

    // Create API service with environment config
    const api = new HumanRepliesAPI(environmentConfig);

    console.log("HumanReplies X Integration initialized");
    console.log("API Base URL:", api.getBaseURL());
    console.log("Environment:", environmentConfig.getCurrentEnvironment());

    // Check API status and log it
    const apiStatus = await environmentConfig.getApiStatus();
    console.log(
      "API Status:",
      apiStatus.isOnline ? "Online" : "Offline",
      `(last checked: ${new Date(apiStatus.lastChecked).toLocaleTimeString()})`
    );

    // Initialize X integration
    initXIntegration(api);
  } catch (error) {
    console.error("Failed to initialize HumanReplies X integration:", error);
  }
})();
