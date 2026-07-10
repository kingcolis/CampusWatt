// profile.js

const ProfilePage = (() => {

  const state = {
    currentUser:   null,
    profileUser:   null,
    isOwnProfile:  false,
    activeTab:     'posts',
    userPosts:     [],
    savedPosts:    [],
    postPage:      0,
    postPageSize:  8,
    hasMorePosts:  true,
  };

  let dom = {};

  function resolveDOM() {
    dom = {
      skeleton:          document.getElementById('profileSkeleton'),
      header:            document.getElementById('profileHeader'),
      username:          document.getElementById('profileUsername'),
      typeBadge:         document.getElementById('userTypeBadge'),
      statPosts:         document.getElementById('statPosts'),
      statSaved:         document.getElementById('statSaved'),
      statSavedLbl:      document.getElementById('statSavedLbl'),
      profileMeta:       document.getElementById('profileMeta'),
      profileActions:    document.getElementById('profileActions'),
      profileAbout:      document.getElementById('profileAbout'),
      // tabs
      tabBtnPosts:       document.getElementById('tabBtnPosts'),
      tabBtnSaved:       document.getElementById('tabBtnSaved'),
      tabPosts:          document.getElementById('tabPosts'),
      tabSaved:          document.getElementById('tabSaved'),
      userPostsList:     document.getElementById('userPostsList'),
      userPostsEmpty:    document.getElementById('userPostsEmpty'),
      savedPostsList:    document.getElementById('savedPostsList'),
      savedEmpty:        document.getElementById('savedEmpty'),
      loadMorePostsBtn:  document.getElementById('loadMorePostsBtn'),
      postsLoadMore:     document.getElementById('postsLoadMore'),
      // sidebar logout
      logoutSideBtn:     document.getElementById('logoutSideBtn'),
      // edit profile modal
      editProfileModal:  document.getElementById('editProfileModal'),
      editProfileForm:   document.getElementById('editProfileForm'),
      editAge:           document.getElementById('editAge'),
      editAbout:         document.getElementById('editAbout'),
      editCourseField:   document.getElementById('editCourseField'),
      editCourse:        document.getElementById('editCourse'),
      editPositionField: document.getElementById('editPositionField'),
      editPosition:      document.getElementById('editPosition'),
      saveProfileBtn:    document.getElementById('saveProfileBtn'),
      closeEditProfile:  document.getElementById('closeEditProfile'),
      cancelEditProfile: document.getElementById('cancelEditProfile'),
    };
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    resolveDOM();
    bindEvents();

    state.currentUser = await CampusEnergyAPI.getCurrentUser().catch(() => null);

    // Determine whose profile to show
    const params        = new URLSearchParams(location.search);
    const requestedUser = params.get('user');

    if (requestedUser) {
      // Viewing another user's profile (or own via direct URL)
      await loadOtherProfile(requestedUser);
    } else {
      // Default: own profile
      if (!state.currentUser) {
        CE.toast('Sign in to view your profile.', 'error');
        setTimeout(() => (window.location.href = 'login.html'), 900);
        return;
      }
      await loadOwnProfile();
    }
  }

  /* ══════════════════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════════════════ */
  function bindEvents() {
    // Tabs
    dom.tabBtnPosts.addEventListener('click', () => switchTab('posts'));
    dom.tabBtnSaved.addEventListener('click', () => switchTab('saved'));
    // Load more
    dom.loadMorePostsBtn.addEventListener('click', loadMorePosts);
    // Sidebar logout
    dom.logoutSideBtn.addEventListener('click', handleLogout);
    // Edit modal
    dom.closeEditProfile.addEventListener('click', closeEditModal);
    dom.cancelEditProfile.addEventListener('click', closeEditModal);
    dom.editProfileModal.addEventListener('click', (e) => { if (e.target === dom.editProfileModal) closeEditModal(); });
    dom.editProfileForm.addEventListener('submit', handleEditProfileSave);
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.editProfileModal.classList.contains('open')) closeEditModal();
    });
  }

  /* ══════════════════════════════════════════════════════════
     LOAD PROFILES
  ══════════════════════════════════════════════════════════ */
  async function loadOwnProfile() {
    state.profileUser  = state.currentUser;
    state.isOwnProfile = true;
    document.title     = `${state.currentUser.username} — CampusEnergy`;

    const [posts, saved] = await Promise.all([
      CampusEnergyAPI.getPosts().then(all => all.filter(p => p.authorId === state.currentUser.id)).catch(() => []),
      CampusEnergyAPI.getSaved().catch(() => []),
    ]);

    state.userPosts  = posts;
    state.savedPosts = saved;

    renderProfileHeader();
    renderUserPosts();
    renderSavedPosts();
    showProfile();
  }

  async function loadOtherProfile(username) {
    try {
      const profileUser = await CampusEnergyAPI.getUser(username);
      state.profileUser  = profileUser;
      state.isOwnProfile = state.currentUser && state.currentUser.username === username;
      document.title     = `${profileUser.username} — CampusEnergy`;

      if (state.isOwnProfile) {
        const [posts, saved] = await Promise.all([
          CampusEnergyAPI.getPosts().then(all => all.filter(p => p.authorId === profileUser.id)).catch(() => []),
          CampusEnergyAPI.getSaved().catch(() => []),
        ]);
        state.userPosts  = posts;
        state.savedPosts = saved;
        renderSavedPosts();
      } else {
        const posts = await CampusEnergyAPI.getPosts().then(all => all.filter(p => p.authorId === profileUser.id)).catch(() => []);
        state.userPosts = posts;
      }

      renderProfileHeader();
      renderUserPosts();
      showProfile();
    } catch (err) {
      CE.toast(err.message || 'Could not load profile.', 'error');
      showProfile(); // reveal shell even on error
    }
  }

  /* ══════════════════════════════════════════════════════════
     RENDER HEADER
  ══════════════════════════════════════════════════════════ */
  function renderProfileHeader() {
    const { profileUser, isOwnProfile, currentUser } = state;
    if (!profileUser) return;

    dom.username.textContent = profileUser.username;

    // Badge
    const isFaculty = profileUser.userType === 'Faculty';
    dom.typeBadge.textContent  = profileUser.userType || 'Member';
    dom.typeBadge.className    = `badge ${isFaculty ? 'badge-faculty' : 'badge-student'}`;

    // Stats
    dom.statPosts.textContent = state.userPosts.length;

    if (isOwnProfile) {
      dom.statSaved.textContent      = state.savedPosts.length;
      dom.statSaved.style.display    = 'block';
      dom.statSavedLbl.style.display = 'block';
    }

    // Meta
    const extraMeta = isFaculty
      ? `Position: ${profileUser.position || '—'}`
      : `Course: ${profileUser.course || '—'}`;
    dom.profileMeta.textContent = `Age: ${profileUser.age ?? '—'} · ${extraMeta}`;

    // About
    dom.profileAbout.textContent = profileUser.about || 'No bio yet.';

    // Action buttons
    dom.profileActions.innerHTML = '';
    if (isOwnProfile) {
      const editBtn = document.createElement('button');
      editBtn.className   = 'btn btn-ghost';
      editBtn.style.padding = '9px 18px';
      editBtn.textContent = '✏ Edit Profile';
      editBtn.addEventListener('click', openEditModal);
      dom.profileActions.appendChild(editBtn);

      const logoutBtn = document.createElement('button');
      logoutBtn.className   = 'btn btn-ghost';
      logoutBtn.style.padding = '9px 18px';
      logoutBtn.style.color   = 'var(--text-faint)';
      logoutBtn.textContent = 'Sign out';
      logoutBtn.addEventListener('click', handleLogout);
      dom.profileActions.appendChild(logoutBtn);

      // Show tabs
      dom.tabBtnSaved.style.display = 'block';
      dom.logoutSideBtn.style.display = 'block';
    } else if (currentUser) {
      const followBtn = document.createElement('button');
      followBtn.className = 'btn btn-primary';
      followBtn.style.padding = '9px 18px';
      followBtn.textContent = 'Follow';
      followBtn.id = 'followBtn';
      followBtn.addEventListener('click', () => handleFollow(followBtn));
      dom.profileActions.appendChild(followBtn);
    }

    // Edit modal defaults
    if (isOwnProfile) {
      dom.editAge.value        = profileUser.age || '';
      dom.editAbout.value      = profileUser.about || '';
      dom.editCourse.value     = profileUser.course || '';
      dom.editPosition.value   = profileUser.position || '';
      if (isFaculty) {
        dom.editPositionField.style.display = 'block';
        dom.editCourseField.style.display   = 'none';
      } else {
        dom.editCourseField.style.display   = 'block';
        dom.editPositionField.style.display = 'none';
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     RENDER POSTS
  ══════════════════════════════════════════════════════════ */
  function renderUserPosts() {
    dom.userPostsList.innerHTML = '';
    const initial = state.userPosts.slice(0, state.postPageSize);
    state.postPage = 1;

    if (initial.length === 0) {
      dom.userPostsEmpty.classList.add('visible');
      dom.loadMorePostsBtn.style.display = 'none';
      return;
    }

    dom.userPostsEmpty.classList.remove('visible');
    initial.forEach(p => dom.userPostsList.appendChild(buildPostCard(p)));
    state.hasMorePosts = state.userPosts.length > state.postPageSize;
    dom.loadMorePostsBtn.style.display = state.hasMorePosts ? 'inline-flex' : 'none';
  }

  function loadMorePosts() {
    const start = state.postPage * state.postPageSize;
    const slice = state.userPosts.slice(start, start + state.postPageSize);
    if (!slice.length) { dom.loadMorePostsBtn.style.display = 'none'; return; }
    slice.forEach(p => dom.userPostsList.appendChild(buildPostCard(p)));
    state.postPage++;
    const hasMore = (state.postPage * state.postPageSize) < state.userPosts.length;
    dom.loadMorePostsBtn.style.display = hasMore ? 'inline-flex' : 'none';
  }

  function renderSavedPosts() {
    dom.savedPostsList.innerHTML = '';
    if (!state.savedPosts.length) {
      dom.savedEmpty.classList.add('visible');
      return;
    }
    dom.savedEmpty.classList.remove('visible');
    state.savedPosts.forEach(p => dom.savedPostsList.appendChild(buildPostCard(p)));
  }

  function buildPostCard(post) {
    const el = document.createElement('article');
    el.className = 'panel post-card card-hover';
    el.setAttribute('tabindex', '0');
    el.innerHTML = `
      <div class="post-card-header">
        <div>
          <div class="post-card-title">${escHtml(post.title)}</div>
          <div class="post-card-meta">${escHtml(post.date)}</div>
        </div>
        <span style="color:var(--text-faint)">→</span>
      </div>
      ${post.insight ? `<div class="post-card-insight">${escHtml(post.insight)}</div>` : ''}
      <div class="post-card-stats">
        <span>⚡ ${post.likeCount ?? 0}</span>
        <span>💬 ${post.commentCount ?? 0}</span>
      </div>
    `;
    el.addEventListener('click', () => { window.location.href = `post.html?id=${post.id}`; });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = `post.html?id=${post.id}`; } });
    return el;
  }

  /* ══════════════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════════════ */
  function switchTab(tab) {
    state.activeTab = tab;
    [dom.tabBtnPosts, dom.tabBtnSaved].forEach(b => b.classList.remove('active'));
    [dom.tabPosts, dom.tabSaved].forEach(p => p.classList.remove('active'));
    if (tab === 'posts') {
      dom.tabBtnPosts.classList.add('active');
      dom.tabPosts.classList.add('active');
    } else {
      dom.tabBtnSaved.classList.add('active');
      dom.tabSaved.classList.add('active');
    }
  }

  /* ══════════════════════════════════════════════════════════
     FOLLOW (stub — real endpoint not in spec, but wired)
  ══════════════════════════════════════════════════════════ */
  function handleFollow(btn) {
    const following = btn.dataset.following === 'true';
    btn.dataset.following = String(!following);
    btn.textContent = !following ? 'Following' : 'Follow';
    btn.classList.toggle('btn-primary', following);
    btn.classList.toggle('btn-ghost', !following);
    CE.toast(!following ? 'You are now following this user.' : 'Unfollowed.', 'success', 1800);
  }

  /* ══════════════════════════════════════════════════════════
     EDIT PROFILE MODAL
  ══════════════════════════════════════════════════════════ */
  function openEditModal() {
    dom.editProfileModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    dom.editAge.focus();
  }

  function closeEditModal() {
    dom.editProfileModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function handleEditProfileSave(e) {
    e.preventDefault();
    CE.setButtonLoading(dom.saveProfileBtn, true);

    const isFaculty = state.profileUser?.userType === 'Faculty';
    const updates = {
      age:      parseInt(dom.editAge.value, 10) || null,
      about:    dom.editAbout.value.trim(),
      course:   !isFaculty ? dom.editCourse.value.trim() : undefined,
      position: isFaculty  ? dom.editPosition.value.trim() : undefined,
    };

    // Optimistic DOM
    const snapshot = { ...state.profileUser };
    Object.assign(state.profileUser, updates);
    dom.profileAbout.textContent = updates.about || 'No bio yet.';
    const meta = isFaculty
      ? `Age: ${updates.age ?? '—'} · Position: ${updates.position || '—'}`
      : `Age: ${updates.age ?? '—'} · Course: ${updates.course || '—'}`;
    dom.profileMeta.textContent = meta;

    try {
      // Real endpoint: PUT /users/me (not in spec, but standard — graceful no-op if absent)
      // await CampusEnergyAPI.updateMe(updates);
      // Mock: persist in session
      const session = CampusEnergyAPI.readSession();
      if (session) {
        Object.assign(session.user, updates);
        try { sessionStorage.setItem('ce_session', JSON.stringify(session)); } catch (_) {}
      }
      closeEditModal();
      CE.toast('Profile updated.', 'success');
    } catch (err) {
      Object.assign(state.profileUser, snapshot);
      dom.profileAbout.textContent = snapshot.about || 'No bio yet.';
      CE.toast(err.message || 'Could not save profile.', 'error');
    } finally {
      CE.setButtonLoading(dom.saveProfileBtn, false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     LOGOUT
  ══════════════════════════════════════════════════════════ */
  async function handleLogout() {
    try {
      await CampusEnergyAPI.logout();
      CE.toast('Signed out.', 'success', 1200);
      setTimeout(() => (window.location.href = 'index.html'), 500);
    } catch (err) {
      CE.toast(err.message || 'Could not sign out.', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     VISIBILITY
  ══════════════════════════════════════════════════════════ */
  function showProfile() {
    dom.skeleton.style.display = 'none';
    dom.header.style.display   = 'block';
  }

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init };
})();

CE.initAll({ topbar: { active: '' }, onReady: ProfilePage.init });
