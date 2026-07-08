// Single post page with comments, nested comments, likes, saves, share

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// State
const state = {
    post: null,
    comments: [],
    postId: null,
    currentUserId: null,
    isLoading: true,
    isCommenting: false,
    editingCommentId: null,
    replyingTo: null,
};

// DOM refs - expected HTML structure
const DOM = {
    postContainer: document.getElementById('post-container'),
    skeleton: document.getElementById('skeleton-loader'),
    commentsContainer: document.getElementById('comments-container'),
    commentForm: document.getElementById('comment-form'),
    commentInput: document.getElementById('comment-input'),
    commentSubmit: document.getElementById('comment-submit'),
    commentCancel: document.getElementById('comment-cancel'),
    replyForm: document.getElementById('reply-form'),
    replyInput: document.getElementById('reply-input'),
    replySubmit: document.getElementById('reply-submit'),
    replyCancel: document.getElementById('reply-cancel'),
    shareBtn: document.getElementById('share-btn'),
    backBtn: document.getElementById('back-btn'),
    emptyComments: document.getElementById('empty-comments'),
    commentCount: document.getElementById('comment-count'),
    likeBtn: document.getElementById('like-btn'),
    saveBtn: document.getElementById('save-btn'),
    postAuthor: document.getElementById('post-author'),
    postContent: document.getElementById('post-content'),
    postImage: document.getElementById('post-image'),
    postTime: document.getElementById('post-time'),
    postStats: document.getElementById('post-stats'),
};

// Authentication
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

// Get post ID from URL
function getPostId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load post and comments
async function loadPost() {
    const id = getPostId();
    if (!id) {
        CE.toast('No post ID provided', 'error');
        window.location.href = '/posts.html';
        return;
    }
    state.postId = parseInt(id);

    try {
        const [postResponse, commentsResponse] = await Promise.all([
            CampusEnergyAPI.getPost(state.postId),
            CampusEnergyAPI.getComments(state.postId),
        ]);

        state.post = postResponse.data || postResponse;
        state.comments = commentsResponse.data || commentsResponse || [];

        renderPost();
        renderComments();
        updateStats();
    } catch (e) {
        CE.toast('Failed to load post', 'error');
        console.error('Load post error:', e);
        renderError();
    } finally {
        state.isLoading = false;
        CE.hideLoader(DOM.postContainer);
    }
}

// Render post
function renderPost() {
    const post = state.post;
    if (!post) {
        DOM.postContainer.innerHTML = '<div class="error-state">Post not found</div>';
        return;
    }

    const isOwner = state.currentUserId === post.author?.id;
    const timeAgo = CE.timeAgo ? CE.timeAgo(post.createdAt) : post.createdAt;

    // Author
    DOM.postAuthor.innerHTML = `
        <img src="${post.author?.avatar || '/assets/default-avatar.png'}" alt="${post.author?.displayName}" class="post-avatar">
        <div class="post-author-info">
            <span class="post-author-name">${post.author?.displayName || 'Unknown'}</span>
            <span class="post-author-username">@${post.author?.username || 'unknown'}</span>
            <span class="post-time">${timeAgo}</span>
        </div>
        ${isOwner ? `<button class="post-more-btn" id="post-more-btn">•••</button>` : ''}
    `;

    // Content
    DOM.postContent.textContent = post.content;

    // Image
    if (post.imageUrl) {
        DOM.postImage.style.display = 'block';
        DOM.postImage.src = post.imageUrl;
    } else {
        DOM.postImage.style.display = 'none';
    }

    // Stats
    DOM.postStats.innerHTML = `
        <span>${post.likeCount || 0} likes</span>
        <span>${post.commentCount || 0} comments</span>
        <span>${post.savedCount || 0} saves</span>
    `;

    // Like/Save buttons
    DOM.likeBtn.classList.toggle('active', post.isLiked || false);
    DOM.saveBtn.classList.toggle('active', post.isSaved || false);

    // Event listeners
    DOM.likeBtn.addEventListener('click', handleLike);
    DOM.saveBtn.addEventListener('click', handleSave);

    const moreBtn = document.getElementById('post-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', () => showPostMenu());
    }

    // Author click
    const authorEl = DOM.postAuthor;
    authorEl.style.cursor = 'pointer';
    authorEl.addEventListener('click', () => {
        if (post.author?.username) {
            window.location.href = `/profile.html?username=${post.author.username}`;
        }
    });
}

