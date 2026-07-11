// signup.js

const SignupPage = (() => {

  function init() {
    // Already logged in → go home
    const session = CampusEnergyAPI.readSession();
    if (session) {
      window.location.replace('profile.html');
      return;
    }

    const form          = document.getElementById('signupForm');
    const submitBtn     = document.getElementById('submitBtn');
    const usernameField = document.getElementById('usernameField');
    const emailField    = document.getElementById('emailField');
    const passField     = document.getElementById('passwordField');
    const confirmField  = document.getElementById('confirmField');
    const usernameInput = document.getElementById('username');
    const emailInput    = document.getElementById('email');
    const passInput     = document.getElementById('password');
    const confirmInput  = document.getElementById('confirm');
    const strengthBar   = document.getElementById('strengthBar');

    // Live validations
    usernameInput.addEventListener('input', () => {
      const v = usernameInput.value.trim();
      if (v.length > 0) CE.validateField(usernameField, isValidUsername(v), 'Pick a username (3+ chars, letters/numbers/underscores).');
    });

    emailInput.addEventListener('blur', () => {
      const v = emailInput.value.trim();
      if (v.length > 0) CE.validateField(emailField, isEmail(v), 'Enter a valid email address.');
    });

    passInput.addEventListener('input', () => {
      updateStrength(passInput.value, strengthBar);
      if (confirmInput.value.length > 0) CE.validateField(confirmField, confirmInput.value === passInput.value, 'Passwords do not match.');
    });

    confirmInput.addEventListener('input', () => {
      if (confirmInput.value.length > 0) CE.validateField(confirmField, confirmInput.value === passInput.value, 'Passwords do not match.');
    });

    passInput.addEventListener('blur', () => {
      if (passInput.value.length > 0) CE.validateField(passField, passInput.value.length >= 8, 'Use at least 8 characters.');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = usernameInput.value.trim();
      const email    = emailInput.value.trim();
      const password = passInput.value;
      const confirm  = confirmInput.value;

      const usernameOk = isValidUsername(username);
      const emailOk    = isEmail(email);
      const passwordOk = password.length >= 8;
      const confirmOk  = confirm.length > 0 && confirm === password;

      CE.validateField(usernameField, usernameOk, 'Pick a username (3+ chars, letters/numbers/underscores).');
      CE.validateField(emailField, emailOk, 'Enter a valid email address.');
      CE.validateField(passField, passwordOk, 'Use at least 8 characters.');
      CE.validateField(confirmField, confirmOk, 'Passwords do not match.');

      if (!usernameOk || !emailOk || !passwordOk || !confirmOk) return;

      CE.setButtonLoading(submitBtn, true);
      try {
        await CampusEnergyAPI.signup({ username, email, password, confirmPassword: confirm });
        try {
          await CampusEnergyAPI.login(username, password);
        } catch (loginErr) {
          console.warn('Auto-login failed:', loginErr);
        }
        CE.toast(`Welcome to CampusEnergy, ${username}!`, 'success', 1800);
        setTimeout(() => (window.location.href = 'profile.html'), 700);
      } catch (err) {
        const msg = err.message || 'Could not create account.';
        CE.toast(msg, 'error');
        // Surface field-specific duplicate errors
        const lmsg = msg.toLowerCase();
        if (lmsg.includes('username')) CE.validateField(usernameField, false, msg);
        else if (lmsg.includes('email')) CE.validateField(emailField, false, msg);
      } finally {
        CE.setButtonLoading(submitBtn, false);
      }
    });
  }

  function updateStrength(value, bar) {
    let score = 0;
    if (value.length >= 8)          score++;
    if (/[A-Z]/.test(value))        score++;
    if (/[0-9]/.test(value))        score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    const pcts   = [0, 28, 55, 80, 100];
    const colors = ['#fb7185', '#fb7185', '#fbbf68', '#5eead4', '#2dd4bf'];
    bar.style.width      = pcts[score] + '%';
    bar.style.background = colors[score];
  }

  function isValidUsername(v) {
    return v.length >= 3 && /^[a-zA-Z0-9_]+$/.test(v);
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  return { init };
})();

CE.initAll({ topbar: {}, onReady: SignupPage.init });
