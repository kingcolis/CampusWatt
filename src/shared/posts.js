// posts.js

const PostsFeed = (() => {
  const PAGE_SIZE = 10;

  const state = {
    allPosts:      [],   // full list from API (or search results)
    rendered:      [],   // slice currently in DOM
    currentUser:   null,
    page:          0,
    hasMore:       true,
    loading:       false,
    searching:     false,
    searchQuery:   '',
    debounceTimer: null,
    pendingDeleteId: null,
  };

  /* ── DOM refs (resolved after CE.initAll fires onReady) ── */
  let dom = {};

  function resolveDOM() {
    dom = {
      list:            document.getElementById('postsList'),
      empty:           document.getElementById('emptyState'),
      emptyMsg:        document.getElementById('emptyMsg'),
      sentinel:        document.getElementById('scrollSentinel'),
      loadIndicator:   document.getElementById('loadMoreIndicator'),
      searchInput:     document.getElementById('searchInput'),
      searchClear:     document.getElementById('searchClearBtn'),
      newPostBtn:      document.getElementById('newPostBtn'),
      newPostSideBtn:  document.getElementById('newPostSideBtn'),
      refreshBtn:      document.getElementById('refreshBtn'),
      // create modal
      createModal:     document.getElementById('createModal'),
      createForm:      document.getElementById('createPostForm'),
      cTitleField:     document.getElementById('cTitleField'),
      cTitle:          document.getElementById('cTitle'),
      cInsightField:   document.getElementById('cInsightField'),
      cInsight:        document.getElementById('cInsight'),
      cDataField:      document.getElementById('cDataField'),
      cData:           document.getElementById('cData'),
      createSubmitBtn: document.getElementById('createSubmitBtn'),
      closeCreateModal:document.getElementById('closeCreateModal'),
      cancelCreateBtn: document.getElementById('cancelCreateBtn'),
      // edit modal
      editModal:       document.getElementById('editModal'),
      editForm:        document.getElementById('editPostForm'),
      editPostId:      document.getElementById('editPostId'),
      eTitleField:     document.getElementById('eTitleField'),
      eTitle:          document.getElementById('eTitle'),
      eInsightField:   document.getElementById('eInsightField'),
      eInsight:        document.getElementById('eInsight'),
      eDataField:      document.getElementById('eDataField'),
      eData:           document.getElementById('eData'),
      editSubmitBtn:   document.getElementById('editSubmitBtn'),
      closeEditModal:  document.getElementById('closeEditModal'),
      cancelEditBtn:   document.getElementById('cancelEditBtn'),
      // delete modal
      deleteModal:     document.getElementById('deleteModal'),
      confirmDeleteBtn:document.getElementById('confirmDeleteBtn'),
      cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
      closeDeleteModal:document.getElementById('closeDeleteModal'),
    };
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    resolveDOM();
    bindEvents();
    observeInfiniteScroll();

    state.currentUser = await CampusEnergyAPI.getCurrentUser().catch(() => null);
    if (state.currentUser) {
      dom.newPostBtn.style.display     = 'flex';
      dom.newPostSideBtn.style.display = 'block';
    }

    await loadPosts(true);
  }

  /* ══════════════════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════════════════ */
  function bindEvents() {
    // Search
    dom.searchInput.addEventListener('input', onSearchInput);
    dom.searchClear.addEventListener('click', clearSearch);
    dom.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') clearSearch();
    });

    // Refresh
    dom.refreshBtn.addEventListener('click', () => {
      if (state.searching) return;
      loadPosts(true);
    });

    // New post
    dom.newPostBtn.addEventListener('click', openCreateModal);
    dom.newPostSideBtn.addEventListener('click', openCreateModal);

    // Create modal
    dom.closeCreateModal.addEventListener('click', closeCreateModal);
    dom.cancelCreateBtn.addEventListener('click', closeCreateModal);
    dom.createModal.addEventListener('click', (e) => { if (e.target === dom.createModal) closeCreateModal(); });
    dom.createForm.addEventListener('submit', handleCreate);

    // Edit modal
    dom.closeEditModal.addEventListener('click', closeEditModal);
    dom.cancelEditBtn.addEventListener('click', closeEditModal);
    dom.editModal.addEventListener('click', (e) => { if (e.target === dom.editModal) closeEditModal(); });
    dom.editForm.addEventListener('submit', handleEdit);

    // Delete modal
    dom.closeDeleteModal.addEventListener('click', closeDeleteModal);
    dom.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    dom.deleteModal.addEventListener('click', (e) => { if (e.target === dom.deleteModal) closeDeleteModal(); });
    dom.confirmDeleteBtn.addEventListener('click', handleDelete);

    // Global keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.createModal.classList.contains('open')) closeCreateModal();
        if (dom.editModal.classList.contains('open'))   closeEditModal();
        if (dom.deleteModal.classList.contains('open')) closeDeleteModal();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     DATA LOADING
  ══════════════════════════════════════════════════════════ */
  async function loadPosts(reset = false) {
    if (state.loading) return;
    state.loading = true;

    if (reset) {
      state.page    = 0;
      state.hasMore = true;
      state.allPosts = [];
      state.rendered = [];
      showSkeletons();
    }

    try {
      let posts;
      if (state.searching && state.searchQuery) {
        posts = await CampusEnergyAPI.search(state.searchQuery);
        state.allPosts = posts;
        state.hasMore  = false;
      } else {
        posts = await CampusEnergyAPI.getPosts();
        state.allPosts = posts;
        state.hasMore  = false; // mock returns all; real API: set based on response length
      }
      renderPage(reset);
    } catch (err) {
      CE.toast(err.message || 'Failed to load posts.', 'error');
      if (reset) showEmpty('Could not load posts. Try refreshing.');
    } finally {
      state.loading = false;
    }
  }

  function renderPage(reset = false) {
    const start = state.page * PAGE_SIZE;
    const slice = state.allPosts.slice(start, start + PAGE_SIZE);

    if (reset) dom.list.innerHTML = '';

    if (slice.length === 0 && reset) {
      showEmpty(state.searching ? `No posts match "${state.searchQuery}".` : 'No posts yet. Be the first to share a reading.');
      return;
    }

    hideEmpty();
    slice.forEach((post, i) => {
      const card = buildCard(post);
      card.style.setProperty('--i', i);
      card.classList.add('reveal');
      dom.list.appendChild(card);
      requestAnimationFrame(() => card.classList.add('is-visible'));
    });

    state.rendered.push(...slice);
    state.page++;
    state.hasMore = state.rendered.length < state.allPosts.length;
    dom.loadIndicator.classList.toggle('visible', state.hasMore);
  }

  /* ══════════════════════════════════════════════════════════
     CARD RENDERING
  ══════════════════════════════════════════════════════════ */
  function buildCard(post) {
    const isOwner = state.currentUser && state.currentUser.id === post.authorId;

    const el = document.createElement('article');
    el.className = 'panel post-card card-hover';
    el.dataset.postId = post.id;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'article');
    el.setAttribute('aria-label', post.title);

    el.innerHTML = `
      <div class="post-card-header">
        <div>
          <div class="post-card-title">${escHtml(post.title)}</div>
          <div class="post-card-meta">${escHtml(post.author)} · ${escHtml(post.date)}</div>
        </div>
        <div class="post-card-actions" style="flex-shrink:0;">
          ${isOwner ? `
            <button class="card-icon-btn owner-btn edit-btn" data-id="${post.id}" title="Edit post" aria-label="Edit">✏</button>
            <button class="card-icon-btn owner-btn delete-btn" data-id="${post.id}" title="Delete post" aria-label="Delete">🗑</button>
          ` : ''}
        </div>
      </div>
      ${post.insight ? `<div class="post-card-insight">${escHtml(post.insight)}</div>` : ''}
      <div class="post-card-footer">
        <div class="post-card-stats">
          <span id="likestat-${post.id}">⚡ ${post.likeCount ?? 0}</span>
          <span>💬 ${post.commentCount ?? 0}</span>
          <span id="savestat-${post.id}">🔖 ${post.saveCount ?? 0}</span>
        </div>
        <div class="post-card-actions">
          ${state.currentUser ? `
            <button class="card-icon-btn like-btn ${post._liked ? 'active' : ''}" data-id="${post.id}" title="Like" aria-label="Like">⚡</button>
            <button class="card-icon-btn save-btn ${post._saved ? 'active' : ''}" data-id="${post.id}" title="Save" aria-label="Save">🔖</button>
          ` : ''}
          <button class="card-icon-btn open-btn" data-id="${post.id}" aria-label="Open post">Read →</button>
        </div>
      </div>
    `;

    // Event delegation on card
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) {
        navigateToPost(post.id);
        return;
      }
      e.stopPropagation();
      if (btn.classList.contains('open-btn'))   navigateToPost(post.id);
      if (btn.classList.contains('like-btn'))   handleLike(post.id, btn);
      if (btn.classList.contains('save-btn'))   handleSave(post.id, btn);
      if (btn.classList.contains('edit-btn'))   openEditModal(post.id);
      if (btn.classList.contains('delete-btn')) openDeleteModal(post.id);
    });

    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === el) {
        e.preventDefault();
        navigateToPost(post.id);
      }
    });

    return el;
  }

  function navigateToPost(id) {
    window.location.href = `post.html?id=${id}`;
  }

  /* ══════════════════════════════════════════════════════════
     SEARCH
  ══════════════════════════════════════════════════════════ */
  function onSearchInput(e) {
    const q = e.target.value.trim();
    dom.searchClear.classList.toggle('visible', q.length > 0);
    clearTimeout(state.debounceTimer);

    if (!q) {
      state.searching    = false;
      state.searchQuery  = '';
      loadPosts(true);
      return;
    }

    state.debounceTimer = setTimeout(async () => {
      state.searching   = true;
      state.searchQuery = q;
      await loadPosts(true);
    }, 340);
  }

  function clearSearch() {
    dom.searchInput.value = '';
    dom.searchClear.classList.remove('visible');
    state.searching   = false;
    state.searchQuery = '';
    loadPosts(true);
    dom.searchInput.focus();
  }

  /* ══════════════════════════════════════════════════════════
     INFINITE SCROLL
  ══════════════════════════════════════════════════════════ */
  function observeInfiniteScroll() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.hasMore && !state.loading) {
        renderPage(false);
      }
    }, { rootMargin: '200px' });
    io.observe(dom.sentinel);
  }

  /* ══════════════════════════════════════════════════════════
     LIKE / SAVE (optimistic)
  ══════════════════════════════════════════════════════════ */
  async function handleLike(postId, btn) {
    if (!state.currentUser) { CE.toast('Sign in to like posts.', 'error'); return; }
    const wasActive = btn.classList.contains('active');
    const statEl    = document.getElementById(`likestat-${postId}`);
    const post      = state.allPosts.find(p => p.id === postId);

    // Optimistic
    btn.classList.toggle('active', !wasActive);
    if (post) {
      post.likeCount = Math.max(0, (post.likeCount || 0) + (wasActive ? -1 : 1));
      post._liked    = !wasActive;
      if (statEl) statEl.textContent = `⚡ ${post.likeCount}`;
    }

    try {
      if (wasActive) {
        await CampusEnergyAPI.unlikePost(postId);
      } else {
        await CampusEnergyAPI.likePost(postId);
        CE.toast('Post liked!', 'success', 1800);
      }
    } catch (err) {
      // Revert on failure
      btn.classList.toggle('active', wasActive);
      if (post) {
        post.likeCount = Math.max(0, (post.likeCount || 0) + (wasActive ? 1 : -1));
        post._liked    = wasActive;
        if (statEl) statEl.textContent = `⚡ ${post.likeCount}`;
      }
      CE.toast(err.message || 'Could not update like.', 'error');
    }
  }

  async function handleSave(postId, btn) {
    if (!state.currentUser) { CE.toast('Sign in to save posts.', 'error'); return; }
    const wasActive = btn.classList.contains('active');
    const statEl    = document.getElementById(`savestat-${postId}`);
    const post      = state.allPosts.find(p => p.id === postId);

    // Optimistic
    btn.classList.toggle('active', !wasActive);
    if (post) {
      post.saveCount = Math.max(0, (post.saveCount || 0) + (wasActive ? -1 : 1));
      post._saved    = !wasActive;
      if (statEl) statEl.textContent = `🔖 ${post.saveCount}`;
    }

    try {
      if (wasActive) {
        await CampusEnergyAPI.unsavePost(postId);
        CE.toast('Removed from saved.', 'success', 1800);
      } else {
        await CampusEnergyAPI.savePost(postId);
        CE.toast('Post saved!', 'success', 1800);
      }
    } catch (err) {
      btn.classList.toggle('active', wasActive);
      if (post) {
        post.saveCount = Math.max(0, (post.saveCount || 0) + (wasActive ? 1 : -1));
        post._saved    = wasActive;
        if (statEl) statEl.textContent = `🔖 ${post.saveCount}`;
      }
      CE.toast(err.message || 'Could not update save.', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     CREATE MODAL
  ══════════════════════════════════════════════════════════ */
  function openCreateModal() {
    if (!state.currentUser) {
      CE.toast('Sign in to create posts.', 'error');
      setTimeout(() => (window.location.href = 'login.html'), 800);
      return;
    }
    dom.createForm.reset();
    [dom.cTitleField, dom.cInsightField, dom.cDataField].forEach(f => {
      f.classList.remove('invalid', 'valid');
    });
    openModal(dom.createModal);
    dom.cTitle.focus();
  }

  function closeCreateModal() { closeModal(dom.createModal); }

  async function handleCreate(e) {
    e.preventDefault();
    const title   = dom.cTitle.value.trim();
    const insight = dom.cInsight.value.trim();
    const rawData = dom.cData.value.trim();
    const data    = parseDataPoints(rawData);

    const titleOk   = title.length > 0;
    const insightOk = insight.length > 0;
    const dataOk    = data !== null && data.length >= 2;

    CE.validateField(dom.cTitleField, titleOk, 'Title is required.');
    CE.validateField(dom.cInsightField, insightOk, 'Please add a note.');
    CE.validateField(dom.cDataField, dataOk, 'Enter at least 2 numeric values separated by commas.');
    if (!titleOk || !insightOk || !dataOk) return;

    CE.setButtonLoading(dom.createSubmitBtn, true);
    try {
      const post = await CampusEnergyAPI.createPost({ title, insight, data });
      // Optimistic prepend
      state.allPosts.unshift({ ...post, likeCount: 0, saveCount: 0, commentCount: 0 });
      dom.list.prepend(buildCard(state.allPosts[0]));
      hideEmpty();
      closeCreateModal();
      CE.toast('Post published!', 'success');
    } catch (err) {
      CE.toast(err.message || 'Could not create post.', 'error');
    } finally {
      CE.setButtonLoading(dom.createSubmitBtn, false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════════════════════════ */
  function openEditModal(postId) {
    const post = state.allPosts.find(p => p.id === postId);
    if (!post) return;
    dom.editPostId.value = postId;
    dom.eTitle.value     = post.title;
    dom.eInsight.value   = post.insight || '';
    dom.eData.value      = Array.isArray(post.data) ? post.data.join(', ') : '';
    [dom.eTitleField, dom.eInsightField, dom.eDataField].forEach(f => {
      f.classList.remove('invalid', 'valid');
    });
    openModal(dom.editModal);
    dom.eTitle.focus();
  }

  function closeEditModal() { closeModal(dom.editModal); }

  async function handleEdit(e) {
    e.preventDefault();
    const id      = dom.editPostId.value;
    const title   = dom.eTitle.value.trim();
    const insight = dom.eInsight.value.trim();
    const rawData = dom.eData.value.trim();
    const data    = parseDataPoints(rawData);

    const titleOk   = title.length > 0;
    const insightOk = insight.length > 0;
    const dataOk    = data !== null && data.length >= 2;

    CE.validateField(dom.eTitleField, titleOk, 'Title is required.');
    CE.validateField(dom.eInsightField, insightOk, 'Please add a note.');
    CE.validateField(dom.eDataField, dataOk, 'Enter at least 2 numeric values.');
    if (!titleOk || !insightOk || !dataOk) return;

    CE.setButtonLoading(dom.editSubmitBtn, true);
    const cardEl = dom.list.querySelector(`[data-post-id="${id}"]`);

    // Optimistic DOM update
    const post = state.allPosts.find(p => p.id === id);
    let snapshot;
    if (post) {
      snapshot = { title: post.title, insight: post.insight, data: post.data };
      Object.assign(post, { title, insight, data });
      if (cardEl) {
        cardEl.querySelector('.post-card-title').textContent = title;
        const insightEl = cardEl.querySelector('.post-card-insight');
        if (insightEl) insightEl.textContent = insight;
      }
    }

    try {
      await CampusEnergyAPI.updatePost(id, { title, insight, data });
      closeEditModal();
      CE.toast('Post updated.', 'success');
    } catch (err) {
      // Revert
      if (post && snapshot) {
        Object.assign(post, snapshot);
        if (cardEl) {
          cardEl.querySelector('.post-card-title').textContent = snapshot.title;
          const insightEl = cardEl.querySelector('.post-card-insight');
          if (insightEl) insightEl.textContent = snapshot.insight;
        }
      }
      CE.toast(err.message || 'Could not update post.', 'error');
    } finally {
      CE.setButtonLoading(dom.editSubmitBtn, false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     DELETE MODAL
  ══════════════════════════════════════════════════════════ */
  function openDeleteModal(postId) {
    state.pendingDeleteId = postId;
    openModal(dom.deleteModal);
  }

  function closeDeleteModal() {
    state.pendingDeleteId = null;
    closeModal(dom.deleteModal);
  }

  async function handleDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;

    CE.setButtonLoading(dom.confirmDeleteBtn, true);

    // Optimistic removal
    const idx    = state.allPosts.findIndex(p => p.id === id);
    const cardEl = dom.list.querySelector(`[data-post-id="${id}"]`);
    let removed;
    if (idx !== -1) {
      removed = state.allPosts.splice(idx, 1)[0];
    }
    if (cardEl) {
      cardEl.style.transition = 'opacity 220ms, transform 220ms';
      cardEl.style.opacity    = '0';
      cardEl.style.transform  = 'translateX(-8px)';
      setTimeout(() => cardEl.remove(), 220);
    }
    if (state.allPosts.length === 0) showEmpty('No posts yet.');

    try {
      await CampusEnergyAPI.deletePost(id);
      closeDeleteModal();
      CE.toast('Post deleted.', 'success');
    } catch (err) {
      // Revert
      if (removed) state.allPosts.splice(idx, 0, removed);
      if (cardEl) { cardEl.style.opacity = '1'; cardEl.style.transform = 'none'; }
      hideEmpty();
      CE.toast(err.message || 'Could not delete post.', 'error');
    } finally {
      CE.setButtonLoading(dom.confirmDeleteBtn, false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     MODAL HELPERS
  ══════════════════════════════════════════════════════════ */
  function openModal(overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ══════════════════════════════════════════════════════════
     UI STATE HELPERS
  ══════════════════════════════════════════════════════════ */
  function showSkeletons() {
    dom.list.innerHTML = Array.from({ length: 4 }, () =>
      `<div class="panel skel" style="height:100px;border-radius:18px;margin-bottom:14px;"></div>`
    ).join('');
    hideEmpty();
  }

  function showEmpty(msg) {
    if (msg && dom.emptyMsg) dom.emptyMsg.textContent = msg;
    dom.empty.classList.add('visible');
    dom.list.innerHTML = '';
  }

  function hideEmpty() {
    dom.empty.classList.remove('visible');
  }

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */
  function parseDataPoints(raw) {
    if (!raw) return null;
    const nums = raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    return nums.length >= 2 ? nums : null;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { init };
})();

CE.initAll({ topbar: { active: 'posts' }, onReady: PostsFeed.init });
