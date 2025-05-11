import asyncio
import numpy as np
import logging
import time
from typing import Dict, Any, List
import cv2

from app.ai.detector import YOLODetector
from app.ai.tracker import DeepSORTTracker
from app.ai.classifier import ViolenceClassifier
from app.config import settings

logger = logging.getLogger(__name__)

class AIPipeline:
    def __init__(self):
        logger.info("Inicializando pipeline de IA...")
        self.detector = YOLODetector()
        self.tracker = DeepSORTTracker()
        self.classifier = ViolenceClassifier()
        self.frame_count = 0
        self.last_classification_frame = 0
        self.violence_classification = None
        self.fps_start_time = time.time()
        self.fps_frame_count = 0
        self.current_fps = 0
        logger.info("Pipeline de IA inicializado correctamente")

    async def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        if frame is None or frame.size == 0:
            return {
                "frame_id": self.frame_count,
                "persons": [],
                "violence_detected": False
            }
        
        self.frame_count += 1
        start_time = time.time()
        
        self.fps_frame_count += 1
        elapsed = time.time() - self.fps_start_time
        if elapsed >= 1.0:
            self.current_fps = self.fps_frame_count / elapsed
            self.fps_frame_count = 0
            self.fps_start_time = time.time()
        
        # Paralelizar detección+seguimiento y clasificación
        detection_task = self.detector.detect(frame)
        await self.classifier.add_frame(frame)
        classification_task = None
        classification_interval = settings.VIOLENCE_FRAME_INTERVAL
        should_classify = (
            self.frame_count - self.last_classification_frame >= classification_interval or
            self.violence_classification is None
        )
        
        if should_classify and len(self.classifier.frame_buffer) >= self.classifier.num_frames:
            classification_task = self.classifier.classify()
        
        # Ejecutar detección+seguimiento
        detections = await detection_task
        tracks = await self.tracker.update(frame, detections)
        
        # Esperar clasificación si está en curso
        if classification_task:
            classification = await classification_task
            self.violence_classification = classification
            self.last_classification_frame = self.frame_count
        
        persons = []
        for track_id, track_info in tracks.items():
            x, y, w, h = track_info['bbox']
            persons.append({
                "id": int(track_id),
                "bbox": [int(x), int(y), int(w), int(h)],
                "confidence": float(track_info['confidence'])
            })
        
        violence_detected = False
        violence_score = 0.0
        violence_class = "no_violencia"
        if self.violence_classification:
            violence_detected = self.violence_classification.get("violence_detected", False)
            violence_score = self.violence_classification.get("score", 0.0)
            violence_class = self.violence_classification.get("class_name", "no_violencia")
        
        processing_time = time.time() - start_time
        logger.debug(f"Pipeline: YOLO={self.detector.last_inference_time*1000:.2f}ms, "
                    f"DeepSORT={self.tracker.last_tracking_time*1000:.2f}ms, "
                    f"TimeSformer={self.classifier.last_inference_time*1000:.2f}ms, "
                    f"Total={processing_time*1000:.2f}ms")
        
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
        logger.info("Cerrando pipeline de IA...")
        tasks = []
        for model in [self.detector, self.tracker, self.classifier]:
            try:
                tasks.append(model.close())
            except Exception as e:
                logger.error(f"Error al cerrar {model.__class__.__name__}: {e}")
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("Pipeline de IA cerrado correctamente")