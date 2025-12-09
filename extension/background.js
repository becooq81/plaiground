// Background service worker - runs in the background

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  
  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation');
    chrome.storage.sync.set({ clickCount: 0 });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated');
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'buttonClicked') {
    console.log('Button clicked', request.count, 'times');
    // You can perform background tasks here
  }
  
  // Send response if needed
  sendResponse({ status: 'received' });
  return true; // Keep the message channel open for async response
});

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
    // You can perform actions when a page finishes loading
  }
});

// Example: Handle browser action click (if you want alternative behavior)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
  // This only fires if you don't have a default_popup in manifest
});