// Render comments (with nesting)
function renderComments() {
    const container = DOM.commentsContainer;
    container.innerHTML = '';

    if (state.comments.length === 0) {
        DOM.emptyComments.style.display = 'block';
        return;
    }
    DOM.emptyComments.style.display = 'none';

    // Build comment tree (top-level only; we handle replies separately)
    const topLevel = state.comments.filter(c => !c.parentId);
    topLevel.forEach(comment => {
        const card = createCommentCard(comment);
        container.appendChild(card);
        // Render replies recursively
        const replies = state.comments.filter(c => c.parentId === comment.id);
        if (replies.length) {
            const replyContainer = document.createElement('div');
            replyContainer.className = 'replies-container';
            replies.forEach(reply => {
                const replyCard = createCommentCard(reply, true);
                replyContainer.appendChild(replyCard);
            });
            card.appendChild(replyContainer);
        }
    });

    // Update comment count
    DOM.commentCount.textContent = state.comments.length;
}

// Create comment card
function createCommentCard(comment, isReply = false) {
    const card = document.createElement('div');
    card.className = `comment-card ${isReply ? 'reply' : ''}`;
    card.dataset.commentId = comment.id;

    const isOwner = state.currentUserId === comment.author?.id;
    const timeAgo = CE.timeAgo ? CE.timeAgo(comment.createdAt) : comment.createdAt;

    card.innerHTML = `
        <div class="comment-author" data-username="${comment.author?.username || ''}">
            <img src="${comment.author?.avatar || '/assets/default-avatar.png'}" alt="${comment.author?.displayName}" class="comment-avatar">
            <span class="comment-author-name">${comment.author?.displayName || 'Unknown'}</span>
            <span class="comment-author-username">@${comment.author?.username || 'unknown'}</span>
            <span class="comment-time">${timeAgo}</span>
            ${isOwner ? `<button class="comment-more-btn" data-comment-id="${comment.id}">•••</button>` : ''}
        </div>
        <div class="comment-content">${CE.escapeHtml ? CE.escapeHtml(comment.content) : comment.content}</div>
        <div class="comment-actions">
            <button class="comment-action reply-btn" data-comment-id="${comment.id}">Reply</button>
            ${isOwner ? `<button class="comment-action edit-btn" data-comment-id="${comment.id}">Edit</button>` : ''}
        </div>
    `;

    // Author click
    const authorEl = card.querySelector('.comment-author');
    authorEl.addEventListener('click', () => {
        const username = authorEl.dataset.username;
        if (username) window.location.href = `/profile.html?username=${username}`;
    });

    // Reply button
    const replyBtn = card.querySelector('.reply-btn');
    replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startReply(comment.id, comment.author?.displayName);
    });

    // Edit/Delete buttons
    const moreBtn = card.querySelector('.comment-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showCommentMenu(comment.id, moreBtn);
        });
    }

    // Edit button (if present)
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startEditComment(comment.id, comment.content);
        });
    }

    return card;
}

// Handle like
async function handleLike() {
    if (!state.currentUserId) {
        window.location.href = '/login.html';
        return;
    }
    const isLiked = DOM.likeBtn.classList.contains('active');
    const countSpan = DOM.postStats.querySelector('span:first-child');
    let currentCount = parseInt(countSpan.textContent) || 0;

    DOM.likeBtn.classList.toggle('active');
    const newCount = isLiked ? currentCount - 1 : currentCount + 1;
    countSpan.textContent = `${newCount} likes`;

    try {
        if (isLiked) {
            await CampusEnergyAPI.unlikePost(state.postId);
        } else {
            await CampusEnergyAPI.likePost(state.postId);
        }
        state.post.isLiked = !isLiked;
        state.post.likeCount = newCount;
    } catch (e) {
        DOM.likeBtn.classList.toggle('active');
        countSpan.textContent = `${currentCount} likes`;
        CE.toast('Failed to update like', 'error');
    }
}

