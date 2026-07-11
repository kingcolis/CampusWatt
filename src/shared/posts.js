const PostsPage = (() => {
  let posts = [];
  let currentUser = null;

  async function init() {
    if (!CampusEnergyAPI.readSession()) {
      window.location.href = "login.html";
      return;
    }

    try {
      currentUser = await CampusEnergyAPI.getCurrentUser();
    } catch (err) {
      console.error("Failed to load current user:", err);
      CampusEnergyAPI.logout();
      return;
    }

    const publishBtn = document.getElementById("publishPost");
    if (publishBtn) {
      publishBtn.addEventListener("click", createPost);
    }

    const searchInput = document.getElementById("searchPosts");
    if (searchInput) {
      searchInput.addEventListener("input", filterPosts);
    }

    await refreshPosts();
  }

  async function refreshPosts() {
    try {
      const res = await CampusEnergyAPI.getPosts();
      posts = Array.isArray(res) ? res : (res?.posts || []);
      renderPosts(posts);
    } catch (err) {
      CE.toast(err.message, "error");
    }
  }

  function renderPosts(data) {
    const list = document.getElementById("postsList");
    if (!list) return;

    if (!data.length) {
      list.innerHTML = `
        <div class="panel" style="padding: 32px; text-align: center;">
          <h3 style="color: var(--text-dim);">No posts matching your search.</h3>
        </div>
      `;
      return;
    }

    list.innerHTML = data.map((post, i) => {
      const isAuthor = currentUser && (post.author_id === currentUser.id || post.username === currentUser.username);
      const deleteBtnHtml = isAuthor 
        ? `<button class="delete-btn" onclick="event.stopPropagation(); PostsPage.deletePost('${post.id}')">Delete</button>`
        : '';
      
      const authorName = post.username || post.author || "Anonymous";
      const postDate = post.created_at ? new Date(post.created_at).toLocaleDateString() : (post.date || "Just now");
      const visibility = post.visibility || "public";
      
      return `
        <article class="panel post-row card-hover reveal is-visible" style="--i:${i}" onclick="location.href='post.html?id=${post.id}'">
          <div style="flex-grow: 1; text-align: left;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">${post.title}</h3>
            <span class="meta">${authorName} · ${postDate} · <span style="text-transform: capitalize; color: var(--blue); font-weight: 500;">${visibility}</span></span>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            ${deleteBtnHtml}
            <span class="arrow">→</span>
          </div>
        </article>
      `;
    }).join("");

    CE.initRevealOnScroll(list);
  }

  async function createPost() {
    const titleInput = document.getElementById("postTitle");
    const bodyInput = document.getElementById("postBody");
    const visibilitySelect = document.getElementById("postVisibility");

    const title = titleInput?.value?.trim();
    const body = bodyInput?.value?.trim();
    const visibility = visibilitySelect?.value || "public";

    if (!title || !body) {
      CE.toast("Please fill in both title and content.", "error");
      return;
    }

    try {
      await CampusEnergyAPI.createPost({
        title: title,
        body: body,
        visibility: visibility,
        images: []
      });

      CE.toast("Post published successfully!", "success");

      if (titleInput) titleInput.value = "";
      if (bodyInput) bodyInput.value = "";
      
      await refreshPosts();
    } catch (err) {
      CE.toast(err.message, "error");
    }
  }

  async function deletePost(id) {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      await CampusEnergyAPI.deletePost(id);
      CE.toast("Post deleted successfully.", "success");
      await refreshPosts();
    } catch (err) {
      CE.toast(err.message, "error");
    }
  }

  function filterPosts(e) {
    const query = e.target.value.toLowerCase();
    const filtered = posts.filter(post => {
      const titleMatch = post.title?.toLowerCase().includes(query);
      const contentMatch = (post.body || post.content)?.toLowerCase().includes(query);
      const authorMatch = (post.username || post.author)?.toLowerCase().includes(query);
      return titleMatch || contentMatch || authorMatch;
    });
    renderPosts(filtered);
  }

  return {
    init,
    deletePost
  };
})();

window.PostsPage = PostsPage;

CE.initAll({
  onReady: PostsPage.init
});