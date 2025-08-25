// LinkedIn Integration for HumanReplies
// Injects HumanReplies button next to LinkedIn comment reply areas and handles reply insertion
(function () {
  // Utility to create the HumanReplies button
  function createReplyButton() {
    const btn = document.createElement("button");
    btn.className = "humanreplies-reply-btn";
    btn.type = "button";
    btn.innerHTML = "";
    btn.style.marginLeft = "8px";
    btn.style.background = "linear-gradient(45deg, #1d9bf0, #8b5cf6)";

    (function () {
      // Use global HumanRepliesAPI
      const api = window.HumanRepliesAPI ? new window.HumanRepliesAPI() : null;

      function createReplyButton() {
        const btn = document.createElement("button");
        btn.className = "humanreplies-reply-btn";
        btn.type = "button";
        btn.innerHTML = '<img src="/extension/logo.png" alt="HumanReplies" style="width:24px;height:24px;display:block;">';
        btn.style.marginLeft = "8px";
        btn.style.background = "linear-gradient(45deg, #1d9bf0, #8b5cf6)";
        btn.style.color = "white";
        btn.style.border = "none";
        btn.style.borderRadius = "50%";
        btn.style.padding = "4px";
        btn.style.width = "32px";
        btn.style.height = "32px";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 2px 8px rgba(44, 62, 80, 0.2)";
        btn.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          // Find the nearest editor
          const container = btn.closest(".comments-comment-box__form");
          if (!container) return;
          const editor = container.querySelector('.ql-editor[contenteditable="true"]');
          if (!editor) return;
          // Get context from editor (or parent post)
          let context = editor.textContent.trim();
          if (!context) {
            // Try to get post text above
            const post = container.closest('.comments-comment-box__main') || document.querySelector('.comments-comment-box__main');
            if (post) {
              const postText = post.textContent.trim();
              if (postText) context = postText;
            }
          }
          // Generate reply using API
          if (api) {
            try {
              btn.disabled = true;
              btn.style.opacity = "0.7";
              const result = await api.generateReply(context, { platform: "linkedin" });
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
        const emojiButtons = document.querySelectorAll(".comments-comment-box__emoji-picker-trigger");
        emojiButtons.forEach((emojiBtn) => {
          // Avoid duplicate buttons in the same flex container
          const flexContainer = emojiBtn.closest('.display-flex');
          if (!flexContainer) return;
          if (flexContainer.querySelector('.humanreplies-reply-btn')) return;
          // Insert directly after emoji button
          emojiBtn.insertAdjacentElement("afterend", createReplyButton());
        });
      }

      // Observe DOM changes to inject buttons dynamically, but avoid infinite loop
      let observer;
      function safeInjectButtons() {
        if (observer) observer.disconnect();
        injectButtons();
        if (observer) observer.observe(document.body, { childList: true, subtree: true });
      }

      observer = new MutationObserver(safeInjectButtons);
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial injection
      safeInjectButtons();
    })();