// Handle save
async function handleSave() {
    if (!state.currentUserId) {
        window.location.href = '/login.html';
        return;
    }
    const isSaved = DOM.saveBtn.classList.contains('active');
    const countSpan = DOM.postStats.querySelector('span:last-child');
    let currentCount = parseInt(countSpan.textContent) || 0;

    DOM.saveBtn.classList.toggle('active');
    const newCount = isSaved ? currentCount - 1 : currentCount + 1;
    countSpan.textContent = `${newCount} saves`;

    try {
        if (isSaved) {
            await CampusEnergyAPI.unsavePost(state.postId);
        } else {
            await CampusEnergyAPI.savePost(state.postId);
        }
        state.post.isSaved = !isSaved;
        state.post.savedCount = newCount;
    } catch (e) {
        DOM.saveBtn.classList.toggle('active');
        countSpan.textContent = `${currentCount} saves`;
        CE.toast('Failed to update save', 'error');
    }
}

// Update stats
function updateStats() {
    // Already done in renderPost, but can be used for refresh
}

// Comment submission
async function handleCommentSubmit(e) {
    e.preventDefault();
    const content = DOM.commentInput.value.trim();
    if (!content) {
        CE.toast('Please write a comment', 'warning');
        return;
    }

    CE.setButtonLoading(DOM.commentSubmit, true);
    try {
        const response = await CampusEnergyAPI.createComment(state.postId, { content });
        const newComment = response.data || response;
        newComment.author = newComment.author || { displayName: 'You', username: 'me' };
        state.comments.push(newComment);
        renderComments();
        DOM.commentInput.value = '';
        CE.toast('Comment added', 'success');
    } catch (e) {
        CE.toast('Failed to post comment', 'error');
    } finally {
        CE.setButtonLoading(DOM.commentSubmit, false);
    }
}

// Reply to comment
function startReply(commentId, authorName) {
    state.replyingTo = commentId;
    DOM.replyForm.style.display = 'block';
    DOM.replyInput.placeholder = `Reply to ${authorName}...`;
    DOM.replyInput.focus();
}

// Cancel reply
function cancelReply() {
    state.replyingTo = null;
    DOM.replyForm.style.display = 'none';
    DOM.replyInput.value = '';
}

// Submit reply
async function handleReplySubmit(e) {
    e.preventDefault();
    const content = DOM.replyInput.value.trim();
    if (!content || !state.replyingTo) return;

    CE.setButtonLoading(DOM.replySubmit, true);
    try {
        const response = await CampusEnergyAPI.createComment(state.postId, {
            content,
            parentId: state.replyingTo,
        });
        const newReply = response.data || response;
        newReply.author = newReply.author || { displayName: 'You', username: 'me' };
        state.comments.push(newReply);
        renderComments();
        cancelReply();
        CE.toast('Reply added', 'success');
    } catch (e) {
        CE.toast('Failed to post reply', 'error');
    } finally {
        CE.setButtonLoading(DOM.replySubmit, false);
    }
}

// Edit comment
function startEditComment(commentId, content) {
    state.editingCommentId = commentId;
    DOM.commentInput.value = content;
    DOM.commentSubmit.textContent = 'Update';
    DOM.commentCancel.style.display = 'inline-block';
    DOM.commentInput.focus();
}

// Cancel edit comment
function cancelEditComment() {
    state.editingCommentId = null;
    DOM.commentInput.value = '';
    DOM.commentSubmit.textContent = 'Post';
    DOM.commentCancel.style.display = 'none';
}

