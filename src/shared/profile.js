// profile.js
// User profile (own and others) with posts, saved, stats, follow/unfollow, edit modal, logout

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// State
const state = {
    profileUser: null,
    isOwnProfile: false,
    posts: [],
    savedPosts: [],
    activeTab: 'posts', // 'posts' or 'saved'
    page: 0,
    limit: 10,
    hasMore: true,
    isLoading: false,
    currentUserId: null,
    username: null,
};

// DOM refs - expected HTML structure
const DOM = {
    profileHeader: document.getElementById('profile-header'),
    profileAvatar: document.getElementById('profile-avatar'),
    profileDisplayName: document.getElementById('profile-display-name'),
    profileUsername: document.getElementById('profile-username'),
    profileBio: document.getElementById('profile-bio'),
    profileStats: document.getElementById('profile-stats'),
    followBtn: document.getElementById('follow-btn'),
    editProfileBtn: document.getElementById('edit-profile-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    postsContainer: document.getElementById('posts-container'),
    savedContainer: document.getElementById('saved-container'),
    tabs: document.getElementById('profile-tabs'),
    tabPosts: document.getElementById('tab-posts'),
    tabSaved: document.getElementById('tab-saved'),
    emptyPosts: document.getElementById('empty-posts'),
    emptySaved: document.getElementById('empty-saved'),
    loadMoreTrigger: document.getElementById('load-more-trigger'),
    editModal: document.getElementById('edit-profile-modal'),
    editForm: document.getElementById('edit-profile-form'),
    editDisplayName: document.getElementById('edit-display-name'),
    editBio: document.getElementById('edit-bio'),
    editAvatar: document.getElementById('edit-avatar'),
    editSubmit: document.getElementById('edit-submit'),
    editCancel: document.getElementById('edit-cancel'),
};

// Auth check
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

// Get username from URL
function getUsername() {
    const params = new URLSearchParams(window.location.search);
    return params.get('username') || 'me';
}

// Load profile
async function loadProfile() {
    const username = getUsername();
    state.username = username;

    try {
        let user;
        if (username === 'me') {
            user = await CampusEnergyAPI.getCurrentUser();
            state.isOwnProfile = true;
        } else {
            user = await CampusEnergyAPI.getUserByUsername(username);
            state.isOwnProfile = state.currentUserId === user.id;
        }
        state.profileUser = user;
        renderProfile();
        loadProfilePosts();
        if (state.isOwnProfile) {
            loadSavedPosts();
        }
    } catch (e) {
        CE.toast('Profile not found', 'error');
        console.error('Load profile error:', e);
    }
}

// Render profile header
function renderProfile() {
    const user = state.profileUser;
    if (!user) return;

    DOM.profileAvatar.src = user.avatar || '/assets/default-avatar.png';
    DOM.profileDisplayName.textContent = user.displayName || user.username;
    DOM.profileUsername.textContent = `@${user.username}`;
    DOM.profileBio.textContent = user.bio || '';

    // Stats
    DOM.profileStats.innerHTML = `
        <div><strong>${user.postCount || 0}</strong> posts</div>
        <div><strong>${user.followerCount || 0}</strong> followers</div>
        <div><strong>${user.followingCount || 0}</strong> following</div>
    `;

    // Follow button
    if (!state.isOwnProfile) {
        DOM.followBtn.style.display = 'inline-block';
        const isFollowing = user.isFollowing || false;
        DOM.followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
        DOM.followBtn.classList.toggle('following', isFollowing);
        DOM.followBtn.addEventListener('click', handleFollow);
        DOM.editProfileBtn.style.display = 'none';
    } else {
        DOM.followBtn.style.display = 'none';
        DOM.editProfileBtn.style.display = 'inline-block';
        DOM.editProfileBtn.addEventListener('click', openEditModal);
        DOM.logoutBtn.style.display = 'inline-block';
        DOM.logoutBtn.addEventListener('click', handleLogout);
    }
}

// Follow/Unfollow
async function handleFollow() {
    const isFollowing = DOM.followBtn.classList.contains('following');
    const username = state.profileUser.username;

    try {
        if (isFollowing) {
            await CampusEnergyAPI.unfollowUser(username);
            state.profileUser.isFollowing = false;
            state.profileUser.followerCount = (state.profileUser.followerCount || 1) - 1;
        } else {
            await CampusEnergyAPI.followUser(username);
            state.profileUser.isFollowing = true;
            state.profileUser.followerCount = (state.profileUser.followerCount || 0) + 1;
        }
        renderProfile(); // re-render stats and button
        CE.toast(isFollowing ? 'Unfollowed' : 'Followed', 'success');
    } catch (e) {
        CE.toast('Action failed', 'error');
        console.error('Follow error:', e);
    }
}

// Load user posts
async function loadProfilePosts(append = false) {
    if (state.isLoading || (!state.hasMore && append)) return;
    state.isLoading = true;

    if (!append) {
        CE.showLoader(DOM.postsContainer);
        state.page = 0;
        state.hasMore = true;
    }

    try {
        const params = {
            page: state.page,
            limit: state.limit,
        };
        // Assuming API endpoint to get posts by username
        const response = await CampusEnergyAPI.getUserPosts(state.profileUser.username, params);
        const posts = response.data || [];
        state.hasMore = response.hasMore !== false;

        if (append) {
            state.posts = [...state.posts, ...posts];
        } else {
            state.posts = posts;
        }

        renderPosts(append);
        state.page += 1;
    } catch (e) {
        CE.toast('Failed to load posts', 'error');
        console.error('Load posts error:', e);
        if (!append) {
            DOM.postsContainer.innerHTML = '<div class="error-state">Failed to load posts</div>';
        }
    } finally {
        state.isLoading = false;
        CE.hideLoader(DOM.postsContainer);
    }
}

// Render posts in profile
function renderPosts(append = false) {
    const container = DOM.postsContainer;
    if (!append) {
        container.innerHTML = '';
    }

    if (state.posts.length === 0) {
        DOM.emptyPosts.style.display = 'block';
        DOM.loadMoreTrigger.style.display = 'none';
        return;
    }
    DOM.emptyPosts.style.display = 'none';

    state.posts.forEach(post => {
        if (append && container.querySelector(`[data-post-id="${post.id}"]`)) return;
        const card = createPostCard(post);
        container.appendChild(card);
    });

    DOM.loadMoreTrigger.style.display = state.hasMore ? 'block' : 'none';
}

// Create post card (similar to posts.js but simplified)
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card profile-post-card';
    card.dataset.postId = post.id;

    const timeAgo = CE.timeAgo ? CE.timeAgo(post.createdAt) : post.createdAt;

    card.innerHTML = `
        <div class="post-content" data-post-id="${post.id}">
            <p class="post-text">${CE.escapeHtml ? CE.escapeHtml(post.content) : post.content}</p>
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="" class="post-image">` : ''}
        </div>
        <div class="post-meta">
            <span>${timeAgo}</span>
            <span>❤️ ${post.likeCount || 0}</span>
            <span>💬 ${post.commentCount || 0}</span>
        </div>
    `;

    card.addEventListener('click', () => {
        window.location.href = `/post.html?id=${post.id}`;
    });

    return card;
}

// Load saved posts (own profile only)
async function loadSavedPosts() {
    if (!state.isOwnProfile) return;
    try {
        const response = await CampusEnergyAPI.getSavedPosts();
        state.savedPosts = response.data || [];
        renderSaved();
    } catch (e) {
        console.error('Load saved error:', e);
    }
}

function renderSaved() {
    const container = DOM.savedContainer;
    container.innerHTML = '';
    if (state.savedPosts.length === 0) {
        DOM.emptySaved.style.display = 'block';
        return;
    }
    DOM.emptySaved.style.display = 'none';
    state.savedPosts.forEach(post => {
        const card = createPostCard(post);
        container.appendChild(card);
    });
}

// Tab switching
function switchTab(tab) {
    state.activeTab = tab;
    if (tab === 'posts') {
        DOM.postsContainer.style.display = 'block';
        DOM.savedContainer.style.display = 'none';
        DOM.tabPosts.classList.add('active');
        DOM.tabSaved.classList.remove('active');
    } else {
        DOM.postsContainer.style.display = 'none';
        DOM.savedContainer.style.display = 'block';
        DOM.tabSaved.classList.add('active');
        DOM.tabPosts.classList.remove('active');
        if (state.isOwnProfile) {
            loadSavedPosts();
        }
    }
}

// Edit profile modal
function openEditModal() {
    const user = state.profileUser;
    DOM.editDisplayName.value = user.displayName || '';
    DOM.editBio.value = user.bio || '';
    DOM.editModal.classList.add('active');
}

function closeEditModal() {
    DOM.editModal.classList.remove('active');
}

async function handleEditProfile(e) {
    e.preventDefault();
    const displayName = DOM.editDisplayName.value.trim();
    const bio = DOM.editBio.value.trim();
    const avatarFile = DOM.editAvatar.files[0];

    CE.setButtonLoading(DOM.editSubmit, true);

    try {
        const formData = new FormData();
        if (displayName) formData.append('displayName', displayName);
        if (bio) formData.append('bio', bio);
        if (avatarFile) formData.append('avatar', avatarFile);

        const response = await CampusEnergyAPI.updateCurrentUser(formData);
        const updated = response.data || response;
        state.profileUser = { ...state.profileUser, ...updated };
        renderProfile();
        closeEditModal();
        CE.toast('Profile updated', 'success');
    } catch (e) {
        CE.toast('Update failed', 'error');
        console.error('Edit profile error:', e);
    } finally {
        CE.setButtonLoading(DOM.editSubmit, false);
    }
}

// Logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        CampusEnergyAPI.logout();
        window.location.href = '/login.html';
    }
}

// Infinite scroll for posts
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && state.hasMore && !state.isLoading && state.activeTab === 'posts') {
            loadProfilePosts(true);
        }
    }, { rootMargin: '200px' });

    if (DOM.loadMoreTrigger) {
        observer.observe(DOM.loadMoreTrigger);
    }
}

// Init
async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;

    // Setup tabs
    DOM.tabPosts.addEventListener('click', () => switchTab('posts'));
    DOM.tabSaved.addEventListener('click', () => switchTab('saved'));

    // Edit form
    DOM.editForm.addEventListener('submit', handleEditProfile);
    DOM.editCancel.addEventListener('click', closeEditModal);

    // Load profile
    await loadProfile();

    // Setup infinite scroll
    setupInfiniteScroll();

    // CE.initAll
    CE.initAll({
        page: 'profile',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
