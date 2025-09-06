// Options page script for HumanReplies extension

document.addEventListener('DOMContentLoaded', async function() {
  const environmentSelect = document.getElementById('environment');
  const customUrlInput = document.getElementById('customUrl');
  const currentConfigDiv = document.getElementById('currentConfig');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // Load current settings
  await loadCurrentSettings();

  // Save button handler
  saveBtn.addEventListener('click', saveSettings);

  // Environment change handler
  environmentSelect.addEventListener('change', updateCurrentConfig);
  customUrlInput.addEventListener('input', updateCurrentConfig);

  async function loadCurrentSettings() {
    try {
      // Initialize environment config
      await window.EnvironmentConfig.loadEnvironment();
      
      // Set current environment
      environmentSelect.value = window.EnvironmentConfig.getCurrentEnvironment();
      
      // Load custom URL if set
      const customUrl = await window.EnvironmentConfig.getCustomBaseURL();
      if (customUrl) {
        customUrlInput.value = customUrl;
      }
      
      updateCurrentConfig();
    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('Failed to load current settings', 'error');
    }
  }

  function updateCurrentConfig() {
    const env = environmentSelect.value;
    const customUrl = customUrlInput.value.trim();
    
    let config;
    if (customUrl) {
      config = {
        environment: env + ' (overridden)',
        apiBaseURL: customUrl,
        pollinationsURL: window.EnvironmentConfig.getPollinationsURL(),
        debug: window.EnvironmentConfig.isDebugMode()
      };
    } else {
      // Get config for selected environment
      const envConfig = window.EnvironmentConfig.environments[env];
      config = {
        environment: env,
        ...envConfig
      };
    }
    
    currentConfigDiv.textContent = JSON.stringify(config, null, 2);
  }

  async function saveSettings() {
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      const selectedEnv = environmentSelect.value;
      const customUrl = customUrlInput.value.trim();
      
      // Set environment
      await window.EnvironmentConfig.setEnvironment(selectedEnv);
      
      // Set custom URL if provided
      if (customUrl) {
        await window.EnvironmentConfig.setCustomBaseURL(customUrl);
      } else {
        // Clear custom URL
        await window.EnvironmentConfig.setCustomBaseURL('');
      }
      
      showStatus('Settings saved successfully!', 'success');
      
      // Update config display
      updateCurrentConfig();
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      showStatus('Failed to save settings: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});