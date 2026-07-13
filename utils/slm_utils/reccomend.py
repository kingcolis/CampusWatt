from transformers import pipeline
from warnings import filterwarnings

filterwarnings("ignore")

generator = None
try:
    generator = pipeline(
        "text-generation",
        model="./models/phi3_energy"
    )
except Exception as e:
    print(f"Warning: Failed to load local phi3_energy model: {e}. Recommendations will use rule-based fallback.")

def generate_recommendation(
    prediction,
    causal_effect,
    confidence,
    retrieved_docs
):
    if generator is not None:
        prompt = f"""
        Energy Forecast: {prediction}

        Causal Effect:
        {causal_effect}

        Confidence:
        {confidence}

        Knowledge:
        {retrieved_docs}

        Give concise building energy recommendations.

        Under the guise of Philipine Energy Context usage.
        """

        try:
            response = generator(
                prompt,
                temperature=0.2, #balance of creativity and determinism
                top_p=0.9,
                max_new_tokens=128,
                do_sample=False
            )
            return response[0]["generated_text"]
        except Exception as e:
            print(f"Generator error: {e}")

    # Fallback rule-based recommendation
    recommendation = f"Based on the energy forecast of {prediction:.2f} kWh and estimated causal effect of {causal_effect:.2f} (confidence: {confidence:.1%}), we recommend optimizing HVAC setpoints and scheduling high-load lab tasks during off-peak hours. Reference guidelines: {', '.join(retrieved_docs)}."
    return recommendation
