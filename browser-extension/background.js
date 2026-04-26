// background.js
let globalPudgeState = {
  mood: 'idle',
  isActive: false
};

// Poll the backend here instead of in the content script
async function pollBackend() {
  try {
    const res = await fetch('http://127.0.0.1:8000/state');
    const data = await res.json();
    globalPudgeState = data;
    
    // Broadcast the state to all open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'PUDGE_UPDATE', state: data }, () => {
          void chrome.runtime.lastError; // suppress "no receiver" errors for tabs without content scripts
        });
      });
    });
  } catch {
    // backend not running — ignore, will retry on next interval
  }
}

// Listen for keep-alive pings to prevent the service worker from suspending
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'KEEP_ALIVE') {
    pollBackend();
    sendResponse({ status: 'ok' });
  }
});

setInterval(pollBackend, 2000);