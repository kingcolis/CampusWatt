// index.js

const HomePage = (() => {

  let dom = {};

  function resolveDOM() {
    dom = {
      healthDot:     document.getElementById('healthDot'),
      healthLabel:   document.getElementById('healthLabel'),
      heroSignupBtn: document.getElementById('heroSignupBtn'),
      heroActions:   document.getElementById('heroActions'),
      ctaTitle:      document.getElementById('ctaTitle'),
      ctaBody:       document.getElementById('ctaBody'),
      ctaBtn:        document.getElementById('ctaBtn'),
      statPosts:     document.getElementById('statPosts'),
      latestList:    document.getElementById('latestPostsList'),
    };
  }

  async function init() {
    resolveDOM();

    // Run health check + session detect + posts in parallel
    const [user] = await Promise.all([
      CampusEnergyAPI.getCurrentUser().catch(() => null),
      runHealthCheck(),
      loadLatestPosts(),
    ]);

    if (user) adaptForAuthenticatedUser(user);
  }

  /* ══════════════════════════════════════════════════════════
     HEALTH CHECK
  ══════════════════════════════════════════════════════════ */
  async function runHealthCheck() {
    const start = Date.now();
    try {
      const result = await CampusEnergyAPI.healthCheck();
      const ms     = Date.now() - start;
      setHealth('ok', `API online · ${ms}ms`);
    } catch (_) {
      setHealth('error', 'API unreachable');
    }
  }

  function setHealth(status, label) {
    if (!dom.healthDot) return;
    dom.healthDot.className = `health-dot ${status}`;
    if (dom.healthLabel) dom.healthLabel.textContent = label;
  }

  /* ══════════════════════════════════════════════════════════
     LATEST POSTS PREVIEW
  ══════════════════════════════════════════════════════════ */
  async function loadLatestPosts() {
    try {
      const posts = await CampusEnergyAPI.getPosts();
      // stat counter
      if (dom.statPosts) dom.statPosts.textContent = posts.length.toLocaleString();

      const latest = posts.slice(0, 4);
      if (!dom.latestList) return;

      if (!latest.length) {
        dom.latestList.innerHTML = `<p style="color:var(--text-faint);font-size:0.9rem;">No posts yet.</p>`;
        return;
      }

      dom.latestList.innerHTML = latest.map(p => buildLatestItem(p)).join('');
      dom.latestList.querySelectorAll('.latest-post-item').forEach((el, i) => {
        el.style.animationDelay = `${i * 60}ms`;
        el.addEventListener('click', () => { window.location.href = `post.html?id=${el.dataset.id}`; });
      });
    } catch (_) {
      if (dom.latestList) dom.latestList.innerHTML = `<p style="color:var(--text-faint);font-size:0.9rem;">Could not load recent posts.</p>`;
    }
  }

  function buildLatestItem(post) {
    const title   = escHtml(post.title);
    const author  = escHtml(post.author);
    const date    = escHtml(post.date);
    return `
      <article class="panel latest-post-item card-hover reveal is-visible" data-id="${post.id}" style="animation:pageIn 400ms var(--ease) both;" tabindex="0" role="button" aria-label="Open ${title}">
        <div>
          <h4>${title}</h4>
          <div class="meta">${author} · ${date} · ⚡${post.likeCount ?? 0}</div>
        </div>
        <span class="latest-arrow">→</span>
      </article>`;
  }

  /* ══════════════════════════════════════════════════════════
     SESSION ADAPTATION
  ══════════════════════════════════════════════════════════ */
  function adaptForAuthenticatedUser(user) {
    // Swap hero CTA to go straight to the feed
    if (dom.heroSignupBtn) {
      dom.heroSignupBtn.textContent = 'Go to feed';
      dom.heroSignupBtn.href        = 'posts.html';
    }

    // Personalise the bottom CTA band
    if (dom.ctaTitle) dom.ctaTitle.textContent = `Welcome back, ${user.username}!`;
    if (dom.ctaBody)  dom.ctaBody.textContent  = 'Pick up where you left off — view the latest readings from campus.';
    if (dom.ctaBtn) {
      dom.ctaBtn.textContent = 'Browse the feed';
      dom.ctaBtn.href        = 'posts.html';
    }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init };
})();

CE.initAll({ topbar: { active: 'home' }, onReady: HomePage.init });
