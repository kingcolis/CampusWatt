// about.js

const AboutPage = (() => {

  let dom = {};

  function resolveDOM() {
    dom = {
      healthDot:       document.getElementById('apiHealthDot'),
      healthStatus:    document.getElementById('apiHealthStatus'),
      statusVal:       document.getElementById('apiStatusVal'),
      backendVersion:  document.getElementById('backendVersion'),
      apiBase:         document.getElementById('apiBase'),
      apiUptime:       document.getElementById('apiUptime'),
      apiResponseTime: document.getElementById('apiResponseTime'),
      apiDocsLink:     document.getElementById('apiDocsLink'),
    };
  }

  async function init() {
    resolveDOM();
    populateStaticInfo();
    await checkHealth();
  }

  /* ══════════════════════════════════════════════════════════
     STATIC INFO
  ══════════════════════════════════════════════════════════ */
  function populateStaticInfo() {
    const base = CampusEnergyAPI.config?.BASE_URL || '/api/v1';
    if (dom.apiBase) dom.apiBase.textContent = base;
    if (dom.apiDocsLink) dom.apiDocsLink.href = base.replace(/\/v\d+$/, '/docs');
  }

  /* ══════════════════════════════════════════════════════════
     HEALTH CHECK
  ══════════════════════════════════════════════════════════ */
  async function checkHealth() {
    setStatus('checking', 'Checking…');

    const start = Date.now();
    try {
      const result = await CampusEnergyAPI.healthCheck();
      const ms     = Date.now() - start;

      setStatus('ok', 'All systems operational');

      if (dom.statusVal)       dom.statusVal.textContent = result.status || 'ok';
      if (dom.backendVersion)  dom.backendVersion.textContent = result.version || '—';
      if (dom.apiUptime)       dom.apiUptime.textContent = result.uptime != null ? `${Number(result.uptime).toFixed(2)}%` : '—';
      if (dom.apiResponseTime) dom.apiResponseTime.textContent = `${ms} ms`;
    } catch (err) {
      const ms = Date.now() - start;
      setStatus('error', 'Cannot reach backend');

      if (dom.statusVal)       dom.statusVal.textContent = 'unreachable';
      if (dom.backendVersion)  dom.backendVersion.textContent = '—';
      if (dom.apiUptime)       dom.apiUptime.textContent = '—';
      if (dom.apiResponseTime) dom.apiResponseTime.textContent = `${ms} ms (timeout)`;

      CE.toast('Backend is unreachable. Some features may be unavailable.', 'error');
    }
  }

  function setStatus(state, label) {
    if (dom.healthDot) {
      dom.healthDot.className = `health-dot ${state}`;
    }
    if (dom.healthStatus) {
      dom.healthStatus.textContent = label;
      dom.healthStatus.style.color = state === 'ok'
        ? 'var(--mint)'
        : state === 'error'
          ? 'var(--danger)'
          : 'var(--text-dim)';
    }
  }

  return { init };
})();

CE.initAll({ topbar: { active: 'about' }, onReady: AboutPage.init });
