// shared/app.js

const CE = (() => {

    /* -------------------------- */
    /* Button Loading             */
    /* -------------------------- */

    function setButtonLoading(button, loading) {

        if (!button) return;

        button.disabled = loading;

        button.classList.toggle(
            "is-loading",
            loading
        );

    }

    /* -------------------------- */
    /* Toast                      */
    /* -------------------------- */

    function toast(
        message,
        type = "success"
    ) {

        const toast = document.createElement("div");

        toast.className = `toast ${type}`;

        toast.innerHTML = message;

        document.body.appendChild(toast);

        setTimeout(() => {

            toast.classList.add("show");

        }, 50);

        setTimeout(() => {

            toast.classList.remove("show");

            setTimeout(() => {

                toast.remove();

            }, 300);

        }, 2500);

    }

    /* -------------------------- */
    /* Validation                 */
    /* -------------------------- */

    function validateField(

        field,
        valid,
        message

    ) {

        if (!field) return;

        field.classList.remove(
            "valid",
            "invalid"
        );

        field.classList.add(
            valid
                ? "valid"
                : "invalid"
        );

        const err = field.querySelector(
            ".field-error"
        );

        if (err) {

            err.textContent = message;

        }

    }

    /* -------------------------- */
    /* Navbar                     */
    /* -------------------------- */

    async function mountTopbar() {

        const container =
            document.getElementById(
                "site-topbar"
            );

        if (!container) return;

        let loggedIn = false;
        let username = "";

        try {

            if (
                CampusEnergyAPI.readSession()
            ) {

                const me =
                    await CampusEnergyAPI.getCurrentUser();

                loggedIn = true;
                username = me.username;

            }

        }

        catch (_) {

            CampusEnergyAPI.logout();

        }

        container.innerHTML = `

<header class="topbar">

<a class="brand" href="index.html">

CampusEnergy

</a>

<nav>

<a href="index.html">

Home

</a>

<a href="posts.html">

Posts

</a>

<a href="about.html">

About

</a>

</nav>

<div>

${

loggedIn

?

`

<span>

${username}

</span>

<button id="logoutBtn">

Logout

</button>

`

:

`

<a
class="btn"
href="login.html">

Login

</a>

`

}

</div>

</header>

`;

        const logoutBtn =
            document.getElementById(
                "logoutBtn"
            );

        if (logoutBtn) {

            logoutBtn.onclick = () => {

                CampusEnergyAPI.logout();

                window.location.href =
                    "login.html";

            };

        }

    }

    /* -------------------------- */
    /* Footer                     */
    /* -------------------------- */

    function mountFooter() {

        const footer =
            document.getElementById(
                "site-footer"
            );

        if (!footer) return;

        footer.innerHTML = `

<footer class="site-footer">

<p>

CampusEnergy © 2026

</p>

</footer>

`;

    }

    /* -------------------------- */
    /* Page Init                  */
    /* -------------------------- */

    function initAll(options = {}) {

        const run = async () => {

            await mountTopbar();

            mountFooter();

            if (
                typeof options.onReady ===
                "function"
            ) {

                options.onReady();

            }

        };

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                run
            );

        }

        else {

            run();

        }

    }

    return {

        initAll,

        toast,

        validateField,

        setButtonLoading

    };

})();