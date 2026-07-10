// post.js

const PostDetail = (() => {

  const state = {
    post:        null,
    comments:    [],
    currentUser: null,
    liked:       false,
    saved:       false,
    likeCount:   0,
    postId:      null,
  };

  let dom = {};

  function resolveDOM() {
    dom = {
      skeleton:         document.getElementById('postSkeleton'),
      content:          document.getElementById('postContent'),
      errorBlock:       document.getElementById('postError'),
      // meta
      postTitle:        document.getElementById('postTitle'),
      postAuthor:       document.getElementById('postAuthor'),
      postDate:         document.getElementById('postDate'),
      // actions
      likeBtn:          document.getElementById('likeBtn'),
      likeCount:        document.getElementById('likeCount'),
      saveBtn:          document.getElementById('saveBtn'),
      saveLabel:        document.getElementById('saveLabel'),
      shareBtn:         document.getElementById('shareBtn'),
      ownerActions:     document.getElementById('ownerActions'),
      editPostBtn:      document.getElementById('editPostBtn'),
      deletePostBtn:    document.getElementById('deletePostBtn'),
      // chart / insight
      chartTitle:       document.getElementById('chartTitle'),
      chartPanel:       document.getElementById('chartPanel'),
      insightBox:       document.getElementById('insightBox'),
      // comments
      commentsSection:  document.getElementById('commentsSection'),
      commentCountBadge:document.getElementById('commentCountBadge'),
      commentLoginPrompt:document.getElementById('commentLoginPrompt'),
      commentForm:      document.getElementById('commentForm'),
      commentInput:     document.getElementById('commentInput'),
      commentSubmitBtn: document.getElementById('commentSubmitBtn'),
      commentsList:     document.getElementById('commentsList'),
      commentsEmpty:    document.getElementById('commentsEmpty'),
      // edit modal
      editPostModal:    document.getElementById('editPostModal'),
      editPostForm:     document.getElementById('editPostForm'),
      epTitleField:     document.getElementById('epTitleField'),
      epTitle:          document.getElementById('epTitle'),
      epInsightField:   document.getElementById('epInsightField'),
      epInsight:        document.getElementById('epInsight'),
      epDataField:      document.getElementById('epDataField'),
      epData:           document.getElementById('epData'),
      editPostSubmitBtn:document.getElementById('editPostSubmitBtn'),
      closeEditPostModal:document.getElementById('closeEditPostModal'),
      cancelEditPostBtn:document.getElementById('cancelEditPostBtn'),
      // delete modal
      deletePostModal:  document.getElementById('deletePostModal'),
      confirmDeletePostBtn:document.getElementById('confirmDeletePostBtn'),
      cancelDeletePostBtn:document.getElementById('cancelDeletePostBtn'),
      closeDeletePostModal:document.getElementById('closeDeletePostModal'),
    };
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    resolveDOM();

    const params = new URLSearchParams(location.search);
    state.postId = params.get('id');
    if (!state.postId) {
      window.location.href = 'posts.html';
      return;
    }

    bindStaticEvents();

    // Load user + post in parallel
    const [user] = await Promise.all([
      CampusEnergyAPI.getCurrentUser().catch(() => null),
    ]);
    state.currentUser = user;

    await loadPost();
  }

  /* ══════════════════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════════════════ */
  function bindStaticEvents() {
    // Like
    dom.likeBtn.addEventListener('click', toggleLike);
    // Save
    dom.saveBtn.addEventListener('click', toggleSave);
    // Share
    dom.shareBtn.addEventListener('click', sharePost);
    // Edit / Delete (owner)
    dom.editPostBtn.addEventListener('click', openEditModal);
    dom.deletePostBtn.addEventListener('click', openDeleteModal);
    // Comment form
    dom.commentForm.addEventListener('submit', submitComment);
    // Edit modal
    dom.closeEditPostModal.addEventListener('click', closeEditModal);
    dom.cancelEditPostBtn.addEventListener('click', closeEditModal);
    dom.editPostModal.addEventListener('click', (e) => { if (e.target === dom.editPostModal) closeEditModal(); });
    dom.editPostForm.addEventListener('submit', handleEditSubmit);
    // Delete modal
    dom.closeDeletePostModal.addEventListener('click', closeDeleteModal);
    dom.cancelDeletePostBtn.addEventListener('click', closeDeleteModal);
    dom.deletePostModal.addEventListener('click', (e) => { if (e.target === dom.deletePostModal) closeDeleteModal(); });
    dom.confirmDeletePostBtn.addEventListener('click', handleDeleteConfirm);
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.editPostModal.classList.contains('open'))   closeEditModal();
        if (dom.deletePostModal.classList.contains('open')) closeDeleteModal();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     LOAD POST
  ══════════════════════════════════════════════════════════ */
  async function loadPost() {
    try {
      const [post, liked, saved, likeCount, comments] = await Promise.all([
        CampusEnergyAPI.getPost(state.postId),
        CampusEnergyAPI.isLiked(state.postId).catch(() => false),
        CampusEnergyAPI.isSaved(state.postId).catch(() => false),
        CampusEnergyAPI.getLikeCount(state.postId).catch(() => 0),
        CampusEnergyAPI.getComments(state.postId).catch(() => []),
      ]);

      state.post      = post;
      state.liked     = liked;
      state.saved     = saved;
      state.likeCount = likeCount;
      state.comments  = comments;

      document.title = `${post.title} — CampusEnergy`;
      renderPost();
      renderComments();
      showContent();
    } catch (err) {
      showError();
      CE.toast(err.message || 'Could not load post.', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     RENDER POST
  ══════════════════════════════════════════════════════════ */
  function renderPost() {
    const { post, currentUser, liked, saved, likeCount } = state;
    const isOwner = currentUser && currentUser.id === post.authorId;

    dom.postTitle.textContent  = post.title;
    dom.postDate.textContent   = post.date;
    dom.postAuthor.textContent = post.author;
    dom.postAuthor.onclick     = () => { window.location.href = `profile.html?user=${encodeURIComponent(post.author)}`; };

    dom.likeCount.textContent = likeCount;
    dom.likeBtn.classList.toggle('active', liked);

    dom.saveLabel.textContent = saved ? 'Saved' : 'Save';
    dom.saveBtn.classList.toggle('active', saved);

    if (isOwner) dom.ownerActions.style.display = 'block';

    dom.chartTitle.textContent = `${post.title} — kWh Consumption`;
    if (Array.isArray(post.data) && post.data.length >= 2) {
      dom.chartPanel.innerHTML = buildChart(post.data);
    } else {
      dom.chartPanel.innerHTML = `<p style="color:var(--text-faint);padding:20px;text-align:center;">No chart data available.</p>`;
    }

    dom.insightBox.textContent = post.insight || '';
  }

  /* ══════════════════════════════════════════════════════════
     CHART
  ══════════════════════════════════════════════════════════ */
  function buildChart(values) {
    const W = 660, H = 300, padL = 46, padR = 18, padT = 38, padB = 28;
    const max   = Math.max(...values) * 1.18;
    const total = values.reduce((a, b) => a + b, 0);
    const xFor  = (i) => padL + i * (W - padL - padR) / (values.length - 1);
    const yFor  = (v) => H - padB - (v / max) * (H - padT - padB);
    const pts   = values.map((v, i) => [xFor(i), yFor(v)]);
    const path  = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y   = padT + f * (H - padT - padB);
      const val = Math.round(max * (1 - f));
      return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>
              <text class="axis-label" x="${padL - 8}" y="${y + 4}" text-anchor="end">${val}</text>`;
    }).join('');

    const dots = pts.map(([x, y], i) => `
      <g style="animation:dotIn 400ms var(--ease-spring) both;animation-delay:${1400 + i * 65}ms">
        <circle class="point" cx="${x}" cy="${y}" r="5"/>
        <text class="data-num" x="${x}" y="${y - 24}" text-anchor="middle">${values[i]}</text>
        <text class="data-pct" x="${x}" y="${y - 13}" text-anchor="middle">${((values[i] / total) * 100).toFixed(1)}%</text>
      </g>`).join('');

    return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" fill="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#7dd3fc"/>
          <stop offset="1" stop-color="#5eead4"/>
        </linearGradient>
        <style>
          @keyframes dotIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .draw-path{stroke-dasharray:3000;stroke-dashoffset:3000;animation:drawPath 1.6s cubic-bezier(.16,.8,.3,1) forwards .1s}
          @keyframes drawPath{to{stroke-dashoffset:0}}
        </style>
      </defs>
      ${gridLines}
      <path class="draw-path" d="${path}" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  /* ══════════════════════════════════════════════════════════
     LIKE / SAVE (optimistic)
  ══════════════════════════════════════════════════════════ */
  async function toggleLike() {
    if (!state.currentUser) {
      CE.toast('Sign in to like posts.', 'error');
      return;
    }
    const wasLiked = state.liked;

    // Optimistic
    state.liked = !wasLiked;
    state.likeCount = Math.max(0, state.likeCount + (wasLiked ? -1 : 1));
    dom.likeBtn.classList.toggle('active', state.liked);
    dom.likeCount.textContent = state.likeCount;

    try {
      if (wasLiked) {
        await CampusEnergyAPI.unlikePost(state.postId);
      } else {
        await CampusEnergyAPI.likePost(state.postId);
        CE.toast('Post liked!', 'success', 1600);
      }
    } catch (err) {
      // Revert
      state.liked = wasLiked;
      state.likeCount = Math.max(0, state.likeCount + (wasLiked ? 1 : -1));
      dom.likeBtn.classList.toggle('active', state.liked);
      dom.likeCount.textContent = state.likeCount;
      CE.toast(err.message || 'Could not update like.', 'error');
    }
  }

  async function toggleSave() {
    if (!state.currentUser) {
      CE.toast('Sign in to save posts.', 'error');
      return;
    }
    const wasSaved = state.saved;

    // Optimistic
    state.saved = !wasSaved;
    dom.saveBtn.classList.toggle('active', state.saved);
    dom.saveLabel.textContent = state.saved ? 'Saved' : 'Save';

    try {
      if (wasSaved) {
        await CampusEnergyAPI.unsavePost(state.postId);
        CE.toast('Removed from saved.', 'success', 1600);
      } else {
        await CampusEnergyAPI.savePost(state.postId);
        CE.toast('Saved to your profile!', 'success', 1600);
      }
    } catch (err) {
      state.saved = wasSaved;
      dom.saveBtn.classList.toggle('active', state.saved);
      dom.saveLabel.textContent = state.saved ? 'Saved' : 'Save';
      CE.toast(err.message || 'Could not update save.', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     SHARE
  ══════════════════════════════════════════════════════════ */
  async function sharePost() {
    const url   = window.location.href;
    const title = state.post?.title || 'CampusEnergy Post';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (_) { /* fallthrough to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      CE.toast('Link copied to clipboard!', 'success');
    } catch (_) {
      CE.toast('Could not copy link.', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     COMMENTS
  ══════════════════════════════════════════════════════════ */
  function renderComments() {
    updateCommentCount(state.comments.length);

    if (state.currentUser) {
      dom.commentForm.style.display          = 'flex';
      dom.commentLoginPrompt.style.display   = 'none';
    } else {
      dom.commentForm.style.display          = 'none';
      dom.commentLoginPrompt.style.display   = 'block';
    }

    dom.commentsList.innerHTML = '';
    if (state.comments.length === 0) {
      dom.commentsEmpty.style.display = 'block';
    } else {
      dom.commentsEmpty.style.display = 'none';
      state.comments.forEach(c => dom.commentsList.appendChild(buildComment(c)));
    }
  }

  function buildComment(comment) {
    const isOwn = state.currentUser && state.currentUser.id === comment.authorId;
    const date  = formatDate(comment.createdAt);

    const el = document.createElement('div');
    el.className = 'comment';
    el.dataset.commentId = comment.id;
    el.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escHtml(comment.author)}</span>
        <span class="comment-date">${date}</span>
      </div>
      <div class="comment-body">${escHtml(comment.body)}</div>
      ${isOwn ? `<div class="comment-footer"><button class="comment-delete" data-id="${comment.id}">Delete</button></div>` : ''}
    `;

    const authorEl = el.querySelector('.comment-author');
    authorEl.addEventListener('click', () => {
      window.location.href = `profile.html?user=${encodeURIComponent(comment.author)}`;
    });

    const deleteBtn = el.querySelector('.comment-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteComment(comment.id));

    return el;
  }

  async function submitComment(e) {
    e.preventDefault();
    const body = dom.commentInput.value.trim();
    if (!body) {
      dom.commentInput.focus();
      return;
    }
    if (!state.currentUser) {
      CE.toast('Sign in to comment.', 'error');
      return;
    }

    CE.setButtonLoading(dom.commentSubmitBtn, true);

    // Optimistic
    const optimistic = {
      id:        `opt-${Date.now()}`,
      postId:    state.postId,
      authorId:  state.currentUser.id,
      author:    state.currentUser.username,
      body,
      createdAt: new Date().toISOString(),
    };
    state.comments.push(optimistic);
    dom.commentsEmpty.style.display = 'none';
    const commentEl = buildComment(optimistic);
    dom.commentsList.appendChild(commentEl);
    updateCommentCount(state.comments.length);
    dom.commentInput.value = '';

    try {
      const created = await CampusEnergyAPI.createComment(state.postId, body);
      // Replace optimistic entry with real one
      const idx = state.comments.findIndex(c => c.id === optimistic.id);
      if (idx !== -1) state.comments[idx] = created;
      commentEl.dataset.commentId = created.id;
      const delBtn = commentEl.querySelector('.comment-delete');
      if (delBtn) delBtn.dataset.id = created.id;
    } catch (err) {
      // Revert
      const idx = state.comments.findIndex(c => c.id === optimistic.id);
      if (idx !== -1) state.comments.splice(idx, 1);
      commentEl.remove();
      updateCommentCount(state.comments.length);
      CE.toast(err.message || 'Could not post comment.', 'error');
    } finally {
      CE.setButtonLoading(dom.commentSubmitBtn, false);
    }
  }

  async function deleteComment(commentId) {
    const idx = state.comments.findIndex(c => c.id === commentId);
    const commentEl = dom.commentsList.querySelector(`[data-comment-id="${commentId}"]`);

    // Optimistic removal
    let removed;
    if (idx !== -1) removed = state.comments.splice(idx, 1)[0];
    if (commentEl) {
      commentEl.style.transition = 'opacity 200ms, transform 200ms';
      commentEl.style.opacity    = '0';
      commentEl.style.transform  = 'translateX(-6px)';
      setTimeout(() => commentEl.remove(), 200);
    }
    updateCommentCount(state.comments.length);
    if (state.comments.length === 0) dom.commentsEmpty.style.display = 'block';

    try {
      await CampusEnergyAPI.deleteComment(commentId);
    } catch (err) {
      // Revert
      if (removed) {
        state.comments.splice(idx, 0, removed);
        dom.commentsEmpty.style.display = 'none';
        dom.commentsList.insertBefore(buildComment(removed), dom.commentsList.children[idx] || null);
        updateCommentCount(state.comments.length);
      }
      CE.toast(err.message || 'Could not delete comment.', 'error');
    }
  }

  function updateCommentCount(n) {
    dom.commentCountBadge.textContent = n;
  }

  /* ══════════════════════════════════════════════════════════
     EDIT POST
  ══════════════════════════════════════════════════════════ */
  function openEditModal() {
    const { post } = state;
    dom.epTitle.value   = post.title;
    dom.epInsight.value = post.insight || '';
    dom.epData.value    = Array.isArray(post.data) ? post.data.join(', ') : '';
    [dom.epTitleField, dom.epInsightField, dom.epDataField].forEach(f => f.classList.remove('invalid', 'valid'));
    openModal(dom.editPostModal);
    dom.epTitle.focus();
  }

  function closeEditModal() { closeModal(dom.editPostModal); }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const title   = dom.epTitle.value.trim();
    const insight = dom.epInsight.value.trim();
    const rawData = dom.epData.value.trim();
    const data    = parseDataPoints(rawData);

    const titleOk   = title.length > 0;
    const insightOk = insight.length > 0;
    const dataOk    = data !== null && data.length >= 2;

    CE.validateField(dom.epTitleField, titleOk, 'Title is required.');
    CE.validateField(dom.epInsightField, insightOk, 'Please add a note.');
    CE.validateField(dom.epDataField, dataOk, 'Enter at least 2 numeric values.');
    if (!titleOk || !insightOk || !dataOk) return;

    CE.setButtonLoading(dom.editPostSubmitBtn, true);
    try {
      const updated = await CampusEnergyAPI.updatePost(state.postId, { title, insight, data });
      Object.assign(state.post, { title, insight, data });
      document.title = `${title} — CampusEnergy`;
      dom.postTitle.textContent  = title;
      dom.chartTitle.textContent = `${title} — kWh Consumption`;
      dom.insightBox.textContent = insight;
      dom.chartPanel.innerHTML   = buildChart(data);
      closeEditModal();
      CE.toast('Post updated.', 'success');
    } catch (err) {
      CE.toast(err.message || 'Could not update post.', 'error');
    } finally {
      CE.setButtonLoading(dom.editPostSubmitBtn, false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     DELETE POST
  ══════════════════════════════════════════════════════════ */
  function openDeleteModal() { openModal(dom.deletePostModal); }
  function closeDeleteModal() { closeModal(dom.deletePostModal); }

  async function handleDeleteConfirm() {
    CE.setButtonLoading(dom.confirmDeletePostBtn, true);
    try {
      await CampusEnergyAPI.deletePost(state.postId);
      CE.toast('Post deleted.', 'success', 1400);
      setTimeout(() => (window.location.href = 'posts.html'), 600);
    } catch (err) {
      CE.toast(err.message || 'Could not delete post.', 'error');
      CE.setButtonLoading(dom.confirmDeletePostBtn, false);
      closeDeleteModal();
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
     VISIBILITY
  ══════════════════════════════════════════════════════════ */
  function showContent() {
    dom.skeleton.style.display = 'none';
    dom.content.style.display  = 'grid';
    dom.errorBlock.style.display = 'none';
  }

  function showError() {
    dom.skeleton.style.display   = 'none';
    dom.content.style.display    = 'none';
    dom.errorBlock.style.display = 'block';
  }

  /* ══════════════════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════════════════ */
  function parseDataPoints(raw) {
    if (!raw) return null;
    const nums = raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    return nums.length >= 2 ? nums : null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (_) { return iso; }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init };
})();

CE.initAll({ topbar: { active: '' }, onReady: PostDetail.init });
