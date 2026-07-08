import psycopg
import json
import os
from psycopg.rows import dict_row
from werkzeug.security import generate_password_hash
import uuid
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv

load_dotenv()

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



