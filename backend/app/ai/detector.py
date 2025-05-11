import os
import numpy as np
import time
import logging
import onnxruntime as ort
import cv2
from typing import List, Tuple, Dict, Any
import torch

from app.config import settings

logger = logging.getLogger(__name__)

class YOLODetector:
    def __init__(self, model_path: str = None, conf_threshold: float = None):
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.conf_threshold = conf_threshold or settings.YOLO_CONF_THRESHOLD
        self.input_width = settings.FRAME_WIDTH
        self.input_height = settings.FRAME_HEIGHT
        self.device = settings.DEVICE
        self.last_inference_time = 0
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modelo YOLO no encontrado en {self.model_path}")
        
        logger.info(f"Inicializando detector YOLO desde {self.model_path}")
        self._setup_model()
        logger.info("Detector YOLO inicializado correctamente")

    def _setup_model(self):
        try:
            if self.device == "cuda" and 'CUDAExecutionProvider' in ort.get_available_providers():
                logger.info("Utilizando CUDA para inferencia YOLO")
                self.session_options = ort.SessionOptions()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=self.session_options,
                    providers=['CUDAExecutionProvider']
                )
            else:
                logger.info("Utilizando CPU para inferencia YOLO")
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
            logger.info(f"Modelo YOLO cargado: shape de entrada {self.input_shape}")
        
        except Exception as e:
            logger.error(f"Error al cargar el modelo YOLO: {e}")
            raise

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        resized = cv2.resize(image, (self.input_width, self.input_height))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = rgb.astype(np.float32) / 255.0
        tensor = np.transpose(normalized, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)
        return tensor

    def postprocess(self, outputs: List[np.ndarray], original_shape: Tuple[int, int]) -> List[Dict[str, Any]]:
        try:
            predictions = outputs[0]
            if len(predictions.shape) != 3 or predictions.shape[1] < 5:
                raise ValueError(f"Formato de salida inválido: {predictions.shape}")
            
            orig_h, orig_w = original_shape
            scale_h, scale_w = orig_h / self.input_height, orig_w / self.input_width
            detections = []
            boxes = []
            scores = []
            
            for det in predictions[0]:
                x, y, w, h, conf = det[:5]
                if conf >= self.conf_threshold:
                    boxes.append([x - w/2, y - h/2, w, h])
                    scores.append(float(conf))
            
            # Aplicar NMS
            indices = cv2.dnn.NMSBoxes(boxes, scores, self.conf_threshold, nms_threshold=0.45)
            for i in indices:
                x, y, w, h = boxes[i]
                x_orig = max(0, min(int(x * scale_w), orig_w))
                y_orig = max(0, min(int(y * scale_h), orig_h))
                w_orig = max(0, min(int(w * scale_w), orig_w - x_orig))
                h_orig = max(0, min(int(h * scale_h), orig_h - y_orig))
                detections.append({
                    "bbox": [x_orig, y_orig, w_orig, h_orig],
                    "confidence": scores[i],
                    "class_id": 0,
                    "class_name": "person"
                })
            
            return detections
        
        except Exception as e:
            logger.error(f"Error en postprocesamiento YOLO: {e}")
            return []

    async def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        try:
            start_time = time.time()
            input_tensor = self.preprocess_image(image)
            outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
            detections = self.postprocess(outputs, image.shape[:2])
            self.last_inference_time = time.time() - start_time
            logger.debug(f"YOLO: detectadas {len(detections)} personas en {self.last_inference_time*1000:.2f} ms")
            return detections
        except Exception as e:
            logger.error(f"Error en detección YOLO: {e}")
            return []

    async def close(self):
        self.session = None
        if self.device == "cuda":
            torch.cuda.empty_cache()
        logger.info("Detector YOLO cerrado")