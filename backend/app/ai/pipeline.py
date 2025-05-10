import asyncio
import numpy as np
import logging
import time
from typing import Dict, Any, List, Optional
import cv2

from app.ai.detector import YOLODetector
from app.ai.tracker import DeepSORTTracker
from app.ai.classifier import ViolenceClassifier
from app.config import settings

logger = logging.getLogger(__name__)

class AIPipeline:
    """Pipeline completo de procesamiento de IA"""
    
    def __init__(self):
        """Inicializa el pipeline con los tres modelos de IA"""
        logger.info("Inicializando pipeline de IA...")
        
        # Inicializar modelos
        self.detector = YOLODetector()
        self.tracker = DeepSORTTracker()
        self.classifier = ViolenceClassifier()
        
        # Estado del pipeline
        self.frame_count = 0
        self.last_classification_frame = 0
        self.violence_classification = None
        
        # Control de FPS
        self.fps_start_time = time.time()
        self.fps_frame_count = 0
        self.current_fps = 0
        
        logger.info("Pipeline de IA inicializado correctamente")
    
    async def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Procesa un frame para detección, seguimiento y clasificación
        
        Args:
            frame: Frame de video en formato BGR
            
        Returns:
            Diccionario con resultados del procesamiento
        """
        if frame is None or frame.size == 0:
            return {
                "frame_id": self.frame_count,
                "persons": [],
                "violence_detected": False
            }
        
        self.frame_count += 1
        start_time = time.time()
        
        # Actualizar FPS
        self.fps_frame_count += 1
        elapsed = time.time() - self.fps_start_time
        if elapsed >= 1.0:
            self.current_fps = self.fps_frame_count / elapsed
            self.fps_frame_count = 0
            self.fps_start_time = time.time()
        
        # Paso 1: Detección de personas con YOLO
        detections = await self.detector.detect(frame)
        
        # Paso 2: Seguimiento de personas con DeepSORT
        tracks = await self.tracker.update(frame, detections)
        
        # Paso 3: Clasificación de violencia con TimeSformer (cada N frames)
        await self.classifier.add_frame(frame)
        
        classification_interval = settings.VIOLENCE_FRAME_INTERVAL
        should_classify = (
            self.frame_count - self.last_classification_frame >= classification_interval or
            self.violence_classification is None
        )
        
        if should_classify and len(self.classifier.frame_buffer) >= self.classifier.num_frames:
            # Clasificar violencia
            classification = await self.classifier.classify()
            self.violence_classification = classification
            self.last_classification_frame = self.frame_count
        
        # Preparar resultados
        persons = []
        for track_id, track_info in tracks.items():
            x, y, w, h = track_info['bbox']
            persons.append({
                "id": int(track_id),
                "bbox": [int(x), int(y), int(w), int(h)],
                "confidence": float(track_info['confidence'])
            })
        
        # Determinar si hay violencia
        violence_detected = False
        violence_score = 0.0
        violence_class = "no_violencia"
        
        if self.violence_classification:
            violence_detected = self.violence_classification.get("violence_detected", False)
            violence_score = self.violence_classification.get("score", 0.0)
            violence_class = self.violence_classification.get("class_name", "no_violencia")
        
        # Calcular tiempo de procesamiento
        processing_time = time.time() - start_time
        
        return {
            "frame_id": self.frame_count,
            "persons": persons,
            "violence_detected": violence_detected,
            "violence_score": violence_score,
            "violence_class": violence_class,
            "fps": round(self.current_fps, 1),
            "processing_time_ms": round(processing_time * 1000, 2)
        }
    
    async def close(self):
        """Libera recursos de todos los modelos"""
        logger.info("Cerrando pipeline de IA...")
        
        # Cerrar modelos en paralelo
        await asyncio.gather(
            self.detector.close(),
            self.tracker.close(),
            self.classifier.close()
        )
        
        logger.info("Pipeline de IA cerrado correctamente")