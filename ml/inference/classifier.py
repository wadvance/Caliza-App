import numpy as np
import json
import os
from typing import Tuple, List, Optional

try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    import tensorflow.lite as tflite

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


class RockClassifier:
    def __init__(self, model_path: Optional[str] = None):
        model_path = model_path or os.path.join(MODEL_DIR, "caliza_model.tflite")
        classes_path = os.path.join(MODEL_DIR, "class_names.json")

        self.interpreter = tflite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        self.input_shape = self.input_details[0]["shape"]

        with open(classes_path) as f:
            self.class_names = json.load(f)

    def preprocess(self, image: np.ndarray) -> np.ndarray:
        if image.shape != tuple(self.input_shape[1:]):
            import cv2
            image = cv2.resize(image, (self.input_shape[2], self.input_shape[1]))
        image = image.astype(np.float32) / 255.0
        image = np.expand_dims(image, axis=0)
        return image

    def predict(self, image: np.ndarray) -> Tuple[str, float, List[float]]:
        processed = self.preprocess(image)
        self.interpreter.set_tensor(self.input_details[0]["index"], processed)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(self.output_details[0]["index"])[0]

        class_idx = int(np.argmax(output))
        probability = float(output[class_idx])
        class_name = self.class_names[class_idx]

        return class_name, probability, output.tolist()

    def predict_batch(self, images: List[np.ndarray]) -> List[Tuple[str, float, List[float]]]:
        return [self.predict(img) for img in images]


class RuleBasedClassifier:
    def __init__(self):
        self.class_names = [
            "caliza", "dolomita", "arcilla", "yeso",
            "granito", "basalto", "marga", "travertino", "caliche", "desconocido",
        ]

    def predict(self, features: dict) -> Tuple[str, float, List[str]]:
        caliza_score = 0
        reasons = []

        if features.get("color_score", 0) > 0.6:
            caliza_score += 0.25
            reasons.append("Color característico de carbonatos")
        if features.get("texture_score", 0) > 0.5:
            caliza_score += 0.20
            reasons.append("Textura sedimentaria")
        if features.get("acid_reaction") == "vigorosa":
            caliza_score += 0.30
            reasons.append("Reacción vigorosa con HCl")
        elif features.get("acid_reaction") == "moderada":
            caliza_score += 0.20
            reasons.append("Reacción moderada con HCl")
        elif features.get("acid_reaction") == "leve":
            caliza_score += 0.10
            reasons.append("Reacción leve con HCl")

        if features.get("fossil_presence"):
            caliza_score += 0.10
            reasons.append("Presencia de fósiles")

        probability = min(caliza_score, 0.95)
        class_name = "caliza" if probability > 0.5 else "desconocido"
        if probability > 0.7:
            class_name = "caliza"
        elif probability > 0.4:
            class_name = "posible_caliza"

        return class_name, round(probability, 2), reasons


def create_geospatial_model():
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler

    return {
        "model": RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            random_state=42,
        ),
        "scaler": StandardScaler(),
        "features": [
            "elevation", "slope", "ndvi", "carbonate_index",
            "clay_ratio", "swir1", "swir2", "geological_unit",
        ],
    }
