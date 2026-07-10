// login.js

const LoginPage = (() => {

  function init() {

    // Already logged in
    if (CampusEnergyAPI.readSession()) {
      window.location.replace("profile.html");
      return;
    }

    const form = document.getElementById("loginForm");

    const submitBtn = document.getElementById("submitBtn");

    const usernameField = document.getElementById("usernameField");
    const passwordField = document.getElementById("passwordField");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    usernameInput.addEventListener("blur", () => {
      CE.validateField(
        usernameField,
        usernameInput.value.trim().length > 0,
        "Username is required."
      );
    });

    passwordInput.addEventListener("blur", () => {
      CE.validateField(
        passwordField,
        passwordInput.value.length > 0,
        "Password is required."
      );
    });

    form.addEventListener("submit", async (e) => {

      e.preventDefault();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      const usernameOk = username.length > 0;
      const passwordOk = password.length > 0;

      CE.validateField(
        usernameField,
        usernameOk,
        "Username is required."
      );

      CE.validateField(
        passwordField,
        passwordOk,
        "Password is required."
      );

      if (!usernameOk || !passwordOk) return;

      CE.setButtonLoading(submitBtn, true);

      try {

        await CampusEnergyAPI.login(username, password);

        CE.toast("Signed in successfully!", "success", 1500);

        const redirect =
          new URLSearchParams(location.search).get("next") ||
          "profile.html";

        setTimeout(() => {
          window.location.href = redirect;
        }, 500);

      } catch (err) {

        CE.toast(err.message || "Invalid username or password.", "error");

        CE.validateField(usernameField, false, " ");
        CE.validateField(passwordField, false, "Invalid username or password.");

        passwordInput.value = "";
        passwordInput.focus();

      } finally {

        CE.setButtonLoading(submitBtn, false);

      }

    });

  }

  return { init };

})();

CE.initAll({
  topbar: {},
  onReady: LoginPage.init
});
