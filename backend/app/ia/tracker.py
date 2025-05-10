import numpy as np
import os
import logging
import time
from typing import List, Dict, Any, Tuple
import cv2

# Intentar importar DeepSORT si está disponible
from deep_sort_realtime.deepsort_tracker import DeepSort

from app.config import settings

logger = logging.getLogger(__name__)

class DeepSORTTracker:
    """Implementación del tracker DeepSORT para seguimiento de personas"""
    
    def __init__(self, max_age: int = None):
        """
        Inicializa el tracker DeepSORT
        
        Args:
            max_age: Tiempo máximo de vida para un track
        """
        self.max_age = max_age or settings.DEEPSORT_MAX_AGE
        self.device = settings.DEVICE
        
        # Importar DeepSORT
        try:
            
            # Inicializar DeepSORT
            self.deep_sort = DeepSort(
                max_age=self.max_age,
                n_init=3,
                nms_max_overlap=1.0,
                max_cosine_distance=0.2,
                nn_budget=100,
                override_track_class=None,
                embedder="mobilenet",
                half=True,
                bgr=True,
                embedder_gpu=self.device == "cuda",
                embedder_model_name=None,
                embedder_wts=None,
                polygon=False,
                today=None
            )
            
            self.use_deepsort = True
            logger.info("DeepSORT inicializado correctamente")
            
        except ImportError as e:
            logger.warning(f"No se pudo importar DeepSORT: {e}. Usando seguimiento simple.")
            self.use_deepsort = False
            
            # Inicializar seguimiento simple
            self.tracks = {}  # id -> {bbox, feature, last_seen, age}
            self.next_id = 1
        
        logger.info(f"Tracker {'DeepSORT' if self.use_deepsort else 'simple'} inicializado")
    
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
            
            if self.use_deepsort:
                # Preparar detecciones para DeepSORT
                deepsort_detections = []
                for det in detections:
                    bbox = det['bbox']
                    confidence = det['confidence']
                    
                    # DeepSORT espera [x1, y1, x2, y2, confidence]
                    x1, y1, w, h = bbox
                    x2, y2 = x1 + w, y1 + h
                    
                    deepsort_detections.append(([x1, y1, x2, y2], confidence, 'person'))
                
                # Actualizar DeepSORT
                tracks = self.deep_sort.update_tracks(deepsort_detections, frame=image)
                
                # Convertir tracks a nuestro formato
                result = {}
                for track in tracks:
                    if not track.is_confirmed():
                        continue
                    
                    # Obtener bounding box en formato [x, y, w, h]
                    ltrb = track.to_ltrb()
                    x1, y1, x2, y2 = ltrb
                    w, h = x2 - x1, y2 - y1
                    
                    result[track.track_id] = {
                        'bbox': [x1, y1, w, h],
                        'feature': track.get_feature() if hasattr(track, 'get_feature') else None,
                        'last_seen': 0,
                        'age': 0,
                        'confidence': track.det_conf
                    }
                
                tracking_time = time.time() - start_time
                logger.debug(f"DeepSORT: {len(result)} personas en {tracking_time*1000:.2f} ms")
                
                return result
                
            else:
                # Usar seguimiento simple
                # Asignar detecciones a tracks
                self._assign_detections_to_tracks_simple(detections)
                
                tracking_time = time.time() - start_time
                logger.debug(f"Tracking simple: {len(self.tracks)} personas en {tracking_time*1000:.2f} ms")
                
                return self.tracks
        
        except Exception as e:
            logger.error(f"Error en actualización de tracker: {e}")
            if self.use_deepsort:
                # Fallback a seguimiento simple
                logger.warning("Fallback a seguimiento simple debido a error")
                self.use_deepsort = False
                self.tracks = {}
                self.next_id = 1
                self._assign_detections_to_tracks_simple(detections)
                return self.tracks
            else:
                return self.tracks
    
    def _assign_detections_to_tracks_simple(self, detections: List[Dict[str, Any]]):
        """
        Método simple de asignación para el fallback
        
        Args:
            detections: Lista de detecciones de YOLO
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
        
        # Si no hay tracks, crear nuevos tracks para todas las detecciones
        if not self.tracks:
            for det in detections:
                self.tracks[self.next_id] = {
                    'bbox': det['bbox'],
                    'feature': None,
                    'last_seen': 0,
                    'age': 0,
                    'confidence': det['confidence']
                }
                self.next_id += 1
            return self.tracks
        
        # Asignar detecciones a tracks usando IOU
        track_ids = list(self.tracks.keys())
        
        # Matriz de IOU para cada par track-detección
        iou_matrix = np.zeros((len(track_ids), len(detections)))
        
        for i, track_id in enumerate(track_ids):
            track_bbox = self.tracks[track_id]['bbox']
            
            for j, det in enumerate(detections):
                det_bbox = det['bbox']
                iou_matrix[i, j] = self._calculate_iou(track_bbox, det_bbox)
        
        # Asignar usando greedy matching
        matched_track_indices = []
        matched_detection_indices = []
        
        # Umbral de IOU
        iou_threshold = 0.3
        
        while iou_matrix.size > 0 and iou_matrix.max() > iou_threshold:
            # Encontrar el par con mayor IOU
            i, j = np.unravel_index(iou_matrix.argmax(), iou_matrix.shape)
            
            # Actualizar el track con la nueva detección
            track_id = track_ids[i]
            self.tracks[track_id].update({
                'bbox': detections[j]['bbox'],
                'last_seen': 0,
                'age': 0,
                'confidence': detections[j]['confidence']
            })
            
            # Marcar como emparejados
            matched_track_indices.append(i)
            matched_detection_indices.append(j)
            
            # Eliminar filas y columnas correspondientes
            iou_matrix[i, :] = 0
            iou_matrix[:, j] = 0
        
        # Crear nuevos tracks para detecciones no emparejadas
        for j, det in enumerate(detections):
            if j not in matched_detection_indices:
                self.tracks[self.next_id] = {
                    'bbox': det['bbox'],
                    'feature': None,
                    'last_seen': 0,
                    'age': 0,
                    'confidence': det['confidence']
                }
                self.next_id += 1
    
    def _calculate_iou(self, bbox1, bbox2):
        """
        Calcula la Intersección sobre Unión (IOU) entre dos bounding boxes
        
        Args:
            bbox1, bbox2: [x, y, w, h]
            
        Returns:
            IOU valor entre 0 y 1
        """
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        # Convertir a coordenadas x1y1x2y2
        x1_1, y1_1, x2_1, y2_1 = x1, y1, x1 + w1, y1 + h1
        x1_2, y1_2, x2_2, y2_2 = x2, y2, x2 + w2, y2 + h2
        
        # Calcular coordenadas de la intersección
        x_left = max(x1_1, x1_2)
        y_top = max(y1_1, y1_2)
        x_right = min(x2_1, x2_2)
        y_bottom = min(y2_1, y2_2)
        
        # Comprobar si hay intersección
        if x_right < x_left or y_bottom < y_top:
            return 0.0
        
        # Calcular área de intersección
        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        
        # Calcular áreas de ambos boxes
        bbox1_area = w1 * h1
        bbox2_area = w2 * h2
        
        # Calcular IOU
        iou = intersection_area / float(bbox1_area + bbox2_area - intersection_area)
        
        return max(0.0, min(1.0, iou))
    
    async def close(self):
        """Libera recursos del tracker"""
        if hasattr(self, 'deep_sort') and self.deep_sort is not None:
            # Limpiar recursos de DeepSORT si es necesario
            pass
        
        self.tracks = {}
        logger.info("Tracker cerrado")