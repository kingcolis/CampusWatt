import pandas as pd
import numpy as np
from scipy.spatial.distance import mahalanobis
import joblib

CAUSAL_COEF = pd.read_csv("models/causal_models/causal_coefficients.csv")
stats = joblib.load("models/causal_models/causal_distribution.pkl")

CAUSAL_MEAN = stats["mean"]
CAUSAL_INV_COV = stats["inv_cov"]

ALPHA = -0.062445691942337414 #Computed from the whole training data using its 95th percentile and its mahalanobis distance

def causal_predict(
    building_id,
    meter,
    air_temperature,
    dew_temperature,
    wind_speed
):

    # Original causal equation (Linear Model, Causal Linear Regression)

    pred = (
        CAUSAL_COEF["const"]
        + CAUSAL_COEF["meter"] * meter
        + CAUSAL_COEF["building_id"] * building_id
        + CAUSAL_COEF["meter_dew"] * meter * dew_temperature
        + CAUSAL_COEF["meter_air"] * meter * air_temperature
        + CAUSAL_COEF["meter_wind"] * meter * wind_speed
    )

    # Feature vector used by causal model

    x = np.array([
        meter,
        building_id,
        meter * dew_temperature,
        meter * air_temperature,
        meter * wind_speed
    ])

    # Mahalanobis distance

    distance = mahalanobis(
        x,
        CAUSAL_MEAN,
        CAUSAL_INV_COV
    )

    # Confidence shrinkage

    confidence = np.exp(-ALPHA * distance)

    confidence = float(np.clip(confidence, 0.05, 1.0))

    shrunk_prediction = pred * confidence

    return {
        "prediction": float(shrunk_prediction),
        "raw_prediction": float(pred),
        "confidence": confidence,
        "mahalanobis_distance": float(distance)
    }
