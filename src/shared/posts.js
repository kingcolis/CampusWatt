// posts.js - Feed page with infinite scroll, search, create/edit/delete posts, likes, saves

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// State
const state = {
    posts: [],
    page: 0,
    limit: 10,
    hasMore: true,
    isLoading: false,
    isFirstLoad: true,
    searchQuery: '',
    editingPostId: null,
    currentUserId: null,
};

// DOM refs - expected HTML structure
const DOM = {
    feed: document.getElementById('feed'),
    skeleton: document.getElementById('skeleton-loader'),
    emptyState: document.getElementById('empty-state'),
    loadMoreTrigger: document.getElementById('load-more-trigger'),
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    clearSearch: document.getElementById('clear-search'),
    createPostBtn: document.getElementById('create-post-btn'),
    createPostModal: document.getElementById('create-post-modal'),
    createPostForm: document.getElementById('create-post-form'),
    createPostContent: document.getElementById('create-post-content'),
    createPostImage: document.getElementById('create-post-image'),
    createPostSubmit: document.getElementById('create-post-submit'),
    createPostCancel: document.getElementById('create-post-cancel'),
    editPostModal: document.getElementById('edit-post-modal'),
    editPostForm: document.getElementById('edit-post-form'),
    editPostContent: document.getElementById('edit-post-content'),
    editPostId: document.getElementById('edit-post-id'),
    editPostSubmit: document.getElementById('edit-post-submit'),
    editPostCancel: document.getElementById('edit-post-cancel'),
    refreshBtn: document.getElementById('refresh-feed'),
    feedHeader: document.getElementById('feed-header'),
    feedTitle: document.getElementById('feed-title'),
    feedSubtitle: document.getElementById('feed-subtitle'),
    endMessage: document.getElementById('end-message'),
    loadingMore: document.getElementById('loading-more'),
};

// Authentication check
async function checkAuth() {
    try {
        const user = await CampusEnergyAPI.getCurrentUser();
        state.currentUserId = user.id;
        return true;
    } catch (e) {
        if (e.status === 401) {
            window.location.href = '/login.html';
        }
        return false;
    }
}

// Load posts
async function loadPosts(append = false) {
    if (state.isLoading || (!state.hasMore && append)) return;
    state.isLoading = true;

    if (!append) {
        CE.showLoader(DOM.feed);
    } else {
        DOM.loadingMore.style.display = 'block';
    }

    try {
        const params = {
            page: state.page,
            limit: state.limit,
        };
        if (state.searchQuery) {
            params.q = state.searchQuery;
        }

        const response = await CampusEnergyAPI.getPosts(params);
        const posts = response.data || [];
        state.hasMore = response.hasMore !== false;

        if (append) {
            state.posts = [...state.posts, ...posts];
        } else {
            state.posts = posts;
            state.page = 0;
        }

        if (state.posts.length === 0) {
            renderEmptyState();
        } else {
            renderPosts(append);
        }

        state.page += 1;
    } catch (e) {
        CE.toast('Failed to load posts', 'error');
        console.error('Load posts error:', e);
        if (!append) {
            renderErrorState();
        }
    } finally {
        state.isLoading = false;
        DOM.loadingMore.style.display = 'none';
        CE.hideLoader(DOM.feed);
        if (state.isFirstLoad) {
            state.isFirstLoad = false;
        }
    }
}

// Render posts
function renderPosts(append = false) {
    const container = DOM.feed;
    if (!append) {
        container.innerHTML = '';
    }

    state.posts.forEach((post, index) => {
        // Skip if already rendered (for append mode)
        if (append && container.querySelector(`[data-post-id="${post.id}"]`)) {
            return;
        }
        const card = createPostCard(post);
        container.appendChild(card);
    });

    // Show end message if no more posts
    DOM.endMessage.style.display = state.hasMore ? 'none' : 'block';
}

