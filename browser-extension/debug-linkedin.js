// Debug script to check LinkedIn DOM structure
// Run this in the browser console on LinkedIn to see what selectors are available

console.log("=== LinkedIn DOM Debug ===");

// Check for comment boxes
console.log("Comment boxes:");
const commentBoxes = document.querySelectorAll('[data-test-id*="comment"], .comments-comment-box, [aria-label*="comment" i], [placeholder*="comment" i]');
console.log("Found", commentBoxes.length, "comment-related elements:");
commentBoxes.forEach((box, i) => {
  console.log(`  ${i+1}:`, box.className, box.tagName, box.getAttribute('data-test-id'));
});

// Check for emoji buttons
console.log("\nEmoji buttons:");
const emojiButtons = document.querySelectorAll('[aria-label*="emoji" i], .emoji, [data-test-id*="emoji"]');
console.log("Found", emojiButtons.length, "emoji-related elements:");
emojiButtons.forEach((btn, i) => {
  console.log(`  ${i+1}:`, btn.className, btn.tagName, btn.getAttribute('aria-label'));
});

// Check for text editors
console.log("\nText editors:");
const editors = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
console.log("Found", editors.length, "editable elements:");
editors.forEach((editor, i) => {
  console.log(`  ${i+1}:`, editor.className, editor.tagName, editor.getAttribute('role'));
});

// Check for post content
console.log("\nPost content:");
const posts = document.querySelectorAll('[data-test-id*="post"], .feed-shared-update, .update-components-text');
console.log("Found", posts.length, "post-related elements:");
posts.forEach((post, i) => {
  console.log(`  ${i+1}:`, post.className, post.tagName, post.getAttribute('data-test-id'));
});

// Check current URL
console.log("\nCurrent URL:", window.location.href);
console.log("Is LinkedIn:", window.location.hostname.includes('linkedin.com'));