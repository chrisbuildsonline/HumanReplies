// LinkedIn Integration for HumanReplies
// Injects HumanReplies button next to LinkedIn comment reply areas and handles reply insertion

export function initLinkedInIntegration(apiService) {
  const api = apiService;
  let availableTones = null;
  let tonesLoading = null;

  async function loadAvailableTones() {
    if (availableTones) return availableTones;
    if (tonesLoading) return tonesLoading;

    tonesLoading = (async () => {
      try {
        // First try to get from background script cache
        if (typeof chrome !== "undefined" && chrome.runtime) {
          try {
            const bgResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: "getTones" }, (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false });
                } else {
                  resolve(response || { success: false });
                }
              });
            });

            if (bgResult.success && bgResult.tones) {
              console.log(
                "[HumanReplies][LinkedIn] Loaded",
                bgResult.tones.length,
                "tones from background cache"
              );
              availableTones = bgResult.tones;
              return availableTones;
            }
          } catch (e) {
            console.warn(
              "[HumanReplies][LinkedIn] Background cache failed:",
              e
            );
          }
        }

        // Fallback: read from chrome local storage (no API calls)
        const result = await new Promise((resolve) => {
          if (typeof chrome === "undefined" || !chrome.storage) {
            resolve({});
            return;
          }
          chrome.storage.local.get(["humanreplies_tones"], resolve);
        });

        const cached = result.humanreplies_tones;
        if (cached && Array.isArray(cached)) {
          console.log(
            "[HumanReplies][LinkedIn] Loaded",
            cached.length,
            "tones from chrome storage"
          );
          availableTones = cached;
          return availableTones;
        }

        console.warn(
          "[HumanReplies][LinkedIn] No tones found in chrome storage, using fallback"
        );
      } catch (e) {
        console.warn(
          "[HumanReplies][LinkedIn] Failed to load tones from storage:",
          e
        );
      }

      return availableTones;
    })();

    return tonesLoading;
  }

  function getSavedReplyTone() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === "undefined" || !chrome.storage)
          return resolve("ask");
        chrome.storage.sync.get(["replyTone"], (res) => {
          if (chrome.runtime?.lastError) {
            chrome.storage.local.get(["replyTone"], (resLocal) =>
              resolve(resLocal.replyTone || "ask")
            );
          } else {
            resolve(res.replyTone || "ask");
          }
        });
      } catch (e) {
        resolve("ask");
      }
    });
  }

  function saveReplyTone(tone) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage) return;
      chrome.storage.sync.set({ replyTone: tone }, () => {
        if (chrome.runtime?.lastError) {
          chrome.storage.local.set({ replyTone: tone }, () => {});
        }
      });
    } catch (_) {}
  }

  async function handleReplyGeneration(button, editor, tone) {
    if (!api || !editor) return;
    try {
      button.disabled = true;
      button.style.opacity = "0.6";
      // Build context (current editor text or traverse to find post text)
      let context = editor.textContent.trim();
      if (!context) {
        let parent = editor.parentElement;
        while (parent) {
          const postNode = parent.querySelector(
            ".feed-shared-update-v2__description, .feed-shared-update-v2__commentary, .update-components-text"
          );
          if (postNode && postNode.textContent.trim()) {
            context = postNode.textContent.trim();
            break;
          }
          parent = parent.parentElement;
        }
      }
      const result = await api.generateReply(
        context || "Respond professionally.",
        { platform: "linkedin", tone: tone || "neutral" }
      );
      editor.innerHTML = `<p>${result.reply}</p>`;
      editor.classList.remove("ql-blank");
    } catch (err) {
      console.error("[HumanReplies][LinkedIn] Reply generation failed:", err);
      editor.innerHTML = `<p>AI reply failed: ${err.message}</p>`;
    } finally {
      button.disabled = false;
      button.style.opacity = "1";
    }
  }

  async function showReplyToneMenu(button, editor) {
    const savedTone = await getSavedReplyTone();
    if (savedTone && savedTone !== "ask") {
      return handleReplyGeneration(button, editor, savedTone);
    }
    createReplyToneMenu(button, editor);
  }

  function createReplyToneMenu(button, editor) {
    // Remove existing menus
    document
      .querySelectorAll(".humanreplies-reply-tone-menu")
      .forEach((m) => m.remove());

    const menu = document.createElement("div");
    menu.className = "humanreplies-reply-tone-menu";
    menu.style.cssText = `
      position: absolute; background: #fff; color:#2c3e50; border-radius:12px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:100000; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; width:220px;`;

    const header = document.createElement("div");
    header.textContent = "Choose Reply Tone";
    header.style.cssText =
      "font-size:13px;font-weight:600;margin-bottom:8px;text-align:center;";
    menu.appendChild(header);

    // Build tone buttons after tones loaded
    loadAvailableTones().then((tones) => {
      const custom = tones.filter((t) => t.is_preset === false);
      const preset = tones.filter((t) => t.is_preset !== false);

      const addGroup = (label, list, isCustom) => {
        if (!list.length) return;
        const groupHeader = document.createElement("div");
        groupHeader.textContent = label;
        groupHeader.style.cssText = `font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin:${
          menu.children.length > 1 ? "12px" : "0"
        } 0 4px;${isCustom ? "color:#8b5cf6;" : "color:#7f8c8d;"}`;
        menu.appendChild(groupHeader);
        list.forEach((tone) => {
          const btn = createToneButton(tone, button, editor, menu, isCustom);
          menu.appendChild(btn);
        });
      };
      addGroup("Your Custom Tones", custom, true);
      if (custom.length && preset.length) {
        const sep = document.createElement("div");
        sep.style.cssText = "height:1px;background:#f0f0f0;margin:8px 0;";
        menu.appendChild(sep);
      }
      addGroup("Preset Tones", preset, false);

      // Settings section
      const sep2 = document.createElement("div");
      sep2.style.cssText = "height:1px;background:#f0f0f0;margin:10px 0 6px";
      menu.appendChild(sep2);
      const settingsLabel = document.createElement("div");
      settingsLabel.textContent = "Remember choice";
      settingsLabel.style.cssText =
        "font-size:11px;font-weight:600;color:#7f8c8d;margin-bottom:4px;";
      menu.appendChild(settingsLabel);
      const select = document.createElement("select");
      select.style.cssText =
        "width:100%;padding:6px 8px;border:1px solid #e1e8ed;border-radius:6px;font-size:12px;";
      const rememberOptions = [{ value: "ask", text: "Always ask" }];
      custom.forEach((t) =>
        rememberOptions.push({ value: t.name, text: `🎨 ${t.display_name}` })
      );
      preset.forEach((t) =>
        rememberOptions.push({ value: t.name, text: t.display_name })
      );
      rememberOptions.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.text;
        select.appendChild(opt);
      });
      getSavedReplyTone().then((val) => {
        select.value = val || "ask";
      });
      select.addEventListener("change", (e) => saveReplyTone(e.target.value));
      menu.appendChild(select);
    });

    // Position menu
    const rect = button.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;
    if (left + 240 > window.innerWidth) left = window.innerWidth - 250;
    if (top + 320 > window.innerHeight + window.scrollY)
      top = rect.top + window.scrollY - 320;
    menu.style.top = top + "px";
    menu.style.left = left + "px";

    document.body.appendChild(menu);

    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target) && e.target !== button) {
          menu.remove();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 200);
  }

  function createToneButton(tone, button, editor, menu, isCustom) {
    const btn = document.createElement("button");
    btn.style.cssText =
      "display:flex;align-items:center;width:100%;padding:8px 10px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:#2c3e50;text-align:left;transition:background .15s,transform .15s;";
    const match = tone.display_name.match(/^(\p{Emoji})\s*/u);
    const icon = match ? match[1] : "💬";
    const text = tone.display_name.replace(/^(\p{Emoji})\s*/u, "");
    btn.innerHTML = `<span style="margin-right:10px;font-size:16px;">${icon}</span><span>${text}</span>${
      isCustom
        ? '<span style="margin-left:auto;font-size:10px;color:#8b5cf6;font-weight:600;">CUSTOM</span>'
        : ""
    }`;
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#f5f3f0";
      if (isCustom) btn.style.transform = "translateX(2px)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
      btn.style.transform = "translateX(0)";
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReplyGeneration(button, editor, tone.name);
      menu.remove();
    });
    return btn;
  }

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
      const container = btn.closest(".comments-comment-box__form");
      if (!container) return;
      const editor = container.querySelector(
        '.ql-editor[contenteditable="true"]'
      );
      if (!editor) return;
      await loadAvailableTones();
      showReplyToneMenu(btn, editor);
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
}
