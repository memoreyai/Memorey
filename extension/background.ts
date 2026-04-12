/// <reference types="chrome" />

// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Enable the side panel on all tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
