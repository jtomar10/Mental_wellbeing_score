import math
import os
from typing import Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# BACKWARD COMPATIBILITY
# ---------------------------------------------------------------------------
# The currently uploaded/old .pkl contains a FunctionTransformer that refers
# to this function by name. Keep the function during the transition period,
# but use the SAME ordinal mapping that the training notebook intends:
# Low=0, Medium=1, High=2, Very High=3.
#
# After retraining the model with OrdinalEncoder (see the notebook fix),
# this function is no longer needed by the new .pkl, but leaving it here
# makes the backend safe against loading the old model during deployment.
def custom_stress_encoder(X):
    stress_map = {
        "Low": 0.0,
        "Medium": 1.0,
        "High": 2.0,
        "Very High": 3.0,
    }

    arr = np.asarray(X, dtype=object).ravel()

    # Unknown values must not silently become Low.
    mapped = pd.Series(arr).map(stress_map)

    if mapped.isna().any():
        unknown = pd.Series(arr)[mapped.isna()].tolist()
        raise ValueError(f"Unknown Stress_Level value(s): {unknown}")

    return mapped.to_numpy(dtype=float).reshape(-1, 1)


# ---------------------------------------------------------------------------
# MODEL LOADING
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "mental_health_model.pkl")

try:
    model = joblib.load(MODEL_PATH)
    print("✅ Model loaded successfully!")
except Exception as e:
    model = None
    print(f"❌ Failed to load model: {e}")


# ---------------------------------------------------------------------------
# COUNTRY GROUPING
# ---------------------------------------------------------------------------
# These match the fitted categories observed in the uploaded model.
top_countries = [
    "Other",
    "India",
    "USA",
    "Canada",
    "Australia",
    "UK",
    "Germany",
    "Turkey",
    "Mexico",
    "France",
    "Spain",
]


# ---------------------------------------------------------------------------
# FASTAPI APP
# ---------------------------------------------------------------------------
app = FastAPI(title="Wellbeing Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REQUEST / RESPONSE SCHEMAS
# ---------------------------------------------------------------------------
class StudentData(BaseModel):
    age: int = Field(..., ge=10, le=100)
    gender: Literal["Male", "Female", "Other"]
    country: str
    academic_level: Literal["Undergraduate", "Graduate", "High School"]
    most_used_platform: Literal[
        "Facebook",
        "LinkedIn",
        "Instagram",
        "Snapchat",
        "Twitter",
        "YouTube",
        "TikTok",
        "LINE",
        "KakaoTalk",
        "VKontakte",
        "WhatsApp",
        "WeChat",
    ]
    purpose_of_use: Literal["Networking", "Education", "Entertainment", "News"]
    avg_daily_usage_hours: float = Field(..., ge=0, le=24)
    daily_unlocks: int = Field(..., ge=0)
    study_hours: float = Field(..., ge=0, le=24)
    physical_activity_hours: float = Field(..., ge=0, le=24)
    sleep_hours_per_night: float = Field(..., ge=0, le=24)
    stress_level: Literal["Low", "Medium", "High", "Very High"]


class PredictionResponse(BaseModel):
    predicted_mental_health_score: float


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def build_input_dataframe(data: StudentData) -> pd.DataFrame:
    """Create exactly the feature schema expected by the trained pipeline."""
    country_group = (
        data.country if data.country in top_countries else "Other"
    )

    return pd.DataFrame(
        [
            {
                "Study_Hours": data.study_hours,
                "Age": data.age,
                "Avg_Daily_Usage_Hours": data.avg_daily_usage_hours,
                "Daily_Unlocks": data.daily_unlocks,
                "Physical_Activity_Hours": data.physical_activity_hours,
                "Sleep_Hours_Per_Night": data.sleep_hours_per_night,
                "Stress_Level": data.stress_level,
                "Gender": data.gender,
                "Academic_Level": data.academic_level,
                "Most_Used_Platform": data.most_used_platform,
                "Purpose_Of_Use": data.purpose_of_use,
                "grouped_countries": country_group,
            }
        ]
    )


def validate_model_uses_stress():
    """Optional startup diagnostic for the loaded pipeline."""
    if model is None:
        return

    try:
        preprocessor = model.named_steps["preprocessor"]
        ordinal_step = preprocessor.named_transformers_["ordinal"].named_steps[
            "encode"
        ]

        # New, correct model:
        if hasattr(ordinal_step, "categories_"):
            categories = [
                list(category)
                for category in ordinal_step.categories_
            ]
            if categories != [["Low", "Medium", "High", "Very High"]]:
                print(
                    "⚠️ Warning: saved model has unexpected stress categories:",
                    categories,
                )
            else:
                print("✅ Saved model uses ordinal stress encoding 0/1/2/3.")
        else:
            print(
                "ℹ️ Loaded model uses a function-based stress transformer. "
                "Backend compatibility mapping is active."
            )

    except Exception as e:
        print(f"⚠️ Could not verify stress transformer: {e}")


validate_model_uses_stress()


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model unavailable")
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    if model is None:
        raise HTTPException(status_code=503, detail="Model unavailable")

    input_df = build_input_dataframe(data)

    try:
        prediction = float(model.predict(input_df)[0])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction processing failed: {str(e)}",
        )

    if not math.isfinite(prediction):
        raise HTTPException(
            status_code=500,
            detail="Model returned non-finite score",
        )

    # IMPORTANT:
    # Do NOT manually alter predictions based on stress level.
    # The corrected model must learn the stress effect itself.
    score = max(0.0, min(10.0, round(prediction, 2)))

    return PredictionResponse(
        predicted_mental_health_score=score
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
