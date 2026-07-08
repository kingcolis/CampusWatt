// login.js
// Login form with validation, loading spinner, toast errors, redirect

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// DOM refs - expected HTML structure
const DOM = {
    form: document.getElementById('login-form'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    submitBtn: document.getElementById('login-submit'),
    errorMsg: document.getElementById('login-error'),
};

// Check if already logged in
async function checkAlreadyLoggedIn() {
    try {
        const user = await CampusEnergyAPI.getCurrentUser();
        if (user && user.id) {
            window.location.href = '/posts.html';
            return true;
        }
    } catch (e) {
        // Not logged in
    }
    return false;
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const username = DOM.username.value.trim();
    const password = DOM.password.value;

    // Basic validation
    if (!username || !password) {
        CE.toast('Please fill in all fields', 'warning');
        return;
    }

    // Set loading
    CE.setButtonLoading(DOM.submitBtn, true);
    DOM.errorMsg.style.display = 'none';

    try {
        const response = await CampusEnergyAPI.login({ username, password });
        // Store token (handled by api.js)
        CE.toast('Login successful!', 'success');
        // Redirect to posts page
        const redirect = new URLSearchParams(window.location.search).get('redirect') || '/posts.html';
        window.location.href = redirect;
    } catch (e) {
        const msg = e.message || 'Invalid username or password';
        DOM.errorMsg.textContent = msg;
        DOM.errorMsg.style.display = 'block';
        CE.toast(msg, 'error');
    } finally {
        CE.setButtonLoading(DOM.submitBtn, false);
    }
}

// Init
async function init() {
    // Check if already logged in
    const loggedIn = await checkAlreadyLoggedIn();
    if (loggedIn) return;

    // Setup form submission
    DOM.form.addEventListener('submit', handleLogin);

    // Auto-focus username
    DOM.username.focus();

    // CE.initAll
    CE.initAll({
        page: 'login',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