// Create post card
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card animate-slide-up';
    card.dataset.postId = post.id;

    const isLiked = post.isLiked || false;
    const isSaved = post.isSaved || false;
    const isOwner = state.currentUserId === post.author?.id;

    const likeCount = post.likeCount || 0;
    const commentCount = post.commentCount || 0;
    const savedCount = post.savedCount || 0;

    // Format time
    const timeAgo = CE.timeAgo ? CE.timeAgo(post.createdAt) : post.createdAt;

    // Build author HTML
    const authorHtml = `
        <div class="post-author" data-username="${post.author?.username || ''}">
            <img src="${post.author?.avatar || '/assets/default-avatar.png'}" 
                 alt="${post.author?.displayName || 'User'}" 
                 class="post-avatar">
            <div class="post-author-info">
                <span class="post-author-name">${post.author?.displayName || 'Unknown User'}</span>
                <span class="post-author-username">@${post.author?.username || 'unknown'}</span>
                <span class="post-time">${timeAgo}</span>
            </div>
            ${isOwner ? `<button class="post-more-btn" data-post-id="${post.id}">•••</button>` : ''}
        </div>
    `;

    // Build image HTML
    const imageHtml = post.imageUrl ? `
        <div class="post-image-wrapper">
            <img src="${post.imageUrl}" alt="Post image" class="post-image" loading="lazy">
        </div>
    ` : '';

    // Build actions HTML
    const actionsHtml = `
        <div class="post-actions">
            <button class="post-action like-btn ${isLiked ? 'active' : ''}" data-post-id="${post.id}">
                <svg class="icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" 
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span class="action-count">${likeCount}</span>
            </button>
            <button class="post-action comment-btn" data-post-id="${post.id}">
                <svg class="icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="none" stroke="currentColor" stroke-width="2" 
                          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <span class="action-count">${commentCount}</span>
            </button>
            <button class="post-action save-btn ${isSaved ? 'active' : ''}" data-post-id="${post.id}">
                <svg class="icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" 
                          d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                <span class="action-count">${savedCount}</span>
            </button>
        </div>
    `;

    // Build content
    card.innerHTML = `
        ${authorHtml}
        <div class="post-content" data-post-id="${post.id}">
            <p class="post-text">${CE.escapeHtml ? CE.escapeHtml(post.content) : post.content}</p>
            ${imageHtml}
        </div>
        ${actionsHtml}
    `;

    // Event listeners
    const authorEl = card.querySelector('.post-author');
    if (authorEl) {
        authorEl.addEventListener('click', (e) => {
            const username = authorEl.dataset.username;
            if (username) {
                window.location.href = `/profile.html?username=${username}`;
            }
        });
    }

    const contentEl = card.querySelector('.post-content');
    contentEl.addEventListener('click', () => {
        window.location.href = `/post.html?id=${post.id}`;
    });

    // Like button
    const likeBtn = card.querySelector('.like-btn');
    likeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLike(post.id, likeBtn);
    });

    // Comment button
    const commentBtn = card.querySelector('.comment-btn');
    commentBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `/post.html?id=${post.id}`;
    });

    // Save button
    const saveBtn = card.querySelector('.save-btn');
    saveBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSave(post.id, saveBtn);
    });

    // More button (edit/delete)
    const moreBtn = card.querySelector('.post-more-btn');
    moreBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        showPostMenu(post.id, moreBtn);
    });

    // Add hover animation
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });

    return card;
}

// Render empty state
function renderEmptyState() {
    const container = DOM.feed;
    container.innerHTML = `
        <div class="empty-state" id="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" width="48" height="48">
                <path fill="none" stroke="currentColor" stroke-width="1.5" 
                      d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                <path fill="none" stroke="currentColor" stroke-width="1.5" 
                      d="M8 10h8M8 14h5M8 18h2"/>
            </svg>
            <h3>${state.searchQuery ? 'No results found' : 'No posts yet'}</h3>
            <p>${state.searchQuery ? 'Try adjusting your search terms' : 'Be the first to share something!'}</p>
            ${!state.searchQuery ? `<button class="btn-primary" id="empty-create-btn">Create Post</button>` : ''}
        </div>
    `;
    const createBtn = container.querySelector('#empty-create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', openCreateModal);
    }
}

