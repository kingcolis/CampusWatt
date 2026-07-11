import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import psycopg
import json
import os
from psycopg.rows import dict_row
from werkzeug.security import generate_password_hash
import uuid
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv

load_dotenv()

USE_MOCK_DB = False
MOCK_USERS = []
MOCK_POSTS = []
MOCK_PREDICTIONS = {}
MOCK_CAUSALS = {}
MOCK_RECOMMENDATIONS = {}

MOCK_DB_FILE = os.path.join(os.path.dirname(__file__), "mock_db.json")

def load_mock_db():
    global MOCK_USERS, MOCK_POSTS
    if os.path.exists(MOCK_DB_FILE):
        try:
            with open(MOCK_DB_FILE, "r") as f:
                data = json.load(f)
                MOCK_USERS = data.get("users", [])
                MOCK_POSTS = data.get("posts", [])
                print(f"[DB] Loaded {len(MOCK_USERS)} users and {len(MOCK_POSTS)} posts from mock_db.json")
        except Exception as e:
            print(f"[DB] Error loading mock_db.json: {e}")

def save_mock_db():
    try:
        with open(MOCK_DB_FILE, "w") as f:
            json.dump({
                "users": MOCK_USERS,
                "posts": MOCK_POSTS
            }, f, indent=2)
    except Exception as e:
        print(f"[DB] Error saving mock_db.json: {e}")

DB_PASSWORD = os.getenv("db_password")
DB_USER = os.getenv("db_user")


DB_POOL = AsyncConnectionPool(
    conninfo=f"""
        host=localhost
        port=5432
        dbname=campuswatt
        user={DB_USER}
        password={DB_PASSWORD}
    """,
    min_size=2,
    max_size=10,
    open=False
)

async def migrate_db():
    global USE_MOCK_DB
    try:
        async with DB_POOL.connection(timeout=2.0) as db:
            pass
    except Exception as e:
        print(f"[DB] PostgreSQL database offline: {e}. Switching to IN-MEMORY MOCK DATABASE.")
        USE_MOCK_DB = True
        load_mock_db()
        return

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute("""
                CREATE EXTENSION IF NOT EXISTS pgcrypto;

                CREATE TABLE IF NOT EXISTS users(
                    id BIGSERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS prediction_results(
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    model_name VARCHAR(100) NOT NULL,
                    model_version VARCHAR(50),
                    input_data JSONB NOT NULL,
                    prediction_output JSONB NOT NULL,
                    explanation TEXT NOT NULL,
                    feature_importance JSONB,
                    confidence_score NUMERIC(5,4)
                    CHECK (confidence_score >= 0 AND confidence_score <= 1),
                    inference_time_ms INTEGER,
                    has_error BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS causal_results(
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    model_name VARCHAR(100) NOT NULL,
                    model_version VARCHAR(50),
                    input_data JSONB NOT NULL,
                    prediction_output JSONB NOT NULL,
                    inference_time_ms INTEGER,
                    has_error BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS recommendation_results(
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    recommendation TEXT NOT NULL,
                    confidence_score NUMERIC(5,4),
                    source_documents JSONB,
                    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS audit_logs(
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT REFERENCES users(id),
                    action VARCHAR(255),
                    endpoint VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );

                --Social Media Tables--

                CREATE OR REPLACE FUNCTION update_timestamp()
                    RETURNS TRIGGER AS
                $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$
                LANGUAGE plpgsql;

                CREATE TABLE IF NOT EXISTS posts(
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                    author_id BIGINT NOT NULL
                        REFERENCES users(id)
                        ON DELETE CASCADE,

                    title TEXT NOT NULL,

                    body TEXT NOT NULL,
                    images JSONB DEFAULT '[]'::jsonb,
                    prediction_result_id UUID
                    REFERENCES prediction_results(id)
                        ON DELETE SET NULL,

                    causal_result_id UUID
                    REFERENCES causal_results(id)
                        ON DELETE SET NULL,

                    recommendation_result_id UUID
                    REFERENCES recommendation_results(id)
                        ON DELETE SET NULL,

                    visibility VARCHAR(20)
                        DEFAULT 'public',
                    CHECK (
                        visibility IN ('public','private','friends')
                    ),

                    created_at TIMESTAMPTZ
                        DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ
                        DEFAULT CURRENT_TIMESTAMP,

                    CHECK (length(trim(title)) > 0)
                );

                CREATE TABLE IF NOT EXISTS likes(
                    user_id BIGINT NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
                    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, post_id)
                );

                CREATE TABLE IF NOT EXISTS saved_posts(
                    user_id BIGINT NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
                    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, post_id)
                );

                CREATE TABLE IF NOT EXISTS followers(
                    follower_id BIGINT NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
                    following_id BIGINT NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
                    PRIMARY KEY (follower_id, following_id),
                    CHECK (follower_id <> following_id)
                );

                CREATE TABLE IF NOT EXISTS comments(
                    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    user_id BIGINT NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
                    parent_comment_id UUID
                        REFERENCES comments(id)
                        ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    CHECK (length(trim(text)) > 0)
                );

                CREATE INDEX IF NOT EXISTS idx_posts_created
                ON posts(created_at DESC);

                CREATE INDEX IF NOT EXISTS idx_posts_author
                ON posts(author_id);

                CREATE INDEX IF NOT EXISTS idx_comments_post
                ON comments(post_id);

                CREATE INDEX IF NOT EXISTS idx_comments_created
                ON comments(created_at DESC);

                CREATE INDEX IF NOT EXISTS idx_prediction_created
                ON prediction_results(created_at);

                CREATE INDEX IF NOT EXISTS idx_causal_created
                ON causal_results(created_at);

                CREATE INDEX IF NOT EXISTS idx_followers_follower
                ON followers(follower_id);

                CREATE INDEX IF NOT EXISTS idx_followers_following
                ON followers(following_id);

                CREATE INDEX IF NOT EXISTS idx_likes_post
                ON likes(post_id);

                CREATE INDEX IF NOT EXISTS idx_saved_posts_user
                ON saved_posts(user_id);
        
                DROP TRIGGER IF EXISTS update_posts_timestamp ON posts;

                CREATE TRIGGER update_posts_timestamp
                BEFORE UPDATE ON posts
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
            """)
        await db.commit()

    print("[DB] Database migrated")

