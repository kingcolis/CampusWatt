from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from werkzeug.security import check_password_hash
import joblib
import pandas as pd
from pathlib import Path
import jwt
from datetime import datetime, timedelta
import datetime
try:
    from .data_utils import *
    from .db_utils import *
    from .input_utils import *
    from .slm_utils.reccomend import *
    from .causal_utils import *
except ImportError:
    from data_utils import *
    from db_utils import *
    from input_utils import *
    from slm_utils.reccomend import *
    from causal_utils import *
import time
from time import perf_counter
from fastapi import HTTPException, Depends
import asyncio
import sys
from warnings import filterwarnings

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        import uvicorn.loops.asyncio
        uvicorn.loops.asyncio.asyncio_loop_factory = lambda use_subprocess=False: asyncio.SelectorEventLoop
    except Exception as e:
        print(f"Warning: Failed to patch uvicorn loop factory: {e}")

#For Protection
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

filterwarnings("ignore")

app = FastAPI()

origins = ["*"]  

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


auth_scheme = HTTPBearer()

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    token = credentials.credentials

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=["HS256"]
    )

    username = payload["data"]["username"]

    user = await user_retrieval(username)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


@app.on_event("startup")
async def startup():
    import sys
    import asyncio
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        await DB_POOL.open()
    except Exception as e:
        print(f"[DB] Warning: DB_POOL.open() failed: {e}")
    try:
        await migrate_db()
    except Exception as e:
        print(f"[DB] Warning: migrate_db() failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    await DB_POOL.close()

#General Utils
try:
    model = joblib.load("models/rfr_model.pkl")
except FileNotFoundError:
    model_path = Path(__file__).resolve().parent.parent / "models" / "rfr_model.pkl"
    model = joblib.load(model_path)

try:
    causal_model = joblib.load("models/causal_models/causal_linear_model.pkl")
except FileNotFoundError:
    causal_model_path = Path(__file__).resolve().parent.parent / "models" / "causal_models" / "causal_linear_model.pkl"
    causal_model = joblib.load(causal_model_path) 

print(model.feature_names_in_)

@app.post("/predict")
async def predict(request: PredictionRequest, user=Depends(verify_token)):
    start_time = time.perf_counter()
    # JSON → DF
    df = pd.DataFrame([request.model_dump()])
    #df["timestamp"] = pd.to_datetime(df["timestamp"]) // not required due to the datetime being the index of the data

    df = feature_engineer_energy(df)

    # Prediction
    y_pred = model.predict(df)

    y_prob = (
        model.predict_proba(df)[:, 1]
        if hasattr(model, "predict_proba")
        else None
    )
    end_time = time.perf_counter()

    inference_time_ms = (
        end_time - start_time
    ) * 1000

    prediction_value = float(y_pred[0])

    response = {
        "prediction": prediction_value,
        "probability": None
    }

    await save_prediction_result(
        model_name="rfr.pkl",
        input_data=request.model_dump(mode="json"),
        prediction_output=response,
        explanation="Random Forest Energy Forecast",
        confidence_score=None,
        inference_time_ms=int(inference_time_ms)
    )

    return response


@app.post("/causal_predict")
async def causal_predict(
    request: CausalSchema,
    user=Depends(verify_token)
):

    start = perf_counter()

    try:

        results = causal_predict_math(
            building_id=request.building_id,
            meter=request.meter,
            air_temperature=request.air_temperature,
            dew_temperature=request.dew_temperature,
            wind_speed=request.wind_speed
        )

        elapsed = int((perf_counter() - start) * 1000)

        response = {
            "status": "success",
            "causal_prediction": results["prediction"],
            "raw_prediction": results["raw_prediction"],
            "confidence": results["confidence"],
            "mahalanobis_distance": results["mahalanobis_distance"],
            "inference_time_ms": elapsed
        }

        await save_causal_result(
            model_name="DoWhy-LinearRegression-Math",
            input_data=request.model_dump(),
            output=response,
            inference_time_ms=elapsed,
            has_error=False
        )

        return response

    except Exception as e:

        elapsed = int((perf_counter() - start) * 1000)

        await save_causal_result(
            model_name="DoWhy-LinearRegression-Math",
            input_data=request.model_dump(),
            output={
                "error": str(e)
            },
            inference_time_ms=elapsed,
            has_error=True
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/login")
async def login(request: LoginRequest):

    user_record = await user_retrieval(
        request.username
    )
    print(user_record)
    if not user_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    password_hash = user_record["password_hash"]

    valid = check_password_hash(
        password_hash,
        request.password
    )

    if not valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_token({
        "username": request.username
    })
    print(request.password)
    print(password_hash)
    print(check_password_hash(password_hash, request.password))

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer"
    }

@app.post("/create_user")
async def create_user(new_user: RequestUser):

    await create_user_db(
        username=new_user.username,
        email=new_user.email,
        password=new_user.password
    )

    return {
        "status": "success",
        "message": "User created successfully."
    }


@app.post("/recommend")
async def slm_recommend(
    request: SLMSchema,
    user=Depends(verify_token)
):

    recommendation = generate_recommendation(
        prediction=request.prediction,
        causal_effect=request.causal_effect,
        confidence=request.confidence,
        retrieved_docs=request.retrieved_docs
    )

    await save_recommendation_result(
        recommendation=recommendation,
        confidence_score=request.confidence,
        source_documents=request.retrieved_docs
    )

    return {
        "status": "success",
        "recommendation": recommendation,
        "confidence": request.confidence,
        "sources": request.retrieved_docs
    }




#Social Media Endpoints
@app.post("/posts")
async def create_post(
    request: CreatePostSchema,
    user=Depends(verify_token)
):
    print(user)
    print(type(user))

    post_id = await save_post(
        author_id=user["id"],
        title=request.title,
        body=request.body,
        images=request.images,
        prediction_result_id=request.prediction_result_id,
        causal_result_id=request.causal_result_id,
        recommendation_result_id=request.recommendation_result_id,
        visibility=request.visibility
    )

    return {
        "status":"success",
        "post_id":post_id
    }


@app.get("/posts")
async def get_posts():

    posts = await fetch_posts()

    return {
        "posts":posts
    }


@app.get("/posts/{post_id}")
async def get_post(post_id: str):

    post = await fetch_post(post_id)

    return post

@app.put("/posts/{post_id}")
async def edit_post(
    post_id: str,
    request: UpdatePostSchema,
    user=Depends(verify_token)
):

    await update_post(
        post_id,
        user["id"],
        request
    )

    return {
        "status":"success"
    }

@app.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    user=Depends(verify_token)
):

    await remove_post(
        post_id,
        user["id"]
    )

    return {
        "status":"deleted"
    }

