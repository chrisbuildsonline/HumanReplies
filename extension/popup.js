// HumanReplies popup.js

document.addEventListener("DOMContentLoaded", function () {
  const replyToneSelect = document.getElementById("replyToneSelect");
  if (replyToneSelect) {
    // Load saved value
    chrome.storage.sync.get(["replyTone"], function (result) {
      replyToneSelect.value = result.replyTone || "ask";
    });

    // Save on change
    replyToneSelect.addEventListener("change", function (e) {
      chrome.storage.sync.set({ replyTone: e.target.value }, function () {
        // Optionally show a confirmation
        // console.log('Reply tone saved:', e.target.value);
      });
    });
  }

  // Debug button: show current storage value
  const debugButton = document.querySelector(".debug-storage-btn");
  if (debugButton) {
    debugButton.onclick = function () {
      chrome.storage.sync.get(["replyTone"], function (result) {
        alert("Current replyTone value: " + (result.replyTone || "ask"));
      });
    };
  }
});
