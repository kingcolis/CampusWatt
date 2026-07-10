// shared/login.js

const LoginPage = (() => {

    function init() {

        // Already logged in
        if (CampusEnergyAPI.readSession()) {
            window.location.href = "profile.html";
            return;
        }

        const form = document.getElementById("loginForm");

        const submitBtn = document.getElementById("submitBtn");

        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        const usernameField = document.getElementById("usernameField");
        const passwordField = document.getElementById("passwordField");

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

            if (!usernameOk || !passwordOk) {
                return;
            }

            CE.setButtonLoading(
                submitBtn,
                true
            );

            try {

                await CampusEnergyAPI.login(
                    username,
                    password
                );

                CE.toast(
                    "Login successful!",
                    "success"
                );

                setTimeout(() => {

                    window.location.href =
                        "profile.html";

                }, 500);

            }

            catch (err) {

                CE.toast(
                    err.message || "Invalid username or password.",
                    "error"
                );

            }

            finally {

                CE.setButtonLoading(
                    submitBtn,
                    false
                );

            }

        });

    }

    return {
        init
    };

})();

CE.initAll({

    onReady: LoginPage.init

});