// Update or create comment based on editing state
async function handleCommentAction(e) {
    if (state.editingCommentId) {
        e.preventDefault();
        const content = DOM.commentInput.value.trim();
        if (!content) {
            CE.toast('Please write a comment', 'warning');
            return;
        }
        CE.setButtonLoading(DOM.commentSubmit, true);
        try {
            // Assuming API has updateComment endpoint, but not in spec; we'll use delete+create as fallback
            // For now, we'll just use delete+create if update not available.
            // Since spec doesn't have PUT /comments, we'll delete and recreate.
            // But better to call update if exists; we'll implement generic.
            await CampusEnergyAPI.updateComment?.(state.editingCommentId, { content }) ||
            (await CampusEnergyAPI.deleteComment(state.editingCommentId) &&
             await CampusEnergyAPI.createComment(state.postId, { content }));
            // Refresh comments
            const comments = await CampusEnergyAPI.getComments(state.postId);
            state.comments = comments.data || comments || [];
            renderComments();
            cancelEditComment();
            CE.toast('Comment updated', 'success');
        } catch (e) {
            CE.toast('Failed to update comment', 'error');
        } finally {
            CE.setButtonLoading(DOM.commentSubmit, false);
        }
    } else {
        handleCommentSubmit(e);
    }
}

// Delete comment
async function deleteComment(commentId) {
    try {
        await CampusEnergyAPI.deleteComment(commentId);
        state.comments = state.comments.filter(c => c.id !== commentId);
        renderComments();
        CE.toast('Comment deleted', 'success');
    } catch (e) {
        CE.toast('Failed to delete comment', 'error');
    }
}

// Show comment menu (edit/delete)
function showCommentMenu(commentId, button) {
    const existing = document.querySelector('.comment-menu-dropdown');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'comment-menu-dropdown animate-scale-in';
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
        const comment = state.comments.find(c => c.id === commentId);
        if (comment) startEditComment(commentId, comment.content);
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        if (confirm('Delete this comment?')) {
            deleteComment(commentId);
        }
    });

    document.addEventListener('click', () => menu.remove(), { once: true });
}

// Show post menu (edit/delete)
function showPostMenu() {
    const existing = document.querySelector('.post-menu-dropdown');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'post-menu-dropdown animate-scale-in';
    menu.style.position = 'fixed';
    const btn = document.getElementById('post-more-btn');
    menu.style.top = `${btn.getBoundingClientRect().bottom + 8}px`;
    menu.style.right = `${window.innerWidth - btn.getBoundingClientRect().right}px`;
    menu.innerHTML = `
        <button class="menu-item" data-action="edit">✏️ Edit</button>
        <button class="menu-item danger" data-action="delete">🗑️ Delete</button>
    `;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        menu.remove();
        window.location.href = `/posts.html?edit=${state.postId}`;
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        menu.remove();
        if (confirm('Delete this post?')) {
            CampusEnergyAPI.deletePost(state.postId).then(() => {
                CE.toast('Post deleted', 'success');
                window.location.href = '/posts.html';
            }).catch(() => CE.toast('Delete failed', 'error'));
        }
    });

    document.addEventListener('click', () => menu.remove(), { once: true });
}

// Share
function sharePost() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post',
            text: state.post?.content || '',
            url: url,
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => {
            CE.toast('Link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            CE.toast('Link copied!', 'success');
        });
    }
}

// Render error
function renderError() {
    DOM.postContainer.innerHTML = `
        <div class="error-state">
            <h3>Could not load post</h3>
            <p>Please try again later</p>
            <button class="btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `;
}

// Init
async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;

    // Show skeleton
    CE.showLoader(DOM.postContainer);

    // Setup event listeners
    DOM.commentForm.addEventListener('submit', handleCommentAction);
    DOM.commentCancel.addEventListener('click', cancelEditComment);
    DOM.replyForm.addEventListener('submit', handleReplySubmit);
    DOM.replyCancel.addEventListener('click', cancelReply);
    DOM.shareBtn.addEventListener('click', sharePost);
    DOM.backBtn.addEventListener('click', () => window.history.back());

    // Load post
    await loadPost();

    // CE.initAll
    CE.initAll({
        page: 'post',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
