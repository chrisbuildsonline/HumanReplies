// LinkedIn Content Script - Non-module version
// Fixed to avoid ES6 import issues

(async () => {
  try {
    console.log(
      "🔍 HumanReplies LinkedIn Integration - Starting initialization"
    );

    // Check if we're on LinkedIn
    if (!window.location.hostname.includes("linkedin.com")) {
      console.log("❌ Not on LinkedIn, exiting");
      return;
    }

    console.log("✅ On LinkedIn, proceeding with integration");

    // Simple API service without external dependencies
    class SimpleAPIService {
      constructor() {
        this.baseURL = "https://text.pollinations.ai/openai"; // Fallback to direct API
      }

      async generateReply(context, options = {}) {
        try {
          const prompt = `Generate a professional LinkedIn reply to this content: "${context}". 
                         Tone: ${options.tone || "professional"}. 
                         Keep it concise and engaging.`;

          const response = await fetch(this.baseURL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              model: "openai",
              seed: Math.floor(Math.random() * 1000000),
            }),
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const result = await response.text();

          try {
            const parsed = JSON.parse(result);
            if (
              parsed.choices &&
              parsed.choices[0] &&
              parsed.choices[0].message
            ) {
              return { reply: parsed.choices[0].message.content };
            }
          } catch (parseError) {
            // Fallback: return the raw result
            return { reply: result };
          }

          return { reply: "Professional reply generated successfully!" };
        } catch (error) {
          console.error("API call failed:", error);
          
          // Return user-friendly messages instead of technical errors
          if (error.message.includes('429')) {
            return { reply: "Please wait a moment before generating another reply. The AI service is temporarily busy." };
          } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            return { reply: "The AI service is temporarily unavailable. Please try again in a few moments." };
          } else if (error.message.includes('Network') || error.message.includes('fetch')) {
            return { reply: "Unable to connect to the AI service. Please check your internet connection and try again." };
          } else {
            return { reply: "Unable to generate reply at the moment. Please try again." };
          }
        }
      }
    }

    // Initialize simple API service
    const api = new SimpleAPIService();

    // Available tones (hardcoded fallback)
    const availableTones = [
      {
        name: "professional",
        display_name: "💼 Professional",
        is_preset: true,
      },
      { name: "friendly", display_name: "😊 Friendly", is_preset: true },
      { name: "supportive", display_name: "❤️ Supportive", is_preset: true },
      { name: "insightful", display_name: "💡 Insightful", is_preset: true },
      { name: "question", display_name: "❓ Question", is_preset: true },
    ];

    async function handleReplyGeneration(button, editor, tone) {
      if (!editor) return;
      try {
        button.disabled = true;
        button.style.opacity = "0.6";
        button.innerHTML = "⏳";

        // Build context from nearby content
        let context = editor.textContent?.trim() || "";
        if (!context) {
          let parent = editor.parentElement;
          while (parent && !context) {
            const postNode = parent.querySelector(
              ".feed-shared-update-v2__description, .feed-shared-update-v2__commentary, .update-components-text, [data-test-id*='post-content']"
            );
            if (postNode && postNode.textContent?.trim()) {
              context = postNode.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
        }

        console.log(
          `🚀 Generating reply with context: "${context.substring(
            0,
            100
          )}..." and tone: ${tone}`
        );

        const result = await api.generateReply(
          context || "Professional networking post",
          { platform: "linkedin", tone: tone || "professional" }
        );

        // Insert reply into editor
        if (editor.contentEditable === "true") {
          editor.innerHTML = `<p>${result.reply}</p>`;
          editor.classList.remove("ql-blank");
        } else if (editor.tagName === "TEXTAREA") {
          editor.value = result.reply;
        }

        console.log("✅ Reply inserted successfully");
      } catch (err) {
        console.error("❌ Reply generation failed:", err);
        if (editor.contentEditable === "true") {
          editor.innerHTML = `<p>Error: ${err.message}</p>`;
        } else {
          editor.value = `Error: ${err.message}`;
        }
      } finally {
        button.disabled = false;
        button.style.opacity = "1";
        button.innerHTML = "🤖";
      }
    }

    function createToneMenu(button, editor) {
      // Remove existing menus
      document
        .querySelectorAll(".humanreplies-tone-menu")
        .forEach((m) => m.remove());

      const menu = document.createElement("div");
      menu.className = "humanreplies-tone-menu";
      menu.style.cssText = `
        position: absolute;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        width: 200px;
      `;

      const header = document.createElement("div");
      header.textContent = "Choose Reply Tone";
      header.style.cssText =
        "font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #666;";
      menu.appendChild(header);

      availableTones.forEach((tone) => {
        const btn = document.createElement("button");
        btn.style.cssText = `
          display: block;
          width: 100%;
          padding: 6px 8px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          font-size: 13px;
          margin-bottom: 2px;
        `;
        btn.innerHTML = tone.display_name;
        btn.addEventListener("mouseenter", () => {
          btn.style.background = "#f5f5f5";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "transparent";
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleReplyGeneration(button, editor, tone.name);
          menu.remove();
        });
        menu.appendChild(btn);
      });

      // Position menu
      const rect = button.getBoundingClientRect();
      menu.style.top = rect.bottom + window.scrollY + 4 + "px";
      menu.style.left = rect.left + window.scrollX + "px";

      document.body.appendChild(menu);

      // Close menu when clicking outside
      setTimeout(() => {
        const closeHandler = (e) => {
          if (!menu.contains(e.target) && e.target !== button) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
          }
        };
        document.addEventListener("click", closeHandler);
      }, 100);
    }

    function createReplyButton() {
      const btn = document.createElement("button");
      btn.className = "humanreplies-reply-btn";
      btn.type = "button";
      btn.innerHTML = "";
      btn.title = "Generate AI Reply";
      btn.style.cssText = `
        background: linear-gradient(45deg, #0077b5, #8b5cf6);
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 14px;
        margin: 0 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: transform 0.2s;
      `;

      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "scale(1.1)";
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "scale(1)";
      });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Find the associated editor
        const container =
          btn.closest(
            "form, .comments-comment-box, [data-test-id*='comment']"
          ) || btn.parentElement.parentElement;

        if (!container) {
          console.log("❌ No container found");
          return;
        }

        const editor = container.querySelector(
          '[contenteditable="true"], textarea'
        );
        if (!editor) {
          console.log("❌ No editor found in container");
          return;
        }

        console.log("✅ Found editor:", editor.tagName, editor.className);
        createToneMenu(btn, editor);
      });

      return btn;
    }

    function injectButtons() {
      console.log("🔍 Looking for injection points...");

      // First, remove any existing buttons to prevent duplicates
      document
        .querySelectorAll(".humanreplies-reply-btn")
        .forEach((btn) => btn.remove());
      document
        .querySelectorAll(".comments-comment-box__humanreplies-container")
        .forEach((container) => container.remove());

      // Look specifically for comment forms and target one per form
      const commentForms = document.querySelectorAll('.comments-comment-box__form');
      console.log(`🔍 Found ${commentForms.length} comment forms`);
      
      let injected = 0;
      
      commentForms.forEach((form, formIndex) => {
        console.log(`  Checking comment form ${formIndex + 1}...`);
        
        // Skip if this form already has our button
        if (form.querySelector('.humanreplies-reply-btn, .comments-comment-box__humanreplies-container')) {
          console.log(`    ❌ Form already has button, skipping`);
          return;
        }
        
        // Look for the specific toolbar: display-flex div that contains emoji AND photo buttons
        const toolbarDiv = form.querySelector('.display-flex .display-flex');
        
        if (!toolbarDiv) {
          console.log(`    ❌ No nested toolbar div found in form ${formIndex + 1}`);
          return;
        }
        
        // Verify this is the right toolbar by checking for emoji and photo buttons
        const hasEmojiButton = toolbarDiv.querySelector('.comments-comment-box__emoji-picker-trigger');
        const hasPhotoButton = toolbarDiv.querySelector('.comments-comment-box__detour-container [aria-label*="photo" i]');
        
        console.log(`    Toolbar validation - Emoji: ${!!hasEmojiButton}, Photo: ${!!hasPhotoButton}`);
        
        if (hasEmojiButton && hasPhotoButton) {
          console.log(`    ✅ Found valid toolbar in form ${formIndex + 1}`);
          
          try {
            const button = createReplyButton();
            
            // Create a wrapper div to match the structure of other buttons
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'comments-comment-box__humanreplies-container';
            buttonWrapper.appendChild(button);
            
            // Insert the button wrapper at the end of the toolbar
            toolbarDiv.appendChild(buttonWrapper);
            
            injected++;
            console.log(`    ✅ Injected HumanReplies button in form ${formIndex + 1}`);
            
          } catch (err) {
            console.log(`    ❌ Failed to inject in form ${formIndex + 1}:`, err.message);
          }
        } else {
          console.log(`    ❌ Invalid toolbar in form ${formIndex + 1} - missing emoji or photo button`);
        }
      });
      
      console.log(`📊 Total buttons injected: ${injected}`);
      return injected;
    }

    // Initial injection with delay
    setTimeout(() => {
      console.log("🚀 Starting initial button injection");
      injectButtons();
    }, 2000);

    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      if (!window.humanrepliesThrottled) {
        window.humanrepliesThrottled = true;
        setTimeout(() => {
          injectButtons();
          window.humanrepliesThrottled = false;
        }, 3000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(
      "✅ HumanReplies LinkedIn integration initialized successfully"
    );
  } catch (error) {
    console.error("❌ HumanReplies LinkedIn integration failed:", error);
  }
})();
