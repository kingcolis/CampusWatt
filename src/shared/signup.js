// signup.js
// Signup form with validation, duplicate handling, redirect

import { CampusEnergyAPI } from './shared/api.js';
import { CE } from './shared/app.js';

// DOM refs - expected HTML structure
const DOM = {
    form: document.getElementById('signup-form'),
    username: document.getElementById('username'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    passwordConfirm: document.getElementById('password-confirm'),
    submitBtn: document.getElementById('signup-submit'),
    errorMsg: document.getElementById('signup-error'),
    usernameHint: document.getElementById('username-hint'),
    passwordHint: document.getElementById('password-hint'),
};

// Check already logged in
async function checkAlreadyLoggedIn() {
    try {
        const user = await CampusEnergyAPI.getCurrentUser();
        if (user && user.id) {
            window.location.href = '/posts.html';
            return true;
        }
    } catch (e) {}
    return false;
}

// Validation helpers
function validateUsername(username) {
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    return null;
}

function validateEmail(email) {
    if (!email) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    return null;
}

function validatePassword(password) {
    if (password.length < 8) return 'Password must be at least 8 characters';
    // Optional: add more complexity checks
    return null;
}

// Real-time validation hints
function setupLiveValidation() {
    DOM.username.addEventListener('blur', () => {
        const val = DOM.username.value.trim();
        const error = validateUsername(val);
        DOM.usernameHint.textContent = error || '';
        DOM.usernameHint.style.color = error ? 'var(--error-color)' : 'var(--success-color)';
    });

    DOM.password.addEventListener('input', () => {
        const val = DOM.password.value;
        const error = validatePassword(val);
        DOM.passwordHint.textContent = error || (val.length > 0 ? '✓ Strong enough' : '');
        DOM.passwordHint.style.color = error ? 'var(--error-color)' : 'var(--success-color)';
    });
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();

    const username = DOM.username.value.trim();
    const email = DOM.email.value.trim();
    const password = DOM.password.value;
    const passwordConfirm = DOM.passwordConfirm.value;

    // Clear old errors
    DOM.errorMsg.style.display = 'none';

    // Validate all
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (usernameError) {
        CE.toast(usernameError, 'warning');
        DOM.username.focus();
        return;
    }
    if (emailError) {
        CE.toast(emailError, 'warning');
        DOM.email.focus();
        return;
    }
    if (passwordError) {
        CE.toast(passwordError, 'warning');
        DOM.password.focus();
        return;
    }
    if (password !== passwordConfirm) {
        CE.toast('Passwords do not match', 'warning');
        DOM.passwordConfirm.focus();
        return;
    }

    CE.setButtonLoading(DOM.submitBtn, true);

    try {
        const response = await CampusEnergyAPI.signup({
            username,
            email,
            password,
        });
        CE.toast('Account created successfully!', 'success');
        // Redirect to login with success message
        window.location.href = '/login.html?signup=success';
    } catch (e) {
        let msg = 'Signup failed. Please try again.';
        if (e.status === 409) {
            msg = 'Username or email already taken.';
        } else if (e.message) {
            msg = e.message;
        }
        DOM.errorMsg.textContent = msg;
        DOM.errorMsg.style.display = 'block';
        CE.toast(msg, 'error');
        console.error('Signup error:', e);
    } finally {
        CE.setButtonLoading(DOM.submitBtn, false);
    }
}

// Init
async function init() {
    const loggedIn = await checkAlreadyLoggedIn();
    if (loggedIn) return;

    DOM.form.addEventListener('submit', handleSignup);
    setupLiveValidation();

    // Pre-fill email if from URL?
    const params = new URLSearchParams(window.location.search);
    if (params.get('email')) {
        DOM.email.value = params.get('email');
    }

    DOM.username.focus();

    CE.initAll({
        page: 'signup',
        onNav: () => {},
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
