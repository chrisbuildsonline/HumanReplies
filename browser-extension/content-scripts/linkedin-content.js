// LinkedIn Content Script - ES Module
import environmentConfig from "../config/environment.js";
import HumanRepliesAPI from "../core/api-service.js";
import { initLinkedInIntegration } from "../platforms/linkedin-integration.js";

(async () => {
  try {
    // Initialize environment config
    await environmentConfig.loadEnvironment();

    // Create API service with environment config
    const api = new HumanRepliesAPI(environmentConfig);

    console.log("HumanReplies LinkedIn Integration initialized");
    console.log("API Base URL:", api.getBaseURL());
    console.log("Environment:", environmentConfig.getCurrentEnvironment());

    // Initialize LinkedIn integration
    initLinkedInIntegration(api);
  } catch (error) {
    console.error(
      "Failed to initialize HumanReplies LinkedIn integration:",
      error
    );
  }
})();
