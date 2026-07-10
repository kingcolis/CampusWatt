const PostsPage = (() => {

    let posts = [];

    async function init() {

        if (!CampusEnergyAPI.readSession()) {

            window.location.href = "login.html";
            return;

        }

        document
            .getElementById("createPostBtn")
            ?.addEventListener(
                "click",
                createPost
            );

        document
            .getElementById("searchInput")
            ?.addEventListener(
                "input",
                filterPosts
            );

        await refreshPosts();

    }

    //////////////////////////////////////////////////////

    async function refreshPosts() {

        try {

            posts =
                await CampusEnergyAPI.getPosts();

            renderPosts(posts);

        }

        catch (err) {

            CE.toast(

                err.message,

                "error"

            );

        }

    }

    //////////////////////////////////////////////////////

    function renderPosts(data) {

        const list =
            document.getElementById(
                "postsList"
            );

        if (!data.length) {

            list.innerHTML =

            `
            <div class="panel">

                <h3>

                    No posts yet.

                </h3>

            </div>
            `;

            return;

        }

        list.innerHTML = data.map(post =>

        `

<article class="panel post-row">

<div>

<h3>

${post.title}

</h3>

<p>

${post.content}

</p>

<span class="meta">

${post.author}

</span>

</div>

<div>

<button
class="btn"
onclick="location.href='post.html?id=${post.id}'">

Open

</button>

<button
class="btn"
onclick="PostsPage.deletePost('${post.id}')">

Delete

</button>

</div>

</article>

`

        ).join("");

    }

    //////////////////////////////////////////////////////

    async function createPost() {

        const title = prompt(

            "Post title"

        );

        if (!title) return;

        const content = prompt(

            "Post content"

        );

        if (!content) return;

        try {

            await CampusEnergyAPI.createPost(

                title,

                content

            );

            CE.toast(

                "Post created.",

                "success"

            );

            refreshPosts();

        }

        catch (err) {

            CE.toast(

                err.message,

                "error"

            );

        }

    }

    //////////////////////////////////////////////////////

    async function deletePost(id) {

        if (

            !confirm(

                "Delete this post?"

            )

        ) {

            return;

        }

        try {

            await CampusEnergyAPI.deletePost(

                id

            );

            CE.toast(

                "Deleted.",

                "success"

            );

            refreshPosts();

        }

        catch (err) {

            CE.toast(

                err.message,

                "error"

            );

        }

    }

    //////////////////////////////////////////////////////

    function filterPosts(e) {

        const query =
            e.target.value
            .toLowerCase();

        const filtered =
            posts.filter(post =>

                post.title
                    .toLowerCase()
                    .includes(query)

                ||

                post.content
                    .toLowerCase()
                    .includes(query)

            );

        renderPosts(filtered);

    }

    //////////////////////////////////////////////////////

    return {

        init,

        deletePost

    };

})();

window.PostsPage = PostsPage;

CE.initAll({

    onReady: PostsPage.init

});