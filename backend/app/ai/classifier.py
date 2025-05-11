import numpy as np
import os
import cv2
import time
import logging
from typing import List, Dict, Any
from collections import deque
import onnxruntime as ort
import asyncio
import torch

from app.config import settings

logger = logging.getLogger(__name__)

class ViolenceClassifier:
    def __init__(self, model_path: str = None, threshold: float = None, num_frames: int = 8):
        self.model_path = model_path or settings.TIMESFORMER_MODEL_PATH
        self.threshold = threshold or settings.VIOLENCE_THRESHOLD
        self.num_frames = num_frames
        self.frame_width = 224
        self.frame_height = 224
        self.device = settings.DEVICE
        self.frame_buffer = deque(maxlen=self.num_frames)
        self.last_inference_time = 0
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modelo TimeSformer no encontrado en {self.model_path}")
        
        logger.info(f"Inicializando clasificador de violencia desde {self.model_path}")
        self._setup_model()
        self.class_names = ["no_violencia", "amenazante_ambigua", "violencia_directa"]
        logger.info("Clasificador de violencia inicializado correctamente")

    def _setup_model(self):
        try:
            if self.device == "cuda" and 'CUDAExecutionProvider' in ort.get_available_providers():
                logger.info("Utilizando CUDA para inferencia TimeSformer")
                self.session_options = ort.SessionOptions()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session_options.enable_mem_pattern = True
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=self.session_options,
                    providers=['CUDAExecutionProvider']
                )
            else:
                logger.info("Utilizando CPU para inferencia TimeSformer")
                self.session_options = ort.SessionOptions()
                self.session_options.intra_op_num_threads = os.cpu_count()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=self.session_options,
                    providers=['CPUExecutionProvider']
                )
            
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            self.input_shape = self.session.get_inputs()[0].shape
            logger.info(f"Modelo TimeSformer cargado: shape de entrada {self.input_shape}")
        
        except Exception as e:
            logger.error(f"Error al cargar el modelo TimeSformer: {e}")
            raise

    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        resized = cv2.resize(frame, (self.frame_width, self.frame_height))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = rgb.astype(np.float32) / 255.0
        return normalized

    def preprocess_frames(self, frames: List[np.ndarray]) -> np.ndarray:
        processed_frames = [self.preprocess_frame(frame) for frame in frames]
        tensor = np.stack(processed_frames, axis=0)
        tensor = np.expand_dims(tensor, axis=0)
        return tensor

    async def add_frame(self, frame: np.ndarray) -> bool:
        self.frame_buffer.append(frame.copy())
        return len(self.frame_buffer) >= self.num_frames

    async def clear_buffer(self):
        self.frame_buffer.clear()

    async def classify(self) -> Dict[str, Any]:
        if len(self.frame_buffer) < self.num_frames:
            return {
                "class_id": 0,
                "class_name": "no_violencia",
                "score": 0.0,
                "violence_detected": False
            }
        
        try:
            start_time = time.time()
            frames_list = list(self.frame_buffer)
            input_tensor = self.preprocess_frames(frames_list)
            
            # Ejecutar en hilo separado
            outputs = await asyncio.to_thread(self.session.run, self.output_names, {self.input_name: input_tensor})
            
            logits = outputs[0]
            scores = self._softmax(logits[0])
            class_id = np.argmax(scores)
            score = float(scores[class_id])
            class_name = self.class_names[class_id]
            violence_detected = (class_id == 2 and score >= self.threshold) or (class_id == 1 and score >= self.threshold + 0.1)
            
            self.last_inference_time = time.time() - start_time
            if violence_detected:
                logger.info(f"Violencia detectada: {class_name} con score {score:.4f} en {self.last_inference_time*1000:.2f} ms")
            else:
                logger.debug(f"Clasificación: {class_name} con score {score:.4f} en {self.last_inference_time*1000:.2f} ms")
            
            return {
                "class_id": int(class_id),
                "class_name": class_name,
                "score": float(score),
                "scores": scores.tolist(),
                "violence_detected": violence_detected,
                "inference_time_ms": round(self.last_inference_time * 1000, 2)
            }
        
        except Exception as e:
            logger.error(f"Error en clasificación de violencia: {e}")
            return {
                "class_id": 0,
                "class_name": "no_violencia",
                "score": 0.0,
                "violence_detected": False,
                "error": str(e)
            }

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()

    async def close(self):
        self.session = None
        self.frame_buffer.clear()
        if self.device == "cuda":
            torch.cuda.empty_cache()
        logger.info("Clasificador de violencia cerrado")