@app.post("/posts/{post_id}/like")
async def like_post(
    post_id: str,
    user=Depends(verify_token)
):

    await like_post_db(
        user["id"],
        post_id
    )

    return {
        "status":"liked"
    }

@app.delete("/posts/{post_id}/like")
async def unlike_post(
    post_id: str,
    user=Depends(verify_token)
):

    await unlike_post_db(
        user["id"],
        post_id
    )

    return {
        "status":"unliked"
    }


@app.post("/posts/{post_id}/save")
async def save_post_endpoint(
    post_id: str,
    user=Depends(verify_token)
):

    await save_post_db(
        user["id"],
        post_id
    )

    return {
        "status":"saved"
    }

@app.delete("/posts/{post_id}/save")
async def unsave_post(
    post_id: str,
    user=Depends(verify_token)
):

    await unsave_post_db(
        user["id"],
        post_id
    )

    return {
        "status":"unsaved"
    }

@app.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    request: CommentSchema,
    user=Depends(verify_token)
):

    comment_id = await add_comment(
        post_id,
        user["id"],
        request.text
    )

    return {
        "comment_id":comment_id
    }

@app.get("/posts/{post_id}/comments")
async def get_comments(
    post_id: str
):

    return await fetch_comments(post_id)

@app.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user=Depends(verify_token)
):

    await remove_comment(
        comment_id,
        user["id"]
    )

    return {
        "status":"deleted"
    }

@app.post("/users/{user_id}/follow")
async def follow_user(
    user_id: int,
    user=Depends(verify_token)
):

    await follow(
        user["id"],
        user_id
    )

    return {
        "status":"following"
    }

@app.delete("/users/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    user=Depends(verify_token)
):

    await unfollow(
        user["id"],
        user_id
    )

    return {
        "status":"unfollowed"
    }

@app.get("/users/me")
async def get_current_user_profile(user=Depends(verify_token)):
    user["userType"] = "Student" if user["id"] % 2 == 1 else "Faculty"
    user["age"] = 21 if user["userType"] == "Student" else 42
    user["course"] = "Computer Engineering"
    user["position"] = "Associate Professor"
    user["about"] = "Passionate about smart campus sustainability and platform engineering."
    return user

@app.get("/users/{user_id}")
async def profile(user_id: int):

    return await get_profile(user_id)

@app.get("/users/{user_id}/posts")
async def profile_posts(user_id: int):

    return await fetch_user_posts(user_id)
