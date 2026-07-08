// index.js
// Landing page: health check, session detection, dashboard shortcut, latest posts preview

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// DOM refs - expected HTML structure
const DOM = {
    hero: document.getElementById('hero'),
    dashboardLink: document.getElementById('dashboard-link'),
    latestPosts: document.getElementById('latest-posts'),
    healthStatus: document.getElementById('health-status'),
    versionInfo: document.getElementById('version-info'),
    ctaBtn: document.getElementById('cta-btn'),
};

// Check session
async function checkSession() {
    try {
        const user = await CampusEnergyAPI.getCurrentUser();
        if (user && user.id) {
            // User is logged in, show dashboard link
            DOM.dashboardLink.style.display = 'inline-block';
            DOM.dashboardLink.href = '/posts.html';
            DOM.ctaBtn.textContent = 'Go to Feed';
            DOM.ctaBtn.href = '/posts.html';
        } else {
            DOM.dashboardLink.style.display = 'none';
            DOM.ctaBtn.textContent = 'Get Started';
            DOM.ctaBtn.href = '/signup.html';
        }
    } catch (e) {
        // Not logged in
        DOM.dashboardLink.style.display = 'none';
        DOM.ctaBtn.textContent = 'Get Started';
        DOM.ctaBtn.href = '/signup.html';
    }
}

// Health check
async function checkHealth() {
    try {
        const response = await CampusEnergyAPI.healthCheck();
        const status = response.status || 'ok';
        DOM.healthStatus.textContent = `✅ ${status}`;
        DOM.healthStatus.style.color = 'var(--success-color)';
        if (response.version) {
            DOM.versionInfo.textContent = `v${response.version}`;
        }
    } catch (e) {
        DOM.healthStatus.textContent = '❌ Unavailable';
        DOM.healthStatus.style.color = 'var(--error-color)';
        console.error('Health check failed:', e);
    }
}

// Load latest posts preview
async function loadLatestPosts() {
    try {
        const response = await CampusEnergyAPI.getPosts({ page: 0, limit: 3 });
        const posts = response.data || [];
        const container = DOM.latestPosts;
        container.innerHTML = '';

        if (posts.length === 0) {
            container.innerHTML = '<p>No posts yet. Be the first!</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'preview-post-card';
            card.innerHTML = `
                <div class="preview-post-content">${CE.escapeHtml ? CE.escapeHtml(post.content.substring(0, 100)) : post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}</div>
                <div class="preview-post-meta">
                    <span>${post.author?.displayName || 'Unknown'}</span>
                    <span>❤️ ${post.likeCount || 0}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                if (CampusEnergyAPI.getToken()) {
                    window.location.href = `/post.html?id=${post.id}`;
                } else {
                    window.location.href = `/login.html?redirect=/post.html?id=${post.id}`;
                }
            });
            container.appendChild(card);
        });
    } catch (e) {
        console.error('Failed to load preview posts:', e);
        DOM.latestPosts.innerHTML = '<p>Unable to load posts at this time.</p>';
    }
}

// Init
async function init() {
    await checkSession();
    await checkHealth();
    await loadLatestPosts();

    // If user logged in, redirect to posts? Or stay on landing? Usually landing is public.
    // We keep landing page, but show dashboard link.

    // CE.initAll
    CE.initAll({
        page: 'index',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
