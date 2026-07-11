const ProfilePage = (() => {

  async function init() {
    try {
      const user = await CampusEnergyAPI.getCurrentUser();
      if (!user) {
        CE.toast('Sign in to view your profile.', 'error');
        setTimeout(() => (window.location.href = 'login.html'), 900);
        return;
      }

      const isFaculty = user.userType === 'Faculty';
      const detailRows = isFaculty
        ? `<p class="meta-row"><b>Position:</b> ${user.position || '—'}</p>`
        : `<p class="meta-row"><b>Course:</b> ${user.course || '—'}</p>`;

      const content = document.getElementById('profileContent');
      content.innerHTML = `
        <div class="profile-head reveal is-visible">
          <div class="avatar-photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
          </div>
          <div style="flex-grow: 1;">
            <h1 class="profile-name">${user.username}</h1>
            <p class="meta-row"><b>Age:</b> ${user.age ?? '—'}</p>
            <p class="meta-row"><b>User Type:</b> ${user.userType}</p>
            ${detailRows}
          </div>
          <div>
            <button class="btn btn-ghost" id="logoutBtn" style="border-radius: 12px; padding: 10px 18px; font-size: 0.85rem;">
              Logout
            </button>
          </div>
        </div>
        <div class="panel about-box reveal is-visible" style="margin-bottom: 24px;">
          <h3>About</h3>
          <p>${user.about || 'No bio yet.'}</p>
        </div>
        <div class="panel reveal is-visible" style="padding: 24px;">
          <h3>Your Posts (<span id="postCount">0</span>)</h3>
          <div id="posts" style="margin-top: 14px;">
            Loading posts...
          </div>
        </div>
      `;

      // Set up logout button event listener
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          CampusEnergyAPI.logout();
          window.location.href = "login.html";
        };
      }

      // Load user posts
      try {
        const posts = await CampusEnergyAPI.getUserPosts(user.id);
        const postCountEl = document.getElementById("postCount");
        if (postCountEl) {
          postCountEl.textContent = posts.length;
        }

        const postsContainer = document.getElementById("posts");
        if (postsContainer) {
          if (posts.length === 0) {
            postsContainer.innerHTML = "<p style='color: var(--text-dim);'>No posts yet.</p>";
          } else {
            postsContainer.innerHTML = posts.map(post => `
              <div class="panel post" style="margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.06); padding: 16px;">
                <h4 style="margin-bottom: 6px; font-size: 1.05rem;">${post.title}</h4>
                <p style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 10px;">${post.body || post.content || ''}</p>
                <a href="post.html?id=${post.id}" style="font-size: 0.85rem; color: var(--mint); font-weight: 600;">
                  Open →
                </a>
              </div>
            `).join("");
          }
        }
      } catch (postErr) {
        console.error("Error fetching user posts:", postErr);
        const postsContainer = document.getElementById("posts");
        if (postsContainer) {
          postsContainer.innerHTML = "<p style='color: var(--rose-400);'>Could not load posts.</p>";
        }
      }

    } catch (err) {
      console.error('Error loading profile:', err);
      CE.toast('Failed to load profile. Please sign in again.', 'error');
      setTimeout(() => (window.location.href = 'login.html'), 1500);
    }
  }

  return {
    init
  };

})();

CE.initAll({
  topbar: {},
  onReady: ProfilePage.init
});