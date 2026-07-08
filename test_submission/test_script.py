import pandas as pd
import numpy as np
import joblib
from utils import data_utils



model = joblib.load("models/rfr_model.pkl")


test = pd.read_csv("data_energy/test_data_preprocessed.csv")
print(test.columns.tolist())
test = data_utils.feature_engineer_energy(test, is_train=False)

preds = model.predict(test)

submission = pd.DataFrame({
    "id": test["row_id"],
    "meter_reading": np.expm1(preds)
})

submission.to_csv("Ashrae_submission.csv", index=False)

print("Submission Completed!")
