import os
import numpy as np
import time
import logging
import onnxruntime as ort
import cv2
from typing import List, Tuple, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


class YOLODetector:
    """Implementación del detector de personas YOLO"""
    
    def __init__(self, model_path: str = None, conf_threshold: float = None):
        """
        Inicializa el detector YOLO
        
        Args:
            model_path: Ruta al modelo ONNX de YOLO
            conf_threshold: Umbral de confianza para las detecciones
        """
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.conf_threshold = conf_threshold or settings.YOLO_CONF_THRESHOLD
        self.input_width = settings.FRAME_WIDTH
        self.input_height = settings.FRAME_HEIGHT
        self.device = settings.DEVICE
        
        # Verificar que el modelo existe
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modelo YOLO no encontrado en {self.model_path}")
            
        logger.info(f"Inicializando detector YOLO desde {self.model_path}")
        
        # Configurar sesión ONNX
        self._setup_model()
        
        logger.info("Detector YOLO inicializado correctamente")
    

    def _setup_model(self):
        """Configura la sesión ONNX Runtime para el modelo YOLO"""
        try:
            # Configurar opciones de inferencia según el dispositivo
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
            
            # Obtener metadatos del modelo
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            self.input_shape = self.session.get_inputs()[0].shape
            
            logger.info(f"Modelo YOLO cargado: shape de entrada {self.input_shape}")
            
        except Exception as e:
            logger.error(f"Error al cargar el modelo YOLO: {e}")
            raise
    

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocesa la imagen para la inferencia con YOLO
        
        Args:
            image: Imagen en formato BGR (OpenCV)
            
        Returns:
            Imagen preprocesada como tensor numpy
        """
        # Redimensionar la imagen
        resized = cv2.resize(image, (self.input_width, self.input_height))
        
        # Convertir a RGB (YOLO espera RGB)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        # Normalizar a [0, 1]
        normalized = rgb.astype(np.float32) / 255.0
        
        # Reordenar a NCHW (batch, channels, height, width)
        tensor = np.transpose(normalized, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)
        
        return tensor
    

    def postprocess(self, outputs: List[np.ndarray], original_shape: Tuple[int, int]) -> List[Dict[str, Any]]:
        """
        Procesa las salidas del modelo para obtener las detecciones
        
        Args:
            outputs: Salidas del modelo YOLO
            original_shape: Dimensiones originales de la imagen (alto, ancho)
            
        Returns:
            Lista de diccionarios con las detecciones (solo personas)
        """
        # En este caso específico, solo nos interesan las personas (clase 0)
        # Obtener predicciones
        predictions = outputs[0]  # shape: [1, 5, num_detections]
        
        # Extraer detecciones de personas
        orig_h, orig_w = original_shape
        scale_h, scale_w = orig_h / self.input_height, orig_w / self.input_width
        
        detections = []
        
        # Procesar cada detección
        for i, (x, y, w, h, conf) in enumerate(predictions[0]):
            # Filtrar por umbral de confianza y clase (0 = persona)
            if conf >= self.conf_threshold:
                # Ajustar a coordenadas en la imagen original
                x_orig = max(0, min(int(x * scale_w), orig_w))
                y_orig = max(0, min(int(y * scale_h), orig_h))
                w_orig = max(0, min(int(w * scale_w), orig_w - x_orig))
                h_orig = max(0, min(int(h * scale_h), orig_h - y_orig))
                
                detections.append({
                    "bbox": [x_orig, y_orig, w_orig, h_orig],
                    "confidence": float(conf),
                    "class_id": 0,  # Persona
                    "class_name": "person"
                })
        
        return detections
    
    
    async def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detecta personas en una imagen
        
        Args:
            image: Imagen en formato BGR (OpenCV)
            
        Returns:
            Lista de detecciones de personas
        """
        try:
            # Medir tiempo de inferencia
            start_time = time.time()
            
            # Preprocesar imagen
            input_tensor = self.preprocess_image(image)
            
            # Ejecutar inferencia
            outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
            
            # Postprocesar resultados
            detections = self.postprocess(outputs, image.shape[:2])
            
            inference_time = time.time() - start_time
            logger.debug(f"YOLO: detectadas {len(detections)} personas en {inference_time*1000:.2f} ms")
            
            return detections
        
        except Exception as e:
            logger.error(f"Error en detección YOLO: {e}")
            return []
    
    async def close(self):
        """Libera recursos del modelo"""
        # Limpiar sesión ONNX
        self.session = None
        logger.info("Detector YOLO cerrado")