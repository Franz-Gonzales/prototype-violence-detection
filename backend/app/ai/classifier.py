import numpy as np
import os
import cv2
import time
import logging
from typing import List, Tuple, Dict, Any, Optional, Union
from collections import deque
import onnxruntime as ort

from app.config import settings

logger = logging.getLogger(__name__)

class ViolenceClassifier:
    """Implementación del clasificador de violencia basado en TimeSformer"""
    
    def __init__(self, model_path: str = None, threshold: float = None, num_frames: int = 8):
        """
        Inicializa el clasificador de violencia
        
        Args:
            model_path: Ruta al modelo ONNX de TimeSformer
            threshold: Umbral para clasificar como violencia
            num_frames: Número de frames necesarios para la inferencia
        """
        self.model_path = model_path or settings.TIMESFORMER_MODEL_PATH
        self.threshold = threshold or settings.VIOLENCE_THRESHOLD
        self.num_frames = num_frames
        self.frame_width = 224  # TimeSformer usa 224x224
        self.frame_height = 224
        self.device = settings.DEVICE
        
        # Buffer de frames para acumular suficientes para la inferencia
        self.frame_buffer = deque(maxlen=self.num_frames)
        
        # Verificar que el modelo existe
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modelo TimeSformer no encontrado en {self.model_path}")
            
        logger.info(f"Inicializando clasificador de violencia desde {self.model_path}")
        
        # Configurar sesión ONNX
        self._setup_model()
        
        # Mapeo de índices a clases
        self.class_names = ["no_violencia", "amenazante_ambigua", "violencia_directa"]
        
        logger.info("Clasificador de violencia inicializado correctamente")
    

    def _setup_model(self):
        """Configura la sesión ONNX Runtime para el modelo TimeSformer"""
        try:
            # Configurar opciones de inferencia según el dispositivo
            if self.device == "cuda" and 'CUDAExecutionProvider' in ort.get_available_providers():
                logger.info("Utilizando CUDA para inferencia TimeSformer")
                self.session_options = ort.SessionOptions()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path, 
                    sess_options=self.session_options,
                    providers=['CUDAExecutionProvider']
                )
            else:
                logger.info("Utilizando CPU para inferencia TimeSformer")
                self.session_options = ort.SessionOptions()
                # Utilizar todos los núcleos para CPU
                self.session_options.intra_op_num_threads = os.cpu_count()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path, 
                    sess_options=self.session_options,
                    providers=['CPUExecutionProvider']
                )
            
            # Obtener metadatos del modelo
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            self.input_shape = self.session.get_inputs()[0].shape
            
            logger.info(f"Modelo TimeSformer cargado: shape de entrada {self.input_shape}")
            
        except Exception as e:
            logger.error(f"Error al cargar el modelo TimeSformer: {e}")
            raise
    
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Preprocesa un frame para adaptarlo al formato requerido
        
        Args:
            frame: Frame de video en formato BGR (OpenCV)
            
        Returns:
            Frame procesado
        """
        # Redimensionar
        resized = cv2.resize(frame, (self.frame_width, self.frame_height))
        
        # Convertir a RGB (el modelo espera RGB)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        # Normalizar a [0, 1]
        normalized = rgb.astype(np.float32) / 255.0
        
        return normalized
    
    def preprocess_frames(self, frames: List[np.ndarray]) -> np.ndarray:
        """
        Preprocesa una secuencia de frames para inferencia
        
        Args:
            frames: Lista de frames
            
        Returns:
            Tensor de frames procesados en formato apropiado para TimeSformer
        """
        # Preprocesar cada frame
        processed_frames = [self.preprocess_frame(frame) for frame in frames]
        
        # Convertir a tensor
        tensor = np.stack(processed_frames, axis=0)  # [T, H, W, C]
        
        # Reorganizar a NTHWC (batch, time, height, width, channels)
        tensor = np.expand_dims(tensor, axis=0)  # [1, T, H, W, C]
        
        return tensor
    
    async def add_frame(self, frame: np.ndarray) -> bool:
        """
        Añade un frame al buffer
        
        Args:
            frame: Frame de video
            
        Returns:
            True si el buffer está lleno, False en caso contrario
        """
        self.frame_buffer.append(frame.copy())
        return len(self.frame_buffer) >= self.num_frames
    
    async def clear_buffer(self):
        """Vacía el buffer de frames"""
        self.frame_buffer.clear()
    
    async def classify(self) -> Dict[str, Any]:
        """
        Clasifica la secuencia de frames actual
        
        Returns:
            Diccionario con la clase, score y metadatos
        """
        # Verificar que hay suficientes frames
        if len(self.frame_buffer) < self.num_frames:
            return {
                "class_id": 0,
                "class_name": "no_violencia",
                "score": 0.0,
                "violence_detected": False
            }
        
        try:
            start_time = time.time()
            
            # Preprocesar frames
            frames_list = list(self.frame_buffer)
            input_tensor = self.preprocess_frames(frames_list)
            
            # Ejecutar inferencia
            outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
            
            # Obtener logits (shape: [1, num_classes])
            logits = outputs[0]
            
            # Convertir a probabilidades con softmax
            scores = self._softmax(logits[0])
            
            # Encontrar la clase con mayor probabilidad
            class_id = np.argmax(scores)
            score = float(scores[class_id])
            class_name = self.class_names[class_id]
            
            # Determinar si se detectó violencia
            # La clase "violencia_directa" tiene índice 2
            violence_detected = (class_id == 2 and score >= self.threshold)
            
            # Si es "amenazante_ambigua" con alta confianza, también puede considerarse violencia
            if class_id == 1 and score >= self.threshold + 0.1:
                violence_detected = True
            
            inference_time = time.time() - start_time
            
            if violence_detected:
                logger.info(f"Violencia detectada: {class_name} con score {score:.4f} en {inference_time*1000:.2f} ms")
            else:
                logger.debug(f"Clasificación: {class_name} con score {score:.4f} en {inference_time*1000:.2f} ms")
            
            return {
                "class_id": int(class_id),
                "class_name": class_name,
                "score": float(score),
                "scores": scores.tolist(),
                "violence_detected": violence_detected,
                "inference_time_ms": round(inference_time * 1000, 2)
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
        """Aplica softmax a un vector de logits"""
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()
    
    async def close(self):
        """Libera recursos del modelo"""
        self.session = None
        self.frame_buffer.clear()
        logger.info("Clasificador de violencia cerrado")