// Render error state
function renderErrorState() {
    const container = DOM.feed;
    container.innerHTML = `
        <div class="error-state">
            <svg class="error-icon" viewBox="0 0 24 24" width="48" height="48">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path fill="none" stroke="currentColor" stroke-width="1.5" d="M12 8v5M12 16v.01"/>
            </svg>
            <h3>Failed to load posts</h3>
            <p>Please try again</p>
            <button class="btn-primary" id="retry-load-btn">Retry</button>
        </div>
    `;
    const retryBtn = container.querySelector('#retry-load-btn');
    retryBtn?.addEventListener('click', () => loadPosts(false));
}

// Skeleton loading
function renderSkeleton() {
    const container = DOM.skeleton;
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        skeleton.innerHTML = `
            <div class="skeleton-author">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-line skeleton-name"></div>
            </div>
            <div class="skeleton-content">
                <div class="skeleton-line"></div>
                <div class="skeleton-line skeleton-short"></div>
                <div class="skeleton-line skeleton-medium"></div>
            </div>
            <div class="skeleton-actions">
                <div class="skeleton-action"></div>
                <div class="skeleton-action"></div>
                <div class="skeleton-action"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

// Like handler
async function handleLike(postId, button) {
    if (!state.currentUserId) {
        window.location.href = '/login.html';
        return;
    }

    const isLiked = button.classList.contains('active');
    const countSpan = button.querySelector('.action-count');
    let currentCount = parseInt(countSpan.textContent) || 0;

    // Optimistic update
    button.classList.toggle('active');
    const newCount = isLiked ? currentCount - 1 : currentCount + 1;
    countSpan.textContent = newCount;

    try {
        if (isLiked) {
            await CampusEnergyAPI.unlikePost(postId);
        } else {
            await CampusEnergyAPI.likePost(postId);
        }
        // Update the post in state
        const post = state.posts.find(p => p.id === postId);
        if (post) {
            post.isLiked = !isLiked;
            post.likeCount = newCount;
        }
    } catch (e) {
        // Revert on error
        button.classList.toggle('active');
        countSpan.textContent = currentCount;
        CE.toast('Failed to update like', 'error');
        console.error('Like error:', e);
    }
}

// Save handler
async function handleSave(postId, button) {
    if (!state.currentUserId) {
        window.location.href = '/login.html';
        return;
    }

    const isSaved = button.classList.contains('active');
    const countSpan = button.querySelector('.action-count');
    let currentCount = parseInt(countSpan.textContent) || 0;

    // Optimistic update
    button.classList.toggle('active');
    const newCount = isSaved ? currentCount - 1 : currentCount + 1;
    countSpan.textContent = newCount;

    try {
        if (isSaved) {
            await CampusEnergyAPI.unsavePost(postId);
        } else {
            await CampusEnergyAPI.savePost(postId);
        }
        const post = state.posts.find(p => p.id === postId);
        if (post) {
            post.isSaved = !isSaved;
            post.savedCount = newCount;
        }
    } catch (e) {
        button.classList.toggle('active');
        countSpan.textContent = currentCount;
        CE.toast('Failed to update save', 'error');
        console.error('Save error:', e);
    }
}

// Post menu (edit/delete)
function showPostMenu(postId, button) {
    const existing = document.querySelector('.post-menu-dropdown');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'post-menu-dropdown animate-scale-in';
    menu.style.position = 'fixed';
    menu.style.top = `${button.getBoundingClientRect().bottom + 8}px`;
    menu.style.right = `${window.innerWidth - button.getBoundingClientRect().right}px`;
    menu.innerHTML = `
        <button class="menu-item" data-action="edit">✏️ Edit</button>
        <button class="menu-item danger" data-action="delete">🗑️ Delete</button>
    `;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        openEditModal(postId);
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        confirmDelete(postId);
    });

    document.addEventListener('click', () => menu.remove(), { once: true });
}

// Confirm delete
function confirmDelete(postId) {
    CE.confirmModal ? CE.confirmModal({
        title: 'Delete Post?',
        message: 'This action cannot be undone.',
        confirmText: 'Delete',
        confirmClass: 'danger',
        onConfirm: async () => {
            try {
                await CampusEnergyAPI.deletePost(postId);
                state.posts = state.posts.filter(p => p.id !== postId);
                const card = document.querySelector(`[data-post-id="${postId}"]`);
                if (card) {
                    card.style.transition = 'all 0.3s';
                    card.style.transform = 'scale(0.8)';
                    card.style.opacity = '0';
                    setTimeout(() => card.remove(), 300);
                }
                CE.toast('Post deleted successfully', 'success');
                if (state.posts.length === 0) {
                    renderEmptyState();
                }
            } catch (e) {
                CE.toast('Failed to delete post', 'error');
                console.error('Delete error:', e);
            }
        }
    }) : (() => {
        if (confirm('Delete this post?')) {
            // Fallback if confirmModal not available
            CampusEnergyAPI.deletePost(postId).then(() => {
                state.posts = state.posts.filter(p => p.id !== postId);
                const card = document.querySelector(`[data-post-id="${postId}"]`);
                card?.remove();
                CE.toast('Post deleted', 'success');
            }).catch(() => CE.toast('Delete failed', 'error'));
        }
    })();
}

// Open create modal
function openCreateModal() {
    const modal = DOM.createPostModal;
    if (!modal) return;
    modal.classList.add('active');
    DOM.createPostContent.value = '';
    DOM.createPostImage.value = '';
    DOM.createPostContent.focus();
}

// Close create modal
function closeCreateModal() {
    const modal = DOM.createPostModal;
    if (modal) modal.classList.remove('active');
}

// Open edit modal
function openEditModal(postId) {
    const post = state.posts.find(p => p.id === postId);
    if (!post) return;

    const modal = DOM.editPostModal;
    if (!modal) return;
    DOM.editPostContent.value = post.content;
    DOM.editPostId.value = post.id;
    state.editingPostId = postId;
    modal.classList.add('active');
    DOM.editPostContent.focus();
}

// Close edit modal
function closeEditModal() {
    const modal = DOM.editPostModal;
    if (modal) modal.classList.remove('active');
    state.editingPostId = null;
}

// Create post submit
async function handleCreatePost(e) {
    e.preventDefault();
    const content = DOM.createPostContent.value.trim();
    if (!content) {
        CE.toast('Please write something', 'warning');
        return;
    }

    const form = DOM.createPostForm;
    CE.setButtonLoading(DOM.createPostSubmit, true);

    try {
        const postData = { content };
        const imageFile = DOM.createPostImage?.files?.[0];
        if (imageFile) {
            // Assume API supports FormData for image upload
            const formData = new FormData();
            formData.append('content', content);
            formData.append('image', imageFile);
            const response = await CampusEnergyAPI.createPost(formData);
            // Add to state
            const newPost = response.data || response;
            state.posts = [newPost, ...state.posts];
            // Remove skeleton/empty state and render
            const container = DOM.feed;
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            const card = createPostCard(newPost);
            container.prepend(card);
            card.classList.add('animate-slide-up');
            CE.toast('Post created!', 'success');
            closeCreateModal();
        } else {
            const response = await CampusEnergyAPI.createPost(postData);
            const newPost = response.data || response;
            state.posts = [newPost, ...state.posts];
            const container = DOM.feed;
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            const card = createPostCard(newPost);
            container.prepend(card);
            card.classList.add('animate-slide-up');
            CE.toast('Post created!', 'success');
            closeCreateModal();
        }
    } catch (e) {
        CE.toast(e.message || 'Failed to create post', 'error');
        console.error('Create post error:', e);
    } finally {
        CE.setButtonLoading(DOM.createPostSubmit, false);
    }
}

// Edit post submit
async function handleEditPost(e) {
    e.preventDefault();
    const content = DOM.editPostContent.value.trim();
    const postId = DOM.editPostId.value;
    if (!content || !postId) {
        CE.toast('Please write something', 'warning');
        return;
    }

    CE.setButtonLoading(DOM.editPostSubmit, true);

    try {
        const response = await CampusEnergyAPI.updatePost(postId, { content });
        const updatedPost = response.data || response;
        // Update in state
        const index = state.posts.findIndex(p => p.id === parseInt(postId));
        if (index !== -1) {
            state.posts[index] = { ...state.posts[index], ...updatedPost };
            // Update DOM
            const card = document.querySelector(`[data-post-id="${postId}"]`);
            if (card) {
                const textEl = card.querySelector('.post-text');
                if (textEl) textEl.textContent = content;
            }
        }
        CE.toast('Post updated!', 'success');
        closeEditModal();
    } catch (e) {
        CE.toast(e.message || 'Failed to update post', 'error');
        console.error('Edit post error:', e);
    } finally {
        CE.setButtonLoading(DOM.editPostSubmit, false);
    }
}

// Search
function handleSearch() {
    const query = DOM.searchInput.value.trim();
    state.searchQuery = query;
    state.page = 0;
    state.hasMore = true;
    state.posts = [];
    DOM.feed.innerHTML = '';
    DOM.endMessage.style.display = 'none';

    if (query) {
        DOM.clearSearch.style.display = 'block';
        DOM.feedTitle.textContent = `Search: "${query}"`;
        DOM.feedSubtitle.textContent = 'Showing results';
    } else {
        DOM.clearSearch.style.display = 'none';
        DOM.feedTitle.textContent = 'Feed';
        DOM.feedSubtitle.textContent = 'Latest updates from your campus';
    }

    loadPosts(false);
}

// Clear search
function clearSearch() {
    DOM.searchInput.value = '';
    DOM.clearSearch.style.display = 'none';
    state.searchQuery = '';
    state.page = 0;
    state.hasMore = true;
    state.posts = [];
    DOM.feed.innerHTML = '';
    DOM.endMessage.style.display = 'none';
    DOM.feedTitle.textContent = 'Feed';
    DOM.feedSubtitle.textContent = 'Latest updates from your campus';
    loadPosts(false);
}

// Refresh feed
function refreshFeed() {
    state.page = 0;
    state.hasMore = true;
    state.posts = [];
    DOM.feed.innerHTML = '';
    DOM.endMessage.style.display = 'none';
    loadPosts(false);
    CE.toast('Feed refreshed', 'success');
}

// Infinite scroll
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && state.hasMore && !state.isLoading) {
            loadPosts(true);
        }
    }, {
        rootMargin: '200px',
        threshold: 0.1,
    });

    if (DOM.loadMoreTrigger) {
        observer.observe(DOM.loadMoreTrigger);
    }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            DOM.searchInput.focus();
        }
        // Escape to close modals
        if (e.key === 'Escape') {
            if (DOM.createPostModal?.classList.contains('active')) {
                closeCreateModal();
            }
            if (DOM.editPostModal?.classList.contains('active')) {
                closeEditModal();
            }
        }
    });
}

// Init
async function init() {
    // Check auth
    const authenticated = await checkAuth();
    if (!authenticated) return;

    // Render skeleton
    renderSkeleton();

    // Setup event listeners
    DOM.searchButton?.addEventListener('click', handleSearch);
    DOM.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    DOM.clearSearch?.addEventListener('click', clearSearch);
    DOM.refreshBtn?.addEventListener('click', refreshFeed);
    DOM.createPostBtn?.addEventListener('click', openCreateModal);
    DOM.createPostCancel?.addEventListener('click', closeCreateModal);
    DOM.createPostForm?.addEventListener('submit', handleCreatePost);
    DOM.editPostCancel?.addEventListener('click', closeEditModal);
    DOM.editPostForm?.addEventListener('submit', handleEditPost);

    // Close modal on backdrop click
    DOM.createPostModal?.addEventListener('click', (e) => {
        if (e.target === DOM.createPostModal) closeCreateModal();
    });
    DOM.editPostModal?.addEventListener('click', (e) => {
        if (e.target === DOM.editPostModal) closeEditModal();
    });

    // Setup infinite scroll
    setupInfiniteScroll();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Load initial posts
    await loadPosts(false);

    // CE.initAll with page-specific config
    CE.initAll({
        page: 'posts',
        onNav: () => {},
    });
}

// Clean up before unloading
window.addEventListener('beforeunload', () => {
    // Clean up observers, etc.
});

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
