const BUTTON_ID = 'huntkit-analyze-btn';

export function injectHuntKitButton({ container, jdData }) {
  if (!container || document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.textContent = '🎯 HuntKit Analyze';
  btn.style.cssText = `
    margin-left: 8px;
    padding: 6px 14px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    z-index: 9999;
  `;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Analyzing…';

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_JD', payload: { jdText: jdData.description } },
      (response) => {
        btn.disabled = false;
        btn.textContent = '🎯 HuntKit Analyze';

        if (chrome.runtime.lastError || response?.error) {
          showToast('HuntKit error: ' + (response?.error || chrome.runtime.lastError.message), 'error');
          return;
        }

        chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' });
        chrome.storage.local.set({ lastAnalysis: { ...response, jdData, analyzedAt: Date.now() } });
      }
    );
  });

  container.insertAdjacentElement('afterend', btn);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 18px;
    background: ${type === 'error' ? '#ef4444' : '#6366f1'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
