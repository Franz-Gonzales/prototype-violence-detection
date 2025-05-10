import numpy as np
import os
import logging
import time
from typing import List, Dict, Any, Tuple
import onnxruntime as ort
import cv2

from app.config import settings

logger = logging.getLogger(__name__)

class DeepSORTTracker:
    """Implementación del tracker DeepSORT para seguimiento de personas"""
    
    def __init__(self, model_path: str = None, max_age: int = None):
        """
        Inicializa el tracker DeepSORT
        
        Args:
            model_path: Ruta al modelo de DeepSORT
            max_age: Tiempo máximo de vida para un track
        """
        self.model_path = model_path or settings.DEEPSORT_MODEL_PATH
        self.max_age = max_age or settings.DEEPSORT_MAX_AGE
        self.device = settings.DEVICE
        
        # Verificar si existe el modelo
        if not os.path.exists(self.model_path):
            logger.warning(f"Modelo DeepSORT no encontrado en {self.model_path}, usando seguimiento simple")
            self.use_simple_tracker = True
        else:
            self.use_simple_tracker = False
            self._setup_model()
        
        # Inicializar estado del tracker
        self.tracks = {}  # id -> {bbox, feature, last_seen, age}
        self.next_id = 1
        
        logger.info(f"Tracker {'simple' if self.use_simple_tracker else 'DeepSORT'} inicializado")
    
    def _setup_model(self):
        """Configura el modelo DeepSORT para extracción de características"""
        try:
            # Configurar sesión ONNX
            if self.device == "cuda" and 'CUDAExecutionProvider' in ort.get_available_providers():
                logger.info("Utilizando CUDA para inferencia DeepSORT")
                self.session_options = ort.SessionOptions()
                self.session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path, 
                    sess_options=self.session_options,
                    providers=['CUDAExecutionProvider']
                )
            else:
                logger.info("Utilizando CPU para inferencia DeepSORT")
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
            
            logger.info(f"Modelo DeepSORT cargado: shape de entrada {self.input_shape}")
            
        except Exception as e:
            logger.error(f"Error al cargar el modelo DeepSORT: {e}")
            logger.warning("Utilizando seguimiento simple como fallback")
            self.use_simple_tracker = True
    
    def _extract_features(self, image: np.ndarray, bbox: List[int]) -> np.ndarray:
        """
        Extrae características de una región de la imagen para el seguimiento
        
        Args:
            image: Imagen completa
            bbox: [x, y, w, h] Bounding box de la persona
            
        Returns:
            Vector de características
        """
        if self.use_simple_tracker:
            # Si no usamos DeepSORT, devolver características simples (posición normalizada)
            h, w = image.shape[:2]
            x, y, bbox_w, bbox_h = bbox
            return np.array([x/w, y/h, bbox_w/w, bbox_h/h])
        
        try:
            # Extraer región de la imagen
            x, y, w, h = bbox
            x1, y1, x2, y2 = max(0, x), max(0, y), min(image.shape[1], x+w), min(image.shape[0], y+h)
            
            # Si el bbox es inválido, devolver vector cero
            if x1 >= x2 or y1 >= y2:
                return np.zeros(128, dtype=np.float32)
            
            roi = image[y1:y2, x1:x2]
            
            # Redimensionar y preprocesar
            roi_resized = cv2.resize(roi, (64, 128))
            roi_rgb = cv2.cvtColor(roi_resized, cv2.COLOR_BGR2RGB)
            
            # Normalizar
            roi_tensor = roi_rgb.astype(np.float32) / 255.0
            
            # Reorganizar a NCHW
            roi_tensor = np.transpose(roi_tensor, (2, 0, 1))
            roi_tensor = np.expand_dims(roi_tensor, axis=0)
            
            # Inferencia
            features = self.session.run(self.output_names, {self.input_name: roi_tensor})[0]
            
            # Normalizar el vector de características
            features = features / np.linalg.norm(features)
            
            return features
        
        except Exception as e:
            logger.error(f"Error en extracción de características: {e}")
            # Fallback a características simples
            h, w = image.shape[:2]
            x, y, bbox_w, bbox_h = bbox
            return np.array([x/w, y/h, bbox_w/w, bbox_h/h])
    

    def _calculate_similarity(self, feature1: np.ndarray, feature2: np.ndarray) -> float:
        """
        Calcula la similitud entre dos vectores de características
        
        Args:
            feature1, feature2: Vectores de características
            
        Returns:
            Puntuación de similitud (0-1, donde 1 es máxima similitud)
        """
        if self.use_simple_tracker:
            # Para el tracker simple, usar distancia euclidiana inversa normalizada
            distance = np.linalg.norm(feature1 - feature2)
            return 1.0 / (1.0 + distance)
        else:
            # Para DeepSORT, usar similitud coseno
            return np.dot(feature1, feature2)
    

    def _assign_detections_to_tracks(self, detections: List[Dict[str, Any]], image: np.ndarray) -> Dict[int, Dict[str, Any]]:
        """
        Asigna detecciones a tracks existentes o crea nuevos tracks
        
        Args:
            detections: Lista de detecciones de YOLO
            image: Imagen actual para extracción de características
            
        Returns:
            Diccionario de tracks actualizados
        """
        # Actualizar edad de los tracks existentes
        for track_id in list(self.tracks.keys()):
            self.tracks[track_id]['age'] += 1
            
            # Eliminar tracks demasiado viejos
            if self.tracks[track_id]['age'] > self.max_age:
                logger.debug(f"Eliminando track {track_id} por edad")
                del self.tracks[track_id]
        
        # Si no hay detecciones, devolver tracks actualizados
        if not detections:
            return self.tracks
        
        # Extraer características de cada detección
        detection_features = []
        for det in detections:
            feature = self._extract_features(image, det['bbox'])
            detection_features.append(feature)
        
        # Si no hay tracks, crear nuevos tracks para todas las detecciones
        if not self.tracks:
            for det_idx, det in enumerate(detections):
                self.tracks[self.next_id] = {
                    'bbox': det['bbox'],
                    'feature': detection_features[det_idx],
                    'last_seen': 0,
                    'age': 0,
                    'confidence': det['confidence']
                }
                self.next_id += 1
            return self.tracks
        
        # Calcular matriz de similitud entre tracks y detecciones
        similarity_matrix = np.zeros((len(self.tracks), len(detections)))
        
        for i, track_id in enumerate(self.tracks.keys()):
            track_feature = self.tracks[track_id]['feature']
            
            for j, det_feature in enumerate(detection_features):
                similarity_matrix[i, j] = self._calculate_similarity(track_feature, det_feature)
        
        # Asignar detecciones a tracks usando greedy matching
        track_ids = list(self.tracks.keys())
        matched_track_indices = []
        matched_detection_indices = []
        
        # Mientras haya similitudes por encima del umbral
        similarity_threshold = 0.5
        
        while similarity_matrix.size > 0 and similarity_matrix.max() > similarity_threshold:
            # Encontrar el par con mayor similitud
            i, j = np.unravel_index(similarity_matrix.argmax(), similarity_matrix.shape)
            
            # Actualizar el track con la nueva detección
            track_id = track_ids[i]
            self.tracks[track_id].update({
                'bbox': detections[j]['bbox'],
                'feature': detection_features[j],  # Actualizar feature
                'last_seen': 0,
                'age': 0,
                'confidence': detections[j]['confidence']
            })
            
            # Marcar como emparejados
            matched_track_indices.append(i)
            matched_detection_indices.append(j)
            
            # Eliminar filas y columnas correspondientes
            similarity_matrix[i, :] = 0
            similarity_matrix[:, j] = 0
        
        # Crear nuevos tracks para detecciones no emparejadas
        for j, det in enumerate(detections):
            if j not in matched_detection_indices:
                self.tracks[self.next_id] = {
                    'bbox': det['bbox'],
                    'feature': detection_features[j],
                    'last_seen': 0,
                    'age': 0,
                    'confidence': det['confidence']
                }
                self.next_id += 1
        
        return self.tracks
    
    
    async def update(self, image: np.ndarray, detections: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        """
        Actualiza el tracker con nuevas detecciones
        
        Args:
            image: Imagen actual
            detections: Lista de detecciones de YOLO
            
        Returns:
            Diccionario de tracks actualizados (id -> info)
        """
        try:
            start_time = time.time()
            
            # Asignar detecciones a tracks
            updated_tracks = self._assign_detections_to_tracks(detections, image)
            
            tracking_time = time.time() - start_time
            logger.debug(f"Tracking: {len(updated_tracks)} personas en {tracking_time*1000:.2f} ms")
            
            return updated_tracks
        
        except Exception as e:
            logger.error(f"Error en actualización de tracker: {e}")
            return self.tracks
    
    async def close(self):
        """Libera recursos del modelo"""
        if not self.use_simple_tracker:
            self.session = None
        self.tracks = {}
        logger.info("Tracker cerrado")