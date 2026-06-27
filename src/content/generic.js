const BUTTON_ID = 'huntkit-analyze-btn';
const TRIGGER_ID = 'huntkit-sidebar-trigger';

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

        showSidebar();
        chrome.storage.local.set({ lastAnalysis: { ...response, jdData, analyzedAt: Date.now() } });
      }
    );
  });

  container.insertAdjacentElement('afterend', btn);
}

function showSidebar() {
  const s = document.getElementById('huntkit-root');
  if (!s) return;
  s.style.display = 'flex';
  chrome.storage.local.set({ sidebarWasOpen: true });
}

function toggleSidebar() {
  const s = document.getElementById('huntkit-root');
  if (!s) return;
  const visible = s.style.display !== 'none';
  s.style.display = visible ? 'none' : 'flex';
  chrome.storage.local.set({ sidebarWasOpen: !visible });
}

function injectSidebarIframe() {
  if (document.getElementById('huntkit-root')) return;
  const iframe = document.createElement('iframe');
  iframe.id = 'huntkit-root';
  iframe.src = chrome.runtime.getURL('src/sidebar/index.html');
  iframe.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    width: 380px;
    height: 100vh;
    border: none;
    z-index: 999999;
    display: none;
    box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(iframe);
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'HUNTKIT_CLOSE') {
      iframe.style.display = 'none';
      chrome.storage.local.set({ sidebarWasOpen: false });
    }
  });
}

export function injectSidebarTrigger() {
  injectSidebarIframe();
  if (document.getElementById(TRIGGER_ID)) return;

  const trigger = document.createElement('div');
  trigger.id = TRIGGER_ID;
  trigger.title = 'Open HuntKit';
  trigger.style.cssText = `
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    background: #6366f1;
    border-radius: 8px 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    z-index: 999998;
    cursor: pointer;
    box-shadow: -2px 0 8px rgba(99,102,241,0.5);
    user-select: none;
  `;
  trigger.textContent = '🎯';

  const tip = document.createElement('span');
  tip.textContent = 'Open HuntKit';
  tip.style.cssText = `
    position: fixed;
    background: #1e1b4b;
    color: #c7d2fe;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    border: 1px solid #4338ca;
    pointer-events: none;
    display: none;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  document.body.appendChild(tip);

  trigger.addEventListener('mouseenter', () => {
    const rect = trigger.getBoundingClientRect();
    tip.style.right = '40px';
    tip.style.top = `${rect.top + rect.height / 2}px`;
    tip.style.transform = 'translateY(-50%)';
    tip.style.display = 'block';
    trigger.style.opacity = '0.85';
  });
  trigger.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    trigger.style.opacity = '1';
  });
  trigger.addEventListener('click', toggleSidebar);

  document.body.appendChild(trigger);
}

export function showNewJobToast() {
  const id = 'huntkit-job-toast';
  document.getElementById(id)?.remove();

  const toast = document.createElement('div');
  toast.id = id;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 72px;
    padding: 12px 14px;
    background: #1e1b4b;
    color: #c7d2fe;
    border: 1px solid #4338ca;
    border-radius: 10px;
    font-size: 13px;
    z-index: 999998;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 300px;
  `;

  const content = document.createElement('div');
  content.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;';
  const ico = document.createElement('span');
  ico.style.cssText = 'font-size:16px;flex-shrink:0';
  ico.textContent = '🎯';
  const msg = document.createElement('span');
  msg.innerHTML = 'huntkit: <strong style="color:#a78bfa">New job detected</strong> — click to analyze';
  content.appendChild(ico);
  content.appendChild(msg);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none; border: none; color: #71717a; cursor: pointer;
    font-size: 16px; padding: 0; line-height: 1; flex-shrink: 0;
  `;

  toast.appendChild(content);
  toast.appendChild(closeBtn);

  content.addEventListener('click', () => {
    showSidebar();
    toast.remove();
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toast.remove();
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
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
