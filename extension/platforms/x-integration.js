// X (Twitter) platform integration for HumanReplies

class XIntegration {
  constructor() {
    this.apiService = new HumanRepliesAPI();
    this.debugMode = true; // Enable debugging
    this.addedButtons = new Set(); // Track added buttons to prevent duplicates
    console.log('🧠 HumanReplies: X Integration initialized');
    this.init();
  }

  init() {
    this.log('Starting initialization...');
    this.detectTheme();
    this.injectReplyButtons();
    this.observePageChanges();
    this.initTextSelectionToolbar();
  }

  detectTheme() {
    // Detect X (Twitter) theme
    const isDarkMode = document.documentElement.style.colorScheme === 'dark' ||
                      document.body.classList.contains('dark') ||
                      document.querySelector('[data-theme="dark"]') ||
                      window.matchMedia('(prefers-color-scheme: dark)').matches ||
                      // X-specific dark mode detection
                      document.querySelector('meta[name="theme-color"][content="#000000"]') ||
                      document.querySelector('[style*="background-color: rgb(0, 0, 0)"]') ||
                      getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
    
    this.isDarkMode = isDarkMode;
    this.log(`Theme detected: ${isDarkMode ? 'dark' : 'light'} mode`);
    
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const newDarkMode = document.documentElement.style.colorScheme === 'dark' ||
                         document.body.classList.contains('dark') ||
                         document.querySelector('[data-theme="dark"]') ||
                         getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
      
      if (newDarkMode !== this.isDarkMode) {
        this.isDarkMode = newDarkMode;
        this.log(`Theme changed to: ${newDarkMode ? 'dark' : 'light'} mode`);
      }
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme']
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  log(message) {
    if (this.debugMode) {
      console.log(`🧠 HumanReplies: ${message}`);
    }
  }

  injectReplyButtons() {
    // Initial injection after page load
    setTimeout(() => {
      this.log('Initial injection attempt...');
      this.addReplyButtons();
    }, 2000);
    
    // Single retry after a longer delay
    setTimeout(() => {
      this.log('Retry injection attempt...');
      this.addReplyButtons();
    }, 5000);
    
    // Throttled scroll handler for new content
    let scrollTimeout;
    let lastScrollTime = 0;
    
    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScrollTime < 2000) return; // Throttle to max once per 2 seconds
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.log('Scroll-triggered injection...');
        this.addReplyButtons();
        lastScrollTime = Date.now();
      }, 1500);
    });
  }

  addReplyButtons() {
    this.log('Looking for compose toolbars...');
    
    // Find all toolbars using the same approach as the external plugin
    const toolbars = document.querySelectorAll('[data-testid="toolBar"] nav[role="navigation"]');
    this.log(`Found ${toolbars.length} compose toolbars`);
    
    toolbars.forEach((toolbar, index) => {
      try {
        // Check if we already added our button to this toolbar
        if (toolbar.querySelector('.humanreplies-icon-wrapper')) {
          this.log(`Toolbar ${index + 1}: Already has our button`);
          return;
        }
        
        this.log(`Toolbar ${index + 1}: Adding AI Reply button to toolbar`);
        
        // Create our button wrapper exactly like the external plugin
        const wrapper = document.createElement('div');
        wrapper.className = 'humanreplies-icon-wrapper';
        wrapper.id = `humanreplies-button-${index}`;
        
        // Create our button
        const humanRepliesBtn = this.createReplyButton();
        wrapper.appendChild(humanRepliesBtn);
        
        // Insert directly into the nav element, just like the external plugin
        toolbar.appendChild(wrapper);
        
        this.log(`Successfully added button to toolbar ${index + 1}`);
        
      } catch (error) {
        this.log(`Error processing toolbar ${index + 1}: ${error.message}`);
      }
    });
  }



  isReplyArea(element) {
    // Check various indicators that this is a reply area
    const indicators = [
      element.getAttribute('data-text')?.includes('reply'),
      element.getAttribute('aria-label')?.includes('reply'),
      element.getAttribute('placeholder')?.includes('reply'),
      element.closest('[data-testid*="reply"]'),
      element.closest('[aria-label*="reply"]'),
      // Look for reply context in parent elements
      this.hasReplyContext(element)
    ];
    
    return indicators.some(indicator => indicator);
  }

  hasReplyContext(element) {
    // Look for tweet content above this element (indicating it's a reply)
    let parent = element.parentElement;
    let depth = 0;
    
    while (parent && depth < 10) {
      if (parent.querySelector('[data-testid="tweetText"]') ||
          parent.querySelector('[data-testid="tweet"]') ||
          parent.querySelector('article')) {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return false;
  }

  getElementId(element) {
    // Create a unique ID for the element
    if (!element.dataset.humanrepliesId) {
      element.dataset.humanrepliesId = 'hr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return element.dataset.humanrepliesId;
  }

  createReplyButton(textarea = null) {
    const button = document.createElement('button');
    button.className = 'humanreplies-reply-btn';
    button.innerHTML = '🧠';
    button.title = 'Generate AI Reply';
    if (textarea) {
      button.dataset.humanrepliesFor = this.getElementId(textarea);
    }
    
    // Compact styling similar to the external plugin
    const isDark = this.isDarkMode;
    
    button.style.cssText = `
      background: ${isDark ? 'linear-gradient(135deg, #1d9bf0 0%, #0d7ec7 100%)' : 'linear-gradient(135deg, #2c3e50 0%, #34495e 100)'};
      color: white;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px ${isDark ? 'rgba(29, 155, 240, 0.3)' : 'rgba(44, 62, 80, 0.2)'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px) scale(1.02)';
      if (isDark) {
        button.style.boxShadow = '0 4px 16px rgba(29, 155, 240, 0.4)';
        button.style.background = 'linear-gradient(135deg, #1a8cd8 0%, #0d7ec7 50%, #0a6bb3 100%)';
      } else {
        button.style.boxShadow = '0 4px 16px rgba(44, 62, 80, 0.3)';
        button.style.background = 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0) scale(1)';
      if (isDark) {
        button.style.boxShadow = '0 2px 8px rgba(29, 155, 240, 0.3)';
        button.style.background = 'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 50%, #0d7ec7 100%)';
      } else {
        button.style.boxShadow = '0 2px 8px rgba(44, 62, 80, 0.2)';
        button.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
      }
    });

    // Add click handler with multiple event types for better compatibility
    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      console.log('🧠 HumanReplies: AI Reply button clicked!');
      this.log('AI Reply button clicked');
      
      // Visual feedback
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = '';
      }, 100);
      
      try {
        // Find the nearest textarea for this button
        const nearestTextarea = this.findNearestTextarea(button);
        this.log(`Found textarea: ${nearestTextarea ? 'yes' : 'no'}`);
        
        if (nearestTextarea) {
          this.showReplyToneMenu(button, nearestTextarea);
        } else {
          // Try to find any reply textarea on the page
          const anyReplyTextarea = document.querySelector('[data-testid="tweetTextarea_0"]');
          if (anyReplyTextarea) {
            this.log('Using fallback textarea');
            this.showReplyToneMenu(button, anyReplyTextarea);
          } else {
            this.log('No textarea found, showing alert');
            alert('Please click reply on a tweet first, then use the AI Reply button.');
          }
        }
      } catch (error) {
        this.log(`Error in showReplyToneMenu: ${error.message}`);
        console.error('Error in showReplyToneMenu:', error);
        alert(`Error: ${error.message}`);
      }
    };
    
    // Add multiple event listeners for better compatibility
    button.addEventListener('click', clickHandler);
    button.addEventListener('mousedown', clickHandler);
    button.addEventListener('touchstart', clickHandler, { passive: false });

    return button;
  }

  getTweetId(element) {
    // Try to find a unique identifier for this tweet
    let parent = element;
    let depth = 0;
    
    while (parent && depth < 10) {
      // Look for tweet-specific attributes or IDs
      if (parent.getAttribute('data-testid') === 'tweet') {
        // Use the tweet element's position or content as ID
        const tweetText = parent.querySelector('[data-testid="tweetText"]');
        if (tweetText) {
          return 'tweet_' + tweetText.textContent.substring(0, 20).replace(/\W/g, '');
        }
      }
      
      // Look for any unique identifier
      if (parent.id) {
        return parent.id;
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    // Fallback: use element's position in DOM
    return 'btn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }



  insertReplyButton(textarea, button) {
    this.log('Inserting reply button...');
    
    // Create a container for our button
    const container = document.createElement('div');
    container.className = 'humanreplies-container';
    container.style.cssText = `
      margin: 8px 0;
      padding: 0;
      display: flex;
      justify-content: flex-start;
    `;
    container.appendChild(button);
    
    // Try different insertion strategies
    const insertionStrategies = [
      // Strategy 1: After toolbar
      () => {
        const toolbar = textarea.closest('[data-testid="toolBar"]') || 
                       textarea.parentElement.querySelector('[role="toolbar"]');
        if (toolbar) {
          toolbar.parentElement.insertBefore(container, toolbar.nextSibling);
          return true;
        }
        return false;
      },
      
      // Strategy 2: After textarea parent
      () => {
        if (textarea.parentElement) {
          textarea.parentElement.insertBefore(container, textarea.nextSibling);
          return true;
        }
        return false;
      },
      
      // Strategy 3: Find compose area and append
      () => {
        let parent = textarea.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          if (parent.querySelector('[data-testid*="compose"]') || 
              parent.querySelector('[data-testid*="reply"]')) {
            parent.appendChild(container);
            return true;
          }
          parent = parent.parentElement;
          depth++;
        }
        return false;
      },
      
      // Strategy 4: Simple append to parent
      () => {
        if (textarea.parentElement) {
          textarea.parentElement.appendChild(container);
          return true;
        }
        return false;
      }
    ];
    
    for (let i = 0; i < insertionStrategies.length; i++) {
      try {
        if (insertionStrategies[i]()) {
          this.log(`Button inserted using strategy ${i + 1}`);
          return;
        }
      } catch (error) {
        this.log(`Strategy ${i + 1} failed: ${error.message}`);
      }
    }
    
    this.log('All insertion strategies failed');
  }

  async handleReplyGeneration(button, textarea, selectedTone = null) {
    this.log('Handling reply generation...');
    
    if (!textarea) {
      textarea = this.findNearestTextarea(button);
    }
    
    if (!textarea) {
      this.log('No textarea found');
      this.showError(button, 'Could not find text area');
      return;
    }

    const tweetContext = this.getTweetContext(button);
    this.log(`Tweet context: "${tweetContext}"`);
    
    if (!tweetContext) {
      this.showError(button, 'Could not find tweet to reply to');
      return;
    }

    this.showLoadingState(button);
    
    try {
      this.log('Calling API service...');
      
      // Build tone-specific prompt
      const tonePrompt = this.buildReplyPromptWithTone(tweetContext, selectedTone);
      
      const result = await this.apiService.generateReply(tonePrompt, {
        platform: 'x',
        tone: selectedTone || 'helpful'
      });
      
      this.log(`Generated reply: "${result.reply}"`);
      this.insertReply(textarea, result.reply);
      this.showSuccessState(button, result.remainingReplies);
      
    } catch (error) {
      this.log(`Reply generation failed: ${error.message}`);
      console.error('Reply generation failed:', error);
      this.showError(button, error.message);
    }
  }

  buildReplyPromptWithTone(tweetContext, tone) {
    const basePrompt = `Generate a thoughtful reply to this tweet: "${tweetContext}"`;
    
    const toneInstructions = {
      neutral: 'Write a balanced, professional, and neutral response.',
      joke: 'Write a funny, humorous response that adds levity while staying respectful.',
      support: 'Write a supportive, encouraging, and empathetic response that shows understanding.',
      idea: 'Write a response that presents an innovative idea or creative suggestion related to the topic.',
      question: 'Write a response that asks a thoughtful question to encourage further discussion.'
    };
    
    const toneInstruction = toneInstructions[tone] || 'Write a helpful and engaging response.';
    
    return `${basePrompt}\n\nTone instruction: ${toneInstruction}\n\nKeep the response under 280 characters and make it conversational.`;
  }

  findNearestTextarea(button) {
    this.log('Finding nearest textarea for button...');
    
    // Strategy 1: Look in the same tweet/reply container
    let parent = button.parentElement;
    let depth = 0;
    
    while (parent && depth < 10) {
      // Look for text areas in this container
      const textareas = [
        parent.querySelector('[data-testid="tweetTextarea_0"]'),
        parent.querySelector('textarea'),
        parent.querySelector('[contenteditable="true"][role="textbox"]'),
        parent.querySelector('[contenteditable="true"][aria-label*="reply"]'),
        parent.querySelector('[contenteditable="true"][data-text*="reply"]')
      ].filter(Boolean);
      
      if (textareas.length > 0) {
        this.log(`Found textarea using strategy 1 at depth ${depth}`);
        return textareas[0];
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    // Strategy 2: Look for any reply textarea on the page
    const allTextareas = document.querySelectorAll('[data-testid="tweetTextarea_0"]');
    for (const textarea of allTextareas) {
      if (this.isReplyArea(textarea)) {
        this.log('Found textarea using strategy 2 (page-wide search)');
        return textarea;
      }
    }
    
    this.log('No textarea found');
    return null;
  }

  getTweetContext(button) {
    this.log('Looking for tweet context...');
    
    // Strategy 1: Look in parent elements for tweet content
    let parent = button.parentElement;
    let depth = 0;
    
    while (parent && depth < 15) {
      // Look for tweet text in various selectors
      const selectors = [
        '[data-testid="tweetText"]',
        '[data-testid="tweet"] [lang]',
        'article [lang]',
        '[role="article"] [lang]'
      ];
      
      for (const selector of selectors) {
        const tweetText = parent.querySelector(selector);
        if (tweetText && tweetText.textContent.trim()) {
          const context = tweetText.textContent.trim();
          this.log(`Found context via ${selector}: "${context.substring(0, 50)}..."`);
          return context;
        }
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    // Strategy 2: Look for any tweet on the current page
    this.log('Fallback: Looking for any tweet on page...');
    const fallbackSelectors = [
      '[data-testid="tweetText"]',
      'article [lang]',
      '[role="article"] [lang]'
    ];
    
    for (const selector of fallbackSelectors) {
      const tweets = document.querySelectorAll(selector);
      for (const tweet of tweets) {
        const text = tweet.textContent.trim();
        if (text && text.length > 10) { // Reasonable tweet length
          this.log(`Found fallback context: "${text.substring(0, 50)}..."`);
          return text;
        }
      }
    }
    
    // Strategy 3: Use a generic context
    this.log('No specific context found, using generic');
    return 'This is an interesting post. Let me share my thoughts.';
  }

  insertReply(textarea, reply) {
    this.log(`Inserting reply into ${textarea.tagName}: "${reply}"`);
    
    try {
      if (textarea.tagName === 'TEXTAREA') {
        // Standard textarea
        textarea.value = reply;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Contenteditable element (more common on X)
        
        // Method 1: Set textContent
        textarea.textContent = reply;
        
        // Method 2: Set innerHTML (backup)
        if (!textarea.textContent) {
          textarea.innerHTML = reply;
        }
        
        // Method 3: Use document.execCommand (legacy but sometimes works)
        if (!textarea.textContent) {
          textarea.focus();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, reply);
        }
        
        // Trigger various events that X might be listening for
        const events = ['input', 'change', 'keyup', 'paste'];
        events.forEach(eventType => {
          textarea.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // Try to trigger React events
        const reactProps = Object.keys(textarea).find(key => key.startsWith('__reactProps'));
        if (reactProps && textarea[reactProps]?.onChange) {
          textarea[reactProps].onChange({ target: { value: reply } });
        }
        
        // Alternative React trigger
        const reactFiber = Object.keys(textarea).find(key => key.startsWith('__reactInternalInstance'));
        if (reactFiber) {
          const event = new Event('input', { bubbles: true });
          event.target.value = reply;
          textarea.dispatchEvent(event);
        }
      }
      
      // Focus and position cursor at end
      textarea.focus();
      
      // Set cursor to end for contenteditable
      if (textarea.contentEditable === 'true') {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(textarea);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      this.log('Reply inserted successfully');
      
    } catch (error) {
      this.log(`Error inserting reply: ${error.message}`);
      console.error('Error inserting reply:', error);
    }
  }

  showLoadingState(button) {
    button.innerHTML = '⏳ Generating...';
    button.disabled = true;
    button.style.opacity = '0.7';
  }

  showSuccessState(button, remainingReplies) {
    button.innerHTML = '✅ Reply Generated';
    button.disabled = false;
    button.style.opacity = '1';
    
    if (remainingReplies !== null) {
      button.title = `${remainingReplies} replies remaining today`;
    }
    
    // Reset button after 2 seconds
    setTimeout(() => {
      button.innerHTML = '🧠 Generate Reply';
    }, 2000);
  }

  showError(button, message) {
    button.innerHTML = '❌ Error';
    button.disabled = false;
    button.style.opacity = '1';
    button.title = message;
    
    // Reset button after 3 seconds
    setTimeout(() => {
      button.innerHTML = '🧠 Generate Reply';
      button.title = '';
    }, 3000);
  }

  observePageChanges() {
    // Watch for dynamic content changes on X
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && 
                (node.querySelector('[data-testid="tweetTextarea_0"]') ||
                 node.matches('[data-testid="tweetTextarea_0"]'))) {
              shouldUpdate = true;
            }
          });
        }
      });
      
      if (shouldUpdate) {
        setTimeout(() => this.addReplyButtons(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Text Selection Toolbar Feature
  initTextSelectionToolbar() {
    this.log('Initializing text selection toolbar...');
    this.currentToolbar = null;
    this.selectionTimeout = null;
    this.lastSelectedText = '';
    this.isProcessingSelection = false;
    
    // Only listen for mouseup events to avoid conflicts
    document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  handleTextSelection(e) {
    // Prevent multiple rapid calls
    if (this.isProcessingSelection) {
      return;
    }
    
    // Clear any existing timeout
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }
    
    // Wait a bit for selection to stabilize
    this.selectionTimeout = setTimeout(() => {
      this.isProcessingSelection = true;
      
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      this.log(`Selection check - Text: "${selectedText}", Length: ${selectedText.length}`);
      
      // Only process if the selection has actually changed
      if (selectedText !== this.lastSelectedText) {
        this.lastSelectedText = selectedText;
        
        if (selectedText && selectedText.length > 2) {
          this.log(`Valid text selected: "${selectedText.substring(0, 30)}..."`);
          this.showSelectionToolbar(selection, selectedText);
        } else {
          // Only hide if we're not clicking on the toolbar itself
          if (!this.isInteractingWithToolbar(e.target)) {
            this.log('No valid selection and not interacting with toolbar, hiding');
            this.hideSelectionToolbar();
          }
        }
      }
      
      // Reset processing flag after a short delay
      setTimeout(() => {
        this.isProcessingSelection = false;
      }, 100);
    }, 200);
  }

  handleDocumentClick(e) {
    // Don't process clicks if we're already processing selection
    if (this.isProcessingSelection) {
      this.log('Ignoring click - processing selection');
      return;
    }
    
    // Check if clicking on toolbar elements
    if (this.isInteractingWithToolbar(e.target)) {
      this.log('Clicked on toolbar, ignoring');
      return;
    }
    
    this.log(`Document clicked on: ${e.target.tagName} with classes: ${e.target.className}`);
    
    // Only hide toolbar if clicking outside of it AND there's no text selection
    if (this.currentToolbar) {
      // Small delay to check if selection still exists after click
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (!selectedText || selectedText.length === 0) {
          this.log('Clicked outside toolbar with no selection, hiding');
          this.lastSelectedText = '';
          this.hideSelectionToolbar();
        } else {
          this.log('Clicked outside but text still selected, keeping toolbar');
        }
      }, 100);
    }
  }

  isInteractingWithToolbar(target) {
    if (!this.currentToolbar) return false;
    
    // Check if the target is within the toolbar
    return this.currentToolbar.contains(target) || 
           target.closest('.humanreplies-selection-toolbar-compact') ||
           target.closest('.humanreplies-selection-toolbar-expanded') ||
           target.classList.contains('humanreplies-selection-toolbar-compact') ||
           target.classList.contains('humanreplies-selection-toolbar-expanded');
  }

  showSelectionToolbar(selection, selectedText) {
    // Don't show if we already have a toolbar for the same text
    if (this.currentToolbar && this.lastSelectedText === selectedText) {
      this.log('Toolbar already showing for this selection');
      return;
    }
    
    // Hide existing toolbar
    this.hideSelectionToolbar();
    
    try {
      // Get selection bounds
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Check if selection is valid and visible
      if (rect.width === 0 && rect.height === 0) {
        this.log('Selection has no visible bounds, skipping');
        return;
      }
      
      // Create compact toolbar first
      this.currentToolbar = this.createCompactToolbar(selectedText, null, selection);
      
      // Position toolbar above selection
      const toolbarHeight = 40;
      const toolbarWidth = 120;
      
      let top = rect.top + window.scrollY - toolbarHeight - 10;
      let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarWidth / 2);
      
      // Keep toolbar on screen
      if (left < 10) left = 10;
      if (left + toolbarWidth > window.innerWidth - 10) {
        left = window.innerWidth - toolbarWidth - 10;
      }
      if (top < 10) {
        top = rect.bottom + window.scrollY + 10; // Show below if no room above
      }
      
      this.currentToolbar.style.top = top + 'px';
      this.currentToolbar.style.left = left + 'px';
      
      document.body.appendChild(this.currentToolbar);
      
      this.log('Toolbar created and positioned');
      
      // Animate in
      requestAnimationFrame(() => {
        if (this.currentToolbar) {
          this.currentToolbar.style.opacity = '1';
          this.currentToolbar.style.transform = 'translateY(0) scale(1)';
        }
      });
      
    } catch (error) {
      this.log(`Error showing toolbar: ${error.message}`);
      console.error('Error showing selection toolbar:', error);
    }
  }

  findTextAreaFromSelection(node) {
    // Walk up the DOM to find a text area
    let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    let depth = 0;
    
    while (current && depth < 10) {
      if (current.contentEditable === 'true' || 
          current.tagName === 'TEXTAREA' ||
          current.matches('[data-testid="tweetTextarea_0"]') ||
          current.matches('[role="textbox"]')) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }

  createCompactToolbar(selectedText, textArea, selection) {
    const toolbar = document.createElement('div');
    toolbar.className = 'humanreplies-selection-toolbar-compact';
    
    // Theme-aware colors
    const bgColor = this.isDarkMode ? '#1d9bf0' : '#2c3e50';
    const shadowColor = this.isDarkMode ? 'rgba(29, 155, 240, 0.3)' : 'rgba(44, 62, 80, 0.3)';
    
    toolbar.style.cssText = `
      position: absolute;
      background: ${bgColor};
      border-radius: 20px;
      box-shadow: 0 4px 12px ${shadowColor};
      padding: 8px 12px;
      z-index: 10000;
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // AI Icon button
    const aiButton = document.createElement('button');
    aiButton.style.cssText = `
      background: transparent;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `;
    aiButton.innerHTML = '✨';
    
    // Label
    const label = document.createElement('span');
    label.style.cssText = `
      color: white;
      font-size: 13px;
      font-weight: 500;
    `;
    label.textContent = 'AI';
    
    aiButton.addEventListener('mouseenter', () => {
      aiButton.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    aiButton.addEventListener('mouseleave', () => {
      aiButton.style.background = 'transparent';
    });
    
    aiButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.log('AI button clicked, expanding toolbar');
      this.expandToolbar(selectedText, textArea, selection);
    });
    
    toolbar.appendChild(aiButton);
    toolbar.appendChild(label);
    
    return toolbar;
  }

  expandToolbar(selectedText, textArea, selection) {
    if (!this.currentToolbar) {
      this.log('No current toolbar to expand');
      return;
    }
    
    this.log('Expanding toolbar...');
    
    // Get current position
    const currentRect = this.currentToolbar.getBoundingClientRect();
    
    // Store the current toolbar reference
    const oldToolbar = this.currentToolbar;
    
    // Create expanded toolbar
    this.currentToolbar = this.createExpandedToolbar(selectedText, textArea, selection);
    
    // Position expanded toolbar
    const toolbarHeight = 280;
    const toolbarWidth = 320;
    
    let top = currentRect.top + window.scrollY - toolbarHeight + 40;
    let left = currentRect.left + window.scrollX - (toolbarWidth / 2) + 60;
    
    // Keep toolbar on screen
    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) {
      left = window.innerWidth - toolbarWidth - 10;
    }
    if (top < 10) {
      top = currentRect.bottom + window.scrollY + 10;
    }
    
    this.currentToolbar.style.top = top + 'px';
    this.currentToolbar.style.left = left + 'px';
    
    document.body.appendChild(this.currentToolbar);
    
    // Remove old toolbar after adding new one
    if (oldToolbar && oldToolbar.parentElement) {
      oldToolbar.parentElement.removeChild(oldToolbar);
    }
    
    // Animate in
    requestAnimationFrame(() => {
      if (this.currentToolbar) {
        this.currentToolbar.style.opacity = '1';
        this.currentToolbar.style.transform = 'translateY(0) scale(1)';
      }
    });
    
    this.log('Toolbar expanded successfully');
  }

  createExpandedToolbar(selectedText, textArea, selection) {
    const toolbar = document.createElement('div');
    toolbar.className = 'humanreplies-selection-toolbar-expanded';
    // Theme-aware colors
    const bgColor = this.isDarkMode ? '#15202b' : 'white';
    const borderColor = this.isDarkMode ? '#38444d' : '#e1e8ed';
    const textColor = this.isDarkMode ? 'white' : '#2c3e50';
    const shadowColor = this.isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.15)';
    
    toolbar.style.cssText = `
      position: absolute;
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      box-shadow: 0 8px 24px ${shadowColor};
      padding: 12px;
      z-index: 10000;
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 320px;
      color: ${textColor};
    `;
    
    // Close button (top right corner)
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: transparent;
      border: none;
      color: #7f8c8d;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      z-index: 1;
    `;
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.log('Close button clicked');
      this.hideSelectionToolbar();
    });
    
    toolbar.appendChild(closeButton);
    
    // Options
    const options = [
      {
        icon: '✨',
        text: 'Improve writing',
        action: 'improve',
        description: 'Make the text clearer and more engaging'
      },
      {
        icon: '✓',
        text: 'Check spelling & grammar',
        action: 'grammar',
        description: 'Fix spelling and grammar issues'
      },
      {
        icon: '—',
        text: 'Make shorter',
        action: 'shorter',
        description: 'Condense the text while keeping the meaning'
      },
      {
        icon: '≡',
        text: 'Make longer',
        action: 'longer',
        description: 'Expand the text with more detail'
      },
      {
        icon: '✦',
        text: 'Simplify language',
        action: 'simplify',
        description: 'Use simpler, clearer language'
      },
      {
        icon: '🎭',
        text: 'Change tone',
        action: 'tone',
        description: 'Adjust the tone and style',
        hasSubmenu: true,
        submenu: [
          { icon: '👍', text: 'Neutral', action: 'tone-neutral' },
          { icon: '😂', text: 'Joke', action: 'tone-joke' },
          { icon: '❤️', text: 'Support', action: 'tone-support' },
          { icon: '💡', text: 'Idea', action: 'tone-idea' },
          { icon: '❓', text: 'Question', action: 'tone-question' }
        ]
      }
    ];
    
    options.forEach(option => {
      const button = document.createElement('button');
      button.style.cssText = `
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #2c3e50;
        transition: background 0.2s ease;
        margin-bottom: 2px;
        text-align: left;
        position: relative;
      `;
      
      button.innerHTML = `
        <span style="margin-right: 12px; font-size: 16px;">${option.icon}</span>
        <span>${option.text}</span>
        ${option.hasSubmenu ? '<span style="margin-left: auto; font-size: 12px; color: #7f8c8d;">▶</span>' : ''}
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.background = '#f5f3f0';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
      });
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.log(`Selection action clicked: ${option.action}`);
        
        if (option.hasSubmenu) {
          this.showToneSubmenu(button, option.submenu, selectedText, textArea, selection);
        } else {
          this.handleSelectionAction(option.action, selectedText, textArea, selection);
        }
      });
      
      toolbar.appendChild(button);
    });
    
    return toolbar;
  }

  async handleSelectionAction(action, selectedText, textArea, selection) {
    this.log(`Handling selection action: ${action} for text: "${selectedText.substring(0, 30)}..."`);
    
    // Show loading state
    if (this.currentToolbar) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        font-size: 14px;
        color: #2c3e50;
      `;
      loadingDiv.innerHTML = '⏳ Processing...';
      this.currentToolbar.appendChild(loadingDiv);
    }
    
    try {
      const prompt = this.buildSelectionPrompt(action, selectedText);
      const result = await this.apiService.generateReply(prompt, {
        platform: 'x',
        tone: 'helpful'
      });
      
      // Replace selected text with improved version
      this.replaceSelectedText(selection, result.reply, textArea);
      this.hideSelectionToolbar();
      
    } catch (error) {
      this.log(`Selection action failed: ${error.message}`);
      console.error('Selection action failed:', error);
      
      // Show error briefly
      if (this.currentToolbar) {
        const errorDiv = this.currentToolbar.querySelector('div:last-child');
        if (errorDiv) {
          errorDiv.innerHTML = '❌ Error occurred';
          setTimeout(() => this.hideSelectionToolbar(), 2000);
        }
      }
    }
  }

  buildSelectionPrompt(action, selectedText) {
    const prompts = {
      improve: `Improve this text to make it clearer, more engaging, and better written: "${selectedText}"`,
      grammar: `Fix any spelling and grammar errors in this text: "${selectedText}"`,
      shorter: `Make this text shorter while keeping the same meaning: "${selectedText}"`,
      longer: `Expand this text with more detail and context: "${selectedText}"`,
      simplify: `Rewrite this text using simpler, clearer language: "${selectedText}"`,
      'tone-neutral': `Rewrite this text with a neutral, balanced tone: "${selectedText}"`,
      'tone-joke': `Rewrite this text to be funny and humorous while keeping the main message: "${selectedText}"`,
      'tone-support': `Rewrite this text to be supportive, encouraging, and empathetic: "${selectedText}"`,
      'tone-idea': `Rewrite this text to present it as an innovative idea or suggestion: "${selectedText}"`,
      'tone-question': `Rewrite this text as a thoughtful question to encourage discussion: "${selectedText}"`
    };
    
    return prompts[action] || prompts.improve;
  }

  showToneSubmenu(parentButton, submenuOptions, selectedText, textArea, selection) {
    // Remove any existing submenu
    const existingSubmenu = document.querySelector('.humanreplies-tone-submenu');
    if (existingSubmenu) {
      existingSubmenu.remove();
    }

    const submenu = document.createElement('div');
    submenu.className = 'humanreplies-tone-submenu';
    submenu.style.cssText = `
      position: absolute;
      left: 100%;
      top: 0;
      background: white;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      padding: 4px;
      z-index: 10001;
      min-width: 140px;
      margin-left: 8px;
    `;

    submenuOptions.forEach(option => {
      const submenuButton = document.createElement('button');
      submenuButton.style.cssText = `
        display: flex;
        align-items: center;
        width: 100%;
        padding: 8px 10px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: #2c3e50;
        transition: background 0.2s ease;
        margin-bottom: 1px;
        text-align: left;
      `;

      submenuButton.innerHTML = `
        <span style="margin-right: 8px; font-size: 14px;">${option.icon}</span>
        <span>${option.text}</span>
      `;

      submenuButton.addEventListener('mouseenter', () => {
        submenuButton.style.background = '#f5f3f0';
      });

      submenuButton.addEventListener('mouseleave', () => {
        submenuButton.style.background = 'transparent';
      });

      submenuButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.log(`Tone submenu clicked: ${option.action}`);
        this.handleSelectionAction(option.action, selectedText, textArea, selection);
        submenu.remove();
      });

      submenu.appendChild(submenuButton);
    });

    parentButton.appendChild(submenu);

    // Remove submenu when clicking elsewhere
    setTimeout(() => {
      const removeSubmenu = (e) => {
        if (!submenu.contains(e.target) && !parentButton.contains(e.target)) {
          submenu.remove();
          document.removeEventListener('click', removeSubmenu);
        }
      };
      document.addEventListener('click', removeSubmenu);
    }, 100);
  }

  replaceSelectedText(selection, newText, textArea) {
    try {
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        
        // Clear selection
        selection.removeAllRanges();
        
        // Trigger input events
        const events = ['input', 'change', 'keyup'];
        events.forEach(eventType => {
          textArea.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        this.log('Text replaced successfully');
      }
    } catch (error) {
      this.log(`Error replacing text: ${error.message}`);
      console.error('Error replacing text:', error);
    }
  }

  hideSelectionToolbar() {
    if (this.currentToolbar) {
      this.log('Hiding selection toolbar');
      
      this.currentToolbar.style.opacity = '0';
      this.currentToolbar.style.transform = 'translateY(-10px) scale(0.95)';
      
      setTimeout(() => {
        if (this.currentToolbar && this.currentToolbar.parentElement) {
          this.currentToolbar.parentElement.removeChild(this.currentToolbar);
        }
        this.currentToolbar = null;
      }, 200);
    }
  }

  // Reply Tone Menu
  async showReplyToneMenu(button, textarea) {
    this.log('showReplyToneMenu called');
    
    try {
      // Check if user has a saved preference
      const savedTone = await this.getSavedReplyTone();
      this.log(`Saved tone: ${savedTone}`);
      
      if (savedTone && savedTone !== 'ask') {
        // Auto-generate with saved tone
        this.log(`Using saved tone: ${savedTone}`);
        this.handleReplyGeneration(button, textarea, savedTone);
        return;
      }

      // Show tone selection menu
      this.log('Creating tone menu');
      this.createReplyToneMenu(button, textarea);
    } catch (error) {
      this.log(`Error in showReplyToneMenu: ${error.message}`);
      // Fallback to neutral tone
      this.handleReplyGeneration(button, textarea, 'neutral');
    }
  }

  createReplyToneMenu(button, textarea) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.humanreplies-reply-tone-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'humanreplies-reply-tone-menu';
    // Theme-aware colors
    const bgColor = this.isDarkMode ? '#15202b' : 'white';
    const textColor = this.isDarkMode ? 'white' : '#2c3e50';
    const shadowColor = this.isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.15)';
    
    menu.style.cssText = `
      position: absolute;
      background: ${bgColor};
      border: none;
      border-radius: 12px;
      box-shadow: 0 8px 24px ${shadowColor};
      padding: 12px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 200px;
      user-select: none;
      pointer-events: auto;
      color: ${textColor};
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 13px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
      text-align: center;
    `;
    header.textContent = 'Choose Reply Tone';
    menu.appendChild(header);

    // Tone options
    const toneOptions = [
      { icon: '👍', text: 'Neutral', value: 'neutral' },
      { icon: '😂', text: 'Joke', value: 'joke' },
      { icon: '❤️', text: 'Support', value: 'support' },
      { icon: '💡', text: 'Idea', value: 'idea' },
      { icon: '❓', text: 'Question', value: 'question' }
    ];

    toneOptions.forEach(option => {
      const toneButton = document.createElement('button');
      toneButton.style.cssText = `
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #2c3e50;
        transition: background 0.2s ease;
        margin-bottom: 2px;
        text-align: left;
      `;

      toneButton.innerHTML = `
        <span style="margin-right: 12px; font-size: 16px;">${option.icon}</span>
        <span>${option.text}</span>
      `;

      toneButton.addEventListener('mouseenter', () => {
        toneButton.style.background = '#f5f3f0';
      });

      toneButton.addEventListener('mouseleave', () => {
        toneButton.style.background = 'transparent';
      });

      toneButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.log(`Reply tone selected: ${option.value}`);
        this.handleReplyGeneration(button, textarea, option.value);
        menu.remove();
      });

      menu.appendChild(toneButton);
    });

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = `
      height: 1px;
      background: #f0f0f0;
      margin: 8px 0;
    `;
    menu.appendChild(separator);

    // Settings section
    const settingsHeader = document.createElement('div');
    settingsHeader.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #7f8c8d;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    settingsHeader.textContent = 'Settings';
    menu.appendChild(settingsHeader);

    // Remember choice dropdown
    const rememberContainer = document.createElement('div');
    rememberContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
    `;

    const rememberLabel = document.createElement('span');
    rememberLabel.style.cssText = `
      font-size: 12px;
      color: #2c3e50;
      flex: 1;
    `;
    rememberLabel.textContent = 'Remember choice:';

    const rememberSelect = document.createElement('select');
    rememberSelect.style.cssText = `
      padding: 4px 8px;
      border: 1px solid #e1e8ed;
      border-radius: 6px;
      font-size: 12px;
      background: white;
      color: #2c3e50;
      cursor: pointer;
    `;

    const rememberOptions = [
      { value: 'ask', text: 'Always ask' },
      { value: 'neutral', text: '👍 Neutral' },
      { value: 'joke', text: '😂 Joke' },
      { value: 'support', text: '❤️ Support' },
      { value: 'idea', text: '💡 Idea' },
      { value: 'question', text: '❓ Question' }
    ];

    rememberOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      rememberSelect.appendChild(optionElement);
    });

    // Load current setting
    this.getSavedReplyTone().then(savedTone => {
      rememberSelect.value = savedTone || 'ask';
    });

    rememberSelect.addEventListener('change', (e) => {
      this.saveReplyTone(e.target.value);
      this.log(`Reply tone preference saved: ${e.target.value}`);
    });

    rememberContainer.appendChild(rememberLabel);
    rememberContainer.appendChild(rememberSelect);
    menu.appendChild(rememberContainer);

    // Position menu
    const buttonRect = button.getBoundingClientRect();
    let top = buttonRect.bottom + window.scrollY + 5;
    let left = buttonRect.left + window.scrollX;

    // Keep menu on screen
    if (left + 200 > window.innerWidth - 10) {
      left = window.innerWidth - 210;
    }
    if (top + 300 > window.innerHeight + window.scrollY - 10) {
      top = buttonRect.top + window.scrollY - 300;
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    document.body.appendChild(menu);

    // Animate in
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'translateY(0) scale(1)';
    });

    // Close menu when clicking outside
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && !button.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  async getSavedReplyTone() {
    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['replyTone'], (result) => {
          resolve(result.replyTone || 'ask');
        });
      });
    } catch (error) {
      this.log(`Error getting saved tone: ${error.message}`);
      return 'ask';
    }
  }

  saveReplyTone(tone) {
    try {
      chrome.storage.sync.set({ replyTone: tone });
      this.log(`Saved reply tone: ${tone}`);
    } catch (error) {
      this.log(`Error saving tone: ${error.message}`);
    }
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new XIntegration();
  });
} else {
  new XIntegration();
}