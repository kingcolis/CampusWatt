// shared/api.js

const CampusEnergyAPI = (() => {

    const BASE_URL = "http://127.0.0.1:8001";

    /* ------------------------- */

    async function request(endpoint, options = {}) {

        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const token = localStorage.getItem("access_token");

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
            BASE_URL + endpoint,
            {
                ...options,
                headers
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch (_) {}

        if (!response.ok) {

            throw new Error(
                data.detail ||
                data.message ||
                "Request failed."
            );

        }

        return data;
    }

    /* ------------------------- */
    /* Authentication            */
    /* ------------------------- */

    async function login(username, password) {

        const data = await request(
            "/login",
            {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        localStorage.setItem(
            "access_token",
            data.access_token
        );

        return data;

    }

    async function createUser(
        username,
        email,
        password
    ) {

        return request(
            "/create_user",
            {
                method: "POST",
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            }
        );

    }

    function logout() {

        localStorage.removeItem(
            "access_token"
        );

    }

    function readSession() {

        return localStorage.getItem(
            "access_token"
        );

    }

    /* ------------------------- */
    /* Users                     */
    /* ------------------------- */

    async function getCurrentUser() {

        return request(
            "/users/me"
        );

    }

    async function getProfile(userId) {

        return request(
            `/users/${userId}`
        );

    }

    async function followUser(userId) {

        return request(
            `/users/${userId}/follow`,
            {
                method: "POST"
            }
        );

    }

    async function unfollowUser(userId) {

        return request(
            `/users/${userId}/follow`,
            {
                method: "DELETE"
            }
        );

    }

    /* ------------------------- */
    /* Posts                     */
    /* ------------------------- */

    async function getPosts() {

        return request(
            "/posts"
        );

    }

    async function getPost(postId) {

        return request(
            `/posts/${postId}`
        );

    }

    async function createPost(
        title,
        content
    ) {

        return request(
            "/posts",
            {
                method: "POST",
                body: JSON.stringify({
                    title,
                    content
                })
            }
        );

    }

    async function editPost(
        id,
        title,
        content
    ) {

        return request(
            `/posts/${id}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    title,
                    content
                })
            }
        );

    }

    async function deletePost(id) {

        return request(
            `/posts/${id}`,
            {
                method: "DELETE"
            }
        );

    }

    async function likePost(id) {

        return request(
            `/posts/${id}/like`,
            {
                method: "POST"
            }
        );

    }

    async function unlikePost(id) {

        return request(
            `/posts/${id}/like`,
            {
                method: "DELETE"
            }
        );

    }

    async function savePost(id) {

        return request(
            `/posts/${id}/save`,
            {
                method: "POST"
            }
        );

    }

    async function unsavePost(id) {

        return request(
            `/posts/${id}/save`,
            {
                method: "DELETE"
            }
        );

    }

    /* ------------------------- */
    /* Comments                  */
    /* ------------------------- */

    async function getComments(postId) {

        return request(
            `/posts/${postId}/comments`
        );

    }

    async function createComment(
        postId,
        content
    ) {

        return request(
            `/posts/${postId}/comments`,
            {
                method: "POST",
                body: JSON.stringify({
                    content
                })
            }
        );

    }

    async function deleteComment(commentId) {

        return request(
            `/comments/${commentId}`,
            {
                method: "DELETE"
            }
        );

    }

    /* ------------------------- */
    /* Machine Learning          */
    /* ------------------------- */

    async function predict(body) {

        return request(
            "/predict",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

    }

    async function causalPredict(body) {

        return request(
            "/causal_predict",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

    }

    async function recommend(body) {

        return request(
            "/recommend",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

    }

    async function getUserPosts(username){
        profilePosts:(username)=>`${CONFIG.BASE_URL}/users/${username}/posts`,
        return request(
            
            endpoint.profilePosts(username),

            {
            method:"GET"
            }
        );

    }


    return {

        login,
        logout,
        readSession,

        createUser,

        getCurrentUser,
        getProfile,

        followUser,
        unfollowUser,
        getUserPosts,
        getPosts,
        getPost,
        createPost,
        editPost,
        deletePost,

        likePost,
        unlikePost,

        savePost,
        unsavePost,

        getComments,
        createComment,
        deleteComment,

        predict,
        causalPredict,
        recommend

    };

})();