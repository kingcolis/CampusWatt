// shared/signup.js
console.log("NEW SIGNUP.JS LOADED");
alert("NEW SIGNUP.JS");
const SignupPage = (() => {

    function init() {

        if (CampusEnergyAPI.readSession()) {
            window.location.replace("profile.html");
            return;
        }

        const form = document.getElementById("signupForm");
        const submitBtn = document.getElementById("submitBtn");

        const usernameField = document.getElementById("usernameField");
        const emailField = document.getElementById("emailField");
        const passwordField = document.getElementById("passwordField");
        const confirmField = document.getElementById("confirmField");

        const usernameInput = document.getElementById("username");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const confirmInput = document.getElementById("confirmPassword");

        form.addEventListener("submit", async (e) => {

            e.preventDefault();

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirm = confirmInput.value;

            const usernameOk = username.length >= 3;
            const emailOk = isEmail(email);
            const passwordOk = password.length >= 8;
            const confirmOk = password === confirm;

            CE.validateField(
                usernameField,
                usernameOk,
                "Username must be at least 3 characters."
            );

            CE.validateField(
                emailField,
                emailOk,
                "Enter a valid email address."
            );

            CE.validateField(
                passwordField,
                passwordOk,
                "Password must be at least 8 characters."
            );

            CE.validateField(
                confirmField,
                confirmOk,
                "Passwords do not match."
            );

            if (
                !usernameOk ||
                !emailOk ||
                !passwordOk ||
                !confirmOk
            ) {
                return;
            }

            CE.setButtonLoading(submitBtn, true);

            try {

                await CampusEnergyAPI.createUser(
                    username,
                    email,
                    password
                );

                CE.toast(
                    "Account created successfully!",
                    "success"
                );

                setTimeout(() => {

                    window.location.href = "login.html";

                }, 1200);

            }

            catch (err) {

                CE.toast(
                    err.message || "Could not create account.",
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

    function isEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    }

    return {
        init
    };

})();

console.log({
    form,
    submitBtn,
    usernameField,
    emailField,
    passwordField,
    confirmField,
    usernameInput,
    emailInput,
    passwordInput,
    confirmInput
});
CE.initAll({

    topbar: {},

    onReady: SignupPage.init

});
