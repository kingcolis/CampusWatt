const ProfilePage = (() => {

    async function init() {

        const logoutBtn =
            document.getElementById("logoutBtn");

        logoutBtn.onclick = () => {

            CampusEnergyAPI.logout();

            window.location.href = "login.html";

        };

        try {

            const session =
                CampusEnergyAPI.readSession();

            if (!session) {

                window.location.href = "login.html";
                return;

            }

            /*
                Backend endpoint:

                GET /users/{user_id}

                Since login only stores username,
                we use username as user_id.
            */

            const user =
                await CampusEnergyAPI.getProfile(
                    session.username
                );

            document.getElementById("username").textContent =
                user.username;

            document.getElementById("email").textContent =
                user.email;

            /*
                User posts

                GET /users/{user_id}/posts
            */

            const posts =
                await CampusEnergyAPI.getUserPosts(
                    session.username
                );

            document.getElementById("postCount").textContent =
                posts.length;

            const container =
                document.getElementById("posts");

            if (posts.length === 0) {

                container.innerHTML =
                    "<p>No posts yet.</p>";

                return;

            }

            container.innerHTML =
                posts.map(post => `

<div class="panel post">

<h3>${post.title}</h3>

<p>${post.content}</p>

<a href="post.html?id=${post.id}">

Open →

</a>

</div>

                `).join("");

        }

        catch(err){

            CE.toast(
                err.message,
                "error"
            );

        }

    }

    return {
        init
    };

})();

CE.initAll({

    topbar:{},

    onReady:ProfilePage.init

});