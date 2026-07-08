#For Inputs from the website
import pandas as pd
import numpy as np
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
from dotenv import load_dotenv
import os
from uuid import UUID


#Global Variables
load_dotenv()

SECRET_KEY=os.getenv("SECRET_KEY")
ALGORITHM=os.getenv("ALGORITHM")



def create_token(data: dict):

    payload = {
        "data": data,
        "exp": datetime.utcnow() + timedelta(hours=6)
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)




#For Login
class LoginRequest(BaseModel):
    username: str
    password: str



# For Prediction reqest
class PredictionRequest(BaseModel):

    building_id: int
    meter: int
    site_id: int

    air_temperature: float
    cloud_coverage: float
    dew_temperature: float
    precip_depth_1_hr: float
    sea_level_pressure: float
    wind_direction: float
    wind_speed: float


#Creating User Account
class RequestUser(BaseModel):
    username: str
    email: str
    password: str

#For SLM Recommendation Engine
class SLMSchema(BaseModel):
    prediction: float
    causal_effect: float
    confidence: float
    retrieved_docs: list[str]


#For Causal Model
class CausalSchema(BaseModel):
    building_id: int
    meter: float
    air_temperature: float
    dew_temperature: float
    wind_speed: float


#Social Media Schemas
class CreatePostSchema(BaseModel):
    title: str
    body: Optional[str] = None
    images: list[str] = []

    prediction_result_id: Optional[str] = None
    causal_result_id: Optional[str] = None
    recommendation_result_id: Optional[str] = None

    visibility: str = "public"


class UpdatePostSchema(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    images: Optional[list[str]] = None
    visibility: Optional[str] = None


class CommentSchema(BaseModel):
    text: str

class CreatePostSchema(BaseModel):

    title: str
    body: str

    images: List[str] = []

    prediction_result_id: Optional[UUID] = None
    causal_result_id: Optional[UUID] = None
    recommendation_result_id: Optional[UUID] = None

    visibility: str = "public"


class UpdatePostSchema(BaseModel):

    title: str
    body: str

    images: List[str] = []

    visibility: str = "public"


# Requesting to be turned to a dataframe
def request_to_dataframe(
    request: PredictionRequest
) -> pd.DataFrame:

    df = pd.DataFrame([{
        "timestamp": request.timestamp,
        "building_id": request.building_id,
        "meter": request.meter,
        "site_id": request.site_id,
        "air_temperature": request.air_temperature,
        "cloud_coverage": request.cloud_coverage,
        "dew_temperature": request.dew_temperature,
        "precip_depth_1_hr": request.precip_depth_1_hr,
        "sea_level_pressure": request.sea_level_pressure,
        "wind_direction": request.wind_direction,
        "wind_speed": request.wind_speed
    }])

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    return df



# Feature Engineering function
def feature_engineer_energy(df, train_stats=None, is_train=True):
    df = df.copy()

    df = df.sort_values(["building_id", "meter"])

    group_cols = ["building_id", "meter"]

    temp = df["air_temperature"]

    df["cooling_degree"] = np.maximum(temp - 18, 0)
    df["heating_degree"] = np.maximum(18 - temp, 0)

    df["temp_dew_gap"] = df["air_temperature"] - df["dew_temperature"]

    df["humidity_proxy"] = np.where(
        df["air_temperature"] != 0,
        df["dew_temperature"] / df["air_temperature"],
        0
    )

    df["feels_like_temp"] = df["air_temperature"] - 0.7 * df["wind_speed"]

    df["is_raining"] = (df["precip_depth_1_hr"] > 0).astype(int)

    df["weather_stress"] = (
        df["wind_speed"] +
        df["cloud_coverage"] +
        df["is_raining"]
    )

    df["storm_intensity"] = (
        df["wind_speed"] ** 2 +
        df["cloud_coverage"]
    )

    wind_dir = df["wind_direction"].fillna(0)

    df["wind_x"] = np.sin(np.deg2rad(wind_dir))
    df["wind_y"] = np.cos(np.deg2rad(wind_dir))
    df["wind_energy"] = df["wind_speed"] ** 2

    if train_stats is not None:
        pressure_mean = train_stats["pressure_mean"]
    else:
        pressure_mean = df["sea_level_pressure"].mean()

    df["pressure_anomaly"] = df["sea_level_pressure"] - pressure_mean

    df["sunlight_proxy"] = 8 - df["cloud_coverage"]

    df["thermal_load_proxy"] = (
        df["cooling_degree"] + df["heating_degree"]
    )

    df["environmental_load_index"] = (
        df["weather_stress"] + np.abs(df["pressure_anomaly"])
    )

    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.fillna(0)

    return df
