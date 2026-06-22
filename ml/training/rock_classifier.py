import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from typing import Tuple, List

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
CLASS_NAMES = [
    "caliza", "dolomita", "arcilla", "yeso",
    "granito", "basalto", "marga", "travertino", "caliche",
]

IMG_SIZE = (224, 224)


def build_model(num_classes: int = len(CLASS_NAMES)) -> tf.keras.Model:
    base = tf.keras.applications.MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False

    model = models.Sequential([
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(256, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def train_model(
    train_dir: str,
    val_dir: str,
    epochs: int = 20,
    batch_size: int = 32,
) -> tf.keras.Model:
    train_ds = tf.keras.preprocessing.image_dataset_from_directory(
        train_dir,
        image_size=IMG_SIZE,
        batch_size=batch_size,
        label_mode="int",
    )
    val_ds = tf.keras.preprocessing.image_dataset_from_directory(
        val_dir,
        image_size=IMG_SIZE,
        batch_size=batch_size,
        label_mode="int",
    )

    model = build_model()
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=[
            tf.keras.callbacks.ModelCheckpoint(
                os.path.join(MODEL_DIR, "best_model.keras"),
                save_best_only=True,
            ),
            tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
        ],
    )

    model.save(os.path.join(MODEL_DIR, "caliza_model.keras"))
    with open(os.path.join(MODEL_DIR, "class_names.json"), "w") as f:
        json.dump(CLASS_NAMES, f)

    return model


def load_model(model_path: str) -> tf.keras.Model:
    return tf.keras.models.load_model(model_path)


def export_tflite(model: tf.keras.Model, quantize: bool = False) -> bytes:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    if quantize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    output_path = os.path.join(MODEL_DIR, "caliza_model.tflite")
    with open(output_path, "wb") as f:
        f.write(tflite_model)
    return tflite_model


if __name__ == "__main__":
    print("Modelo construido. Para entrenar:")
    print("  train_model('data/train', 'data/val')")
