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
from data_utils import *
from db_utils import *
from input_utils import *
from slm_utils.reccomend import *
from causal_utils import *
import time
from time import perf_counter
from fastapi import HTTPException, Depends
import asyncio
from warnings import filterwarnings

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


#For Protection
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

auth_scheme = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):

    try:
        decoded = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return decoded

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )



#General Utils
model = joblib.load("models/rfr_model.pkl")
causal_model = joblib.load("models/causal_models/causal_linear_model.pkl") 

print(model.feature_names_in_)

@app.post("/predict")
async def predict(request: PredictionRequest, user=Depends(verify_token)):
    start_time = time.perf_counter()
    # JSON → DF
    df = pd.DataFrame([request.model_dump()])
    #df["timestamp"] = pd.to_datetime(df["timestamp"]) // not required due to the datetime being the index of the data

    df = feature_engineer_engineer(df)

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