async def close_db():

    await DB_POOL.close()

    print("[DB] Pool closed")


async def user_retrieval(username: str):
    if USE_MOCK_DB:
        for u in MOCK_USERS:
            if u["username"] == username or u["email"] == username:
                return u
        if username in ["user", "user@campusenergy.edu"]:
            u = {"id": 1, "username": "user", "email": "user@campusenergy.edu", "password_hash": generate_password_hash("password")}
            MOCK_USERS.append(u)
            return u
        elif username in ["prof", "prof@campusenergy.edu"]:
            u = {"id": 2, "username": "prof", "email": "prof@campusenergy.edu", "password_hash": generate_password_hash("password")}
            MOCK_USERS.append(u)
            return u
        return None

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                SELECT
                    id,
                    username,
                    email,
                    password_hash
                FROM users
                WHERE username=%s
                """,
                (username,)
            )

            row = await cursor.fetchone()

    if row is None:
        return None

    return {
        "id": row[0],
        "username": row[1],
        "email": row[2],
        "password_hash": row[3]
    }


async def create_user_db(
    username: str,
    email: str,
    password: str
):

    password_hash = generate_password_hash(password)

    if USE_MOCK_DB:
        user_id = len(MOCK_USERS) + 1
        MOCK_USERS.append({
            "id": user_id,
            "username": username,
            "email": email,
            "password_hash": password_hash
        })
        save_mock_db()
        return user_id

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                INSERT INTO users(
                    username,
                    email,
                    password_hash
                )
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (
                    username,
                    email,
                    password_hash
                )
            )

            user_id = await cursor.fetchone()

        await db.commit()

    return user_id[0]

#Sanity Check
print("DB_USER =", DB_USER)
print("DB_PASSWORD_SET =", DB_PASSWORD is not None)


async def save_prediction_result(
    model_name,
    input_data,
    prediction_output,
    explanation="",
    confidence_score=None,
    inference_time_ms=None,
    has_error=False
):
    if USE_MOCK_DB:
        return

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                INSERT INTO prediction_results(
                    model_name,
                    input_data,
                    prediction_output,
                    explanation,
                    confidence_score,
                    inference_time_ms,
                    has_error
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    model_name,
                    psycopg.types.json.Jsonb(input_data),
                    psycopg.types.json.Jsonb(prediction_output),
                    explanation,
                    confidence_score,
                    inference_time_ms,
                    has_error
                )
            )

    await db.commit()


async def save_causal_result(
    model_name: str,
    input_data: dict,
    output: dict,
    inference_time_ms: int,
    has_error: bool
):
    if USE_MOCK_DB:
        return
    
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO causal_results(
                    model_name,
                    input_data,
                    prediction_output,
                    inference_time_ms,
                    has_error
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    model_name,
                    psycopg.types.json.Jsonb(input_data),
                    psycopg.types.json.Jsonb(output),
                    inference_time_ms,
                    has_error
                )
            )

    await db.commit()


async def save_recommendation_result(
    recommendation: str,
    confidence_score: float,
    source_documents: list[str]
):
    if USE_MOCK_DB:
        return

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                INSERT INTO recommendation_results(
                    recommendation,
                    confidence_score,
                    source_documents
                )
                VALUES (%s, %s, %s)
                """,
                (
                    recommendation,
                    confidence_score,
                    psycopg.types.json.Jsonb(source_documents)
                )
            )

    await db.commit()


