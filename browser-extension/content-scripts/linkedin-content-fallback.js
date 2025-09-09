// LinkedIn Content Script - Non-module fallback version
// Use this if ES modules are causing issues

(async () => {
  try {
    console.log("🔍 HumanReplies LinkedIn Debug - Starting initialization");
    
    // Check if we're on LinkedIn
    if (!window.location.hostname.includes('linkedin.com')) {
      console.log("❌ Not on LinkedIn, exiting");
      return;
    }
    
    console.log("✅ On LinkedIn, proceeding with integration");
    
    // Simple DOM injection without external dependencies
    function createSimpleButton() {
      const btn = document.createElement("button");
      btn.className = "humanreplies-simple-btn";
      btn.innerHTML = "🤖";
      btn.title = "Generate AI Reply";
      btn.style.cssText = `
        background: linear-gradient(45deg, #1d9bf0, #8b5cf6);
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 12px;
        margin: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        position: relative;
        z-index: 1000;
      `;
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🚀 HumanReplies button clicked!");
        
        // Find nearby text editor
        const container = btn.closest('form, [role="dialog"], .comments-comment-box');
        if (container) {
          const editor = container.querySelector('[contenteditable="true"], textarea');
          if (editor) {
            editor.value = "AI reply feature is working! (Integration in progress)";
            editor.innerHTML = "<p>AI reply feature is working! (Integration in progress)</p>";
            console.log("✅ Reply inserted into editor");
          } else {
            console.log("❌ No editor found in container");
          }
        } else {
          console.log("❌ No form container found");
        }
      });
      
      return btn;
    }
    
    function injectButtons() {
      console.log("🔍 Looking for injection points...");
      
      // Look for various LinkedIn comment/reply areas
      const selectors = [
        '[aria-label*="Write a comment"]',
        '[placeholder*="Add a comment"]',
        '.comments-comment-box',
        '[data-test-id*="comment"]',
        'form[class*="comment"]',
        '.ql-editor',
        '[contenteditable="true"]'
      ];
      
      let injected = 0;
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`  Found ${elements.length} elements for selector: ${selector}`);
        
        elements.forEach(element => {
          // Skip if already has button
          if (element.parentElement && element.parentElement.querySelector('.humanreplies-simple-btn')) {
            return;
          }
          
          try {
            const button = createSimpleButton();
            
            // Try different injection strategies
            if (element.parentElement) {
              element.parentElement.appendChild(button);
              injected++;
              console.log(`✅ Injected button near ${selector}`);
            }
          } catch (err) {
            console.log(`❌ Failed to inject near ${selector}:`, err);
          }
        });
      });
      
      console.log(`📊 Total buttons injected: ${injected}`);
      return injected;
    }
    
    // Initial injection
    setTimeout(() => {
      console.log("🚀 Starting initial button injection");
      injectButtons();
    }, 1000);
    
    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      // Throttle the injection to avoid performance issues
      if (!window.humanrepliesThrottled) {
        window.humanrepliesThrottled = true;
        setTimeout(() => {
          injectButtons();
          window.humanrepliesThrottled = false;
        }, 2000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log("✅ HumanReplies LinkedIn integration initialized (fallback mode)");
    
  } catch (error) {
    console.error("❌ HumanReplies LinkedIn integration failed:", error);
  }
})();