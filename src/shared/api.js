//For Comments and Posts

async function getPosts() {
    return request(ENDPOINTS.posts());
}

async function getPost(id) {
    return request(ENDPOINTS.post(id));
}

async function createPost(data) {
    return request(
        ENDPOINTS.posts(),
        {
            method: "POST",
            body: JSON.stringify(data)
        }
    );
}

async function updatePost(id, data) {
    return request(
        ENDPOINTS.post(id),
        {
            method: "PUT",
            body: JSON.stringify(data)
        }
    );
}

async function deletePost(id) {
    return request(
        ENDPOINTS.post(id),
        {
            method: "DELETE"
        }
    );
}


async function getComments(postId) {
    return request(
        ENDPOINTS.comments(postId)
    );
}

async function createComment(postId, text) {

    return request(
        ENDPOINTS.comments(postId),
        {
            method: "POST",
            body: JSON.stringify({
                text
            })
        }
    );

}

async function deleteComment(commentId) {

    return request(
        ENDPOINTS.comment(commentId),
        {
            method: "DELETE"
        }
    );

}


async function likePost(postId) {

    return request(
        ENDPOINTS.like(postId),
        {
            method: "POST"
        }
    );

}

async function unlikePost(postId) {

    return request(
        ENDPOINTS.like(postId),
        {
            method: "DELETE"
        }
    );

}

async function getSavedPosts() {

    return request(
        ENDPOINTS.savedPosts()
    );

}


//Saving of Posts 
async function savePost(postId) {

    return request(
        ENDPOINTS.savePost(postId),
        {
            method: "POST"
        }
    );

}

async function unsavePost(postId) {

    return request(
        ENDPOINTS.savePost(postId),
        {
            method: "DELETE"
        }
    );

}


//User Functions
async function getCurrentUser() {

    return request(
        ENDPOINTS.currentUser()
    );

}

async function getProfile(username) {

    return request(
        ENDPOINTS.profile(username)
    );

}


//Searching of Posts
async function search(query) {

    return request(
        ENDPOINTS.search(query)
    );

}


const CampusEnergyAPI = (() => {

  const CONFIG = {
    BASE_URL: window.__CE_API_BASE__ || "http://127.0.0.1:8001",
    USE_MOCKS: false,
    TIMEOUT_MS: 12000,
  };

  const ENDPOINTS = {

    /* Authentication */
    login: () => `${CONFIG.BASE_URL}/login`,
    createUser: () => `${CONFIG.BASE_URL}/create_user`,
    health: () => `${CONFIG.BASE_URL}/health`,

    /* Machine Learning */
    predict: () => `${CONFIG.BASE_URL}/predict`,
    causalPredict: () => `${CONFIG.BASE_URL}/causal_predict`,
    recommend: () => `${CONFIG.BASE_URL}/recommend`,

    /* Community */
    posts: () => `${CONFIG.BASE_URL}/posts`,
    post: (id) => `${CONFIG.BASE_URL}/posts/${id}`,

    /* Comments */
    comments: (id) => `${CONFIG.BASE_URL}/posts/${id}/comments`,
    comment: (id) => `${CONFIG.BASE_URL}/comments/${id}`,

    /* Likes */
    like: (id) => `${CONFIG.BASE_URL}/posts/${id}/like`,

    /* Saved Posts */
    savedPosts: () => `${CONFIG.BASE_URL}/saved`,
    savePost: (id) => `${CONFIG.BASE_URL}/posts/${id}/save`,

    /* Users */
    currentUser: () => `${CONFIG.BASE_URL}/users/me`,
    profile: (username) => `${CONFIG.BASE_URL}/users/${username}`,

    /* Search */
    search: (query) =>
      ` ${CONFIG.BASE_URL}/search?q=${encodeURIComponent(query)}`
  };

  class APIError extends Error {
    constructor(message, status, body) {
      super(message);
      this.name = "APIError";
      this.status = status;
      this.body = body;
    }
  }

  function persistSession(session) {
    sessionStorage.setItem("ce_session", JSON.stringify(session));
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem("ce_session"));
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem("ce_session");
  }

  function getToken() {
    return readSession()?.access_token;
  }

  async function request(url, options = {}) {

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      CONFIG.TIMEOUT_MS
    );

    try {

      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
      };

      const token = getToken();

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {

        const body = await res.json().catch(() => ({}));

        throw new APIError(
          body.detail || body.message || `HTTP ${res.status}`,
          res.status,
          body
        );
      }

      return res.status === 204
        ? null
        : await res.json();

    } catch (err) {

      clearTimeout(timer);

      throw err instanceof APIError
        ? err
        : new APIError(err.message, 0);

    }
  }

  /* ---------------- AUTH ---------------- */

  async function login(username, password) {

    const session = await request(
      ENDPOINTS.login(),
      {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      }
    );

    persistSession(session);

    return session;
  }

  async function createUser(username, email, password) {

    return request(
      ENDPOINTS.createUser(),
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

  async function logout() {

    clearSession();

    return true;
  }

  /* ---------------- ML ---------------- */

  async function predict(data) {

    return request(
      ENDPOINTS.predict(),
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async function causalPredict(data) {

    return request(
      ENDPOINTS.causalPredict(),
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async function recommend(data) {

    return request(
      ENDPOINTS.recommend(),
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  }

  async function health() {

    return request(
      ENDPOINTS.health()
    );
  }

  return {

    config: CONFIG,
    endpoints: ENDPOINTS,

    /* Authentication */
    login,
    createUser,
    logout,

    /* Machine Learning */
    predict,
    causalPredict,
    recommend,

    /* Community */
    getPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,

    /* Comments */
    getComments,
    createComment,
    deleteComment,

    /* Likes */
    likePost,
    unlikePost,

    /* Saved */
    getSavedPosts,
    savePost,
    unsavePost,

    /* Users */
    getCurrentUser,
    getProfile,

    /* Search */
    search,

    /* Utilities */
    health,

    readSession,
    clearSession,

    APIError
  };

})();