#Social Media Functions
async def save_post(
    author_id: int,
    title: str,
    body: str,
    images: list,
    prediction_result_id=None,
    causal_result_id=None,
    recommendation_result_id=None,
    visibility="public"
):
    if USE_MOCK_DB:
        post_id = str(uuid.uuid4())
        username = "Anonymous"
        for u in MOCK_USERS:
            if u["id"] == author_id:
                username = u["username"]
                break
        
        post = {
            "id": post_id,
            "author_id": author_id,
            "username": username,
            "title": title,
            "body": body,
            "content": body,
            "images": images,
            "visibility": visibility,
            "created_at": "2026-07-11T12:00:00Z",
            "date": "Just now",
            "likes": 0,
            "comments": 0
        }
        MOCK_POSTS.insert(0, post)
        save_mock_db()
        return post_id

    post_id = str(uuid.uuid4())
    
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute("""
                INSERT INTO posts(
                    id,
                    author_id,
                    title,
                    body,
                    images,
                    prediction_result_id,
                    causal_result_id,
                    recommendation_result_id,
                    visibility
                )
                VALUES(
                    %s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                """,
                (
                    post_id,
                    author_id,
                    title,
                    body,
                    json.dumps(images),
                    prediction_result_id,
                    causal_result_id,
                    recommendation_result_id,
                    visibility
                )
            )
    await db.commit()

    return post_id


async def fetch_posts(limit=25):
    if USE_MOCK_DB:
        if not MOCK_POSTS:
            MOCK_POSTS.append({
                "id": "post-uuid-1",
                "author_id": 1,
                "username": "user",
                "title": "Smart Building Heating Analysis",
                "body": "We analyzed the heating load in Campus Hall 3 and found that reducing setpoints by 1.5°C over the weekend saved 14% energy without impact on occupant comfort.",
                "content": "We analyzed the heating load in Campus Hall 3 and found that reducing setpoints by 1.5°C over the weekend saved 14% energy without impact on occupant comfort.",
                "visibility": "public",
                "created_at": "2026-07-10T14:32:00Z",
                "likes": 5,
                "comments": 2
            })
            MOCK_POSTS.append({
                "id": "post-uuid-2",
                "author_id": 2,
                "username": "prof",
                "title": "Causal Inference in Campus Grid Management",
                "body": "Applying double machine learning to estimate the causal impact of dynamic line ratings shows significant potential during peak hours.",
                "content": "Applying double machine learning to estimate the causal impact of dynamic line ratings shows significant potential during peak hours.",
                "visibility": "public",
                "created_at": "2026-07-11T09:15:00Z",
                "likes": 12,
                "comments": 4
            })
        return MOCK_POSTS[:limit]

    async with DB_POOL.connection() as db:
        async with db.cursor(row_factory=dict_row) as cursor:

            await cursor.execute(
                """
                SELECT
                    p.*,
                    u.username,

                    (
                        SELECT COUNT(*)
                        FROM likes
                        WHERE post_id = p.id
                    ) AS likes,

                    (
                        SELECT COUNT(*)
                        FROM comments
                        WHERE post_id = p.id
                    ) AS comments

                FROM posts p

                JOIN users u
                ON p.author_id = u.id

                ORDER BY p.created_at DESC

                LIMIT %s
                """,
                (limit,)
            )

            return await cursor.fetchall()


async def fetch_post(post_id):
    if USE_MOCK_DB:
        for p in MOCK_POSTS:
            if p["id"] == post_id:
                return p
        return None

    async with DB_POOL.connection() as db:
        async with db.cursor(row_factory=dict_row) as cursor:

            await cursor.execute(
                """
                SELECT
                    p.*,
                    u.username

                FROM posts p

                JOIN users u
                ON u.id = p.author_id

                WHERE p.id = %s
                """,
                (post_id,)
            )

            return await cursor.fetchone()


async def remove_post(
    post_id,
    author_id
):
    if USE_MOCK_DB:
        global MOCK_POSTS
        MOCK_POSTS = [p for p in MOCK_POSTS if not (p["id"] == post_id and p["author_id"] == author_id)]
        save_mock_db()
        return

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                DELETE FROM posts

                WHERE
                    id = %s
                AND
                    author_id = %s
                """,
                (
                    post_id,
                    author_id
                )
            )

        await db.commit()

async def update_post(
    post_id,
    author_id,
    request
):

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                UPDATE posts

                SET
                    title = %s,
                    body = %s,
                    images = %s,
                    visibility = %s,
                    updated_at = NOW()

                WHERE
                    id = %s
                AND
                    author_id = %s
                """,
                (
                    request.title,
                    request.body,
                    json.dumps(request.images),
                    request.visibility,
                    post_id,
                    author_id
                )
            )

        await db.commit()


async def like_post_db(user_id: int, post_id: str):

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                INSERT INTO likes(user_id, post_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING;
                """,
                (user_id, post_id)
            )

        await db.commit()


async def unlike_post_db(user_id: int, post_id: str):

    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:

            await cursor.execute(
                """
                DELETE FROM likes
                WHERE user_id = %s
                AND post_id = %s;
                """,
                (user_id, post_id)
            )

        await db.commit()


async def get_profile(user_id: int):
    if USE_MOCK_DB:
        for u in MOCK_USERS:
            if u["id"] == user_id:
                res = u.copy()
                res["userType"] = "Student" if res["id"] % 2 == 1 else "Faculty"
                res["age"] = 21 if res["userType"] == "Student" else 42
                res["course"] = "Computer Engineering"
                res["position"] = "Associate Professor"
                res["about"] = "Passionate about smart campus sustainability and platform engineering."
                return res
        return None

    async with DB_POOL.connection() as db:
        async with db.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                """
                SELECT id, username, email FROM users WHERE id = %s
                """,
                (user_id,)
            )
            user = await cursor.fetchone()
            if user:
                user["userType"] = "Student" if user["id"] % 2 == 1 else "Faculty"
                user["age"] = 21 if user["userType"] == "Student" else 42
                user["course"] = "Computer Engineering"
                user["position"] = "Associate Professor"
                user["about"] = "Passionate about smart campus sustainability and platform engineering."
            return user


async def fetch_user_posts(user_id: int):
    if USE_MOCK_DB:
        return [p for p in MOCK_POSTS if p["author_id"] == user_id]

    async with DB_POOL.connection() as db:
        async with db.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                """
                SELECT p.*, u.username,
                       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
                       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments
                FROM posts p
                JOIN users u ON p.author_id = u.id
                WHERE p.author_id = %s
                ORDER BY p.created_at DESC
                """,
                (user_id,)
            )
            return await cursor.fetchall()


async def save_post_db(user_id: int, post_id: str):
    if USE_MOCK_DB:
        return
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO saved_posts(user_id, post_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (user_id, post_id)
            )
        await db.commit()


async def unsave_post_db(user_id: int, post_id: str):
    if USE_MOCK_DB:
        return
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                DELETE FROM saved_posts
                WHERE user_id = %s AND post_id = %s
                """,
                (user_id, post_id)
            )
        await db.commit()


async def add_comment(post_id: str, user_id: int, text: str):
    comment_id = str(uuid.uuid4())
    if USE_MOCK_DB:
        return comment_id
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO comments(id, post_id, user_id, text)
                VALUES (%s, %s, %s, %s)
                """,
                (comment_id, post_id, user_id, text)
            )
        await db.commit()
    return comment_id


async def fetch_comments(post_id: str):
    if USE_MOCK_DB:
        return []
    async with DB_POOL.connection() as db:
        async with db.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                """
                SELECT c.*, u.username
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.post_id = %s
                ORDER BY c.created_at ASC
                """,
                (post_id,)
            )
            return await cursor.fetchall()


async def remove_comment(comment_id: str, user_id: int):
    if USE_MOCK_DB:
        return
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                DELETE FROM comments
                WHERE id = %s AND user_id = %s
                """,
                (comment_id, user_id)
            )
        await db.commit()


async def follow(follower_id: int, following_id: int):
    if USE_MOCK_DB:
        return
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO followers(follower_id, following_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (follower_id, following_id)
            )
        await db.commit()


async def unfollow(follower_id: int, following_id: int):
    if USE_MOCK_DB:
        return
    async with DB_POOL.connection() as db:
        async with db.cursor() as cursor:
            await cursor.execute(
                """
                DELETE FROM followers
                WHERE follower_id = %s AND following_id = %s
                """,
                (follower_id, following_id)
            )
        await db.commit()



