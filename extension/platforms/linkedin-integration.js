// LinkedIn Integration for HumanReplies
// Injects HumanReplies button next to LinkedIn comment reply areas and handles reply insertion
(function () {
  // Use global HumanRepliesAPI
  const api = window.HumanRepliesAPI ? new window.HumanRepliesAPI() : null;

  function createReplyButton() {
    const btn = document.createElement("button");
    btn.className = "humanreplies-reply-btn";
    btn.type = "button";
    btn.innerHTML = "";
    btn.style.marginLeft = "8px";
    btn.style.marginRight = "8px";
    btn.style.marginTop = "7px";
    btn.style.marginBottom = "7px";
    btn.style.background = "linear-gradient(45deg, #1d9bf0, #8b5cf6)";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "50%";
    btn.style.padding = "4px";
    btn.style.width = "24px";
    btn.style.height = "24px";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 2px 8px rgba(44, 62, 80, 0.2)";
    btn.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Find the nearest editor
      const container = btn.closest(".comments-comment-box__form");
      if (!container) return;
      const editor = container.querySelector(
        '.ql-editor[contenteditable="true"]'
      );
      if (!editor) return;
      // Get context from editor (or parent post)
      let context = editor.textContent.trim();
      if (!context) {
        // Try to get post text above (traverse up to find main post)
        let postText = "";
        let parent = container.parentElement;
        while (parent) {
          // Look for common LinkedIn post containers
          const postCandidate = parent.querySelector(
            ".feed-shared-update-v2__description, .feed-shared-update-v2__commentary, .update-components-text, .comments-comment-box__main"
          );
          if (postCandidate && postCandidate.textContent.trim()) {
            postText = postCandidate.textContent.trim();
            break;
          }
          parent = parent.parentElement;
        }
        if (!postText) {
          // Fallback: try document-wide
          const fallback = document.querySelector(
            ".feed-shared-update-v2__description, .feed-shared-update-v2__commentary, .update-components-text, .comments-comment-box__main"
          );
          if (fallback && fallback.textContent.trim()) {
            postText = fallback.textContent.trim();
          }
        }
        if (postText) context = postText;
      }
      // Generate reply using API
      if (api) {
        try {
          btn.disabled = true;
          btn.style.opacity = "0.7";
          const result = await api.generateReply(context, {
            platform: "linkedin",
          });
          editor.innerHTML = `<p>${result.reply}</p>`;
          editor.classList.remove("ql-blank");
        } catch (err) {
          editor.innerHTML = `<p>AI reply failed: ${err.message}</p>`;
        } finally {
          btn.disabled = false;
          btn.style.opacity = "1";
        }
      }
    });
    return btn;
  }

  function injectButtons() {
    const emojiButtons = document.querySelectorAll(
      ".comments-comment-box__emoji-picker-trigger"
    );
    emojiButtons.forEach((emojiBtn) => {
      if (!emojiBtn) return;
      // Find the inner display-flex div containing the emoji button
      const innerFlex = emojiBtn.closest(".display-flex");
      if (!innerFlex) return;
      // Prevent duplicate button
      if (innerFlex.querySelector(".humanreplies-reply-btn")) return;
      try {
        innerFlex.appendChild(createReplyButton());
        console.log(
          "[HumanReplies] Button appended inside inner .display-flex:",
          innerFlex
        );
      } catch (err) {
        console.error(
          "[HumanReplies] Failed to append button inside inner .display-flex:",
          err
        );
        // Fallback: append to parent of innerFlex
        innerFlex.parentElement.appendChild(createReplyButton());
        console.log(
          "[HumanReplies] Fallback: Button appended to parent of innerFlex"
        );
      }
    });
  }

  // Observe DOM changes to inject buttons dynamically, but avoid infinite loop
  let observer;
  function safeInjectButtons() {
    if (observer) observer.disconnect();
    injectButtons();
    if (observer)
      observer.observe(document.body, { childList: true, subtree: true });
  }

  observer = new MutationObserver(safeInjectButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial injection
  safeInjectButtons();
})();
