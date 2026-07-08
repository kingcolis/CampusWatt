// about.js
// About page: API health, backend version, GitHub links, developer information

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// DOM refs - expected HTML structure
const DOM = {
    apiStatus: document.getElementById('api-status'),
    apiVersion: document.getElementById('api-version'),
    githubLink: document.getElementById('github-link'),
    devInfo: document.getElementById('dev-info'),
    serverTime: document.getElementById('server-time'),
};

// Health check
async function checkHealth() {
    try {
        const response = await CampusEnergyAPI.healthCheck();
        const status = response.status || 'ok';
        DOM.apiStatus.textContent = `✅ ${status.toUpperCase()}`;
        DOM.apiStatus.style.color = 'var(--success-color)';
        if (response.version) {
            DOM.apiVersion.textContent = `v${response.version}`;
        }
        if (response.timestamp) {
            const date = new Date(response.timestamp);
            DOM.serverTime.textContent = date.toLocaleString();
        }
    } catch (e) {
        DOM.apiStatus.textContent = '❌ OFFLINE';
        DOM.apiStatus.style.color = 'var(--error-color)';
        DOM.apiVersion.textContent = 'Unknown';
        console.error('Health check error:', e);
    }
}

// Set developer info
function setDevInfo() {
    // You can customize these
    DOM.devInfo.innerHTML = `
        <p><strong>CampusWatt</strong> - Machine Learning + Social Media for Campus Energy Analytics</p>
        <p>Built with ❤️ by the CampusWatt Team</p>
        <p>Version 2.0.0</p>
    `;
    DOM.githubLink.href = 'https://github.com/your-repo/campuswatt';
    DOM.githubLink.textContent = 'GitHub Repository';
}

// Init
async function init() {
    await checkHealth();
    setDevInfo();

    // CE.initAll
    CE.initAll({
        page: 'about',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
