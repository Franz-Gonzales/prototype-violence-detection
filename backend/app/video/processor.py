import asyncio
import cv2
import numpy as np
import logging
import time
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
import json
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import get_db_session, Incident, Person
from app.ai.pipeline import AIPipeline
from app.utils.helpers import generate_filename, save_frame, save_video_clip

logger = logging.getLogger(__name__)

class VideoProcessor:
    """Procesador de video para detección de violencia en tiempo real"""
    
    def __init__(self, ai_pipeline: AIPipeline):
        """
        Inicializa el procesador de video
        
        Args:
            ai_pipeline: Pipeline de IA para procesamiento
        """
        self.ai_pipeline = ai_pipeline
        self.is_running = False
        self.frame_buffer = []
        self.max_buffer_size = settings.CLIP_DURATION_SECONDS * settings.PROCESS_FPS
        self.socket_manager = None
        self.current_fps = 0
        self.violence_threshold = settings.VIOLENCE_THRESHOLD
        self.last_incident_time = None
        self.min_incident_interval = 10  # Tiempo mínimo entre incidentes (segundos)
        
        # Task para procesamiento asíncrono
        self.processing_task = None
        
        logger.info("Procesador de video inicializado")
    
    def register_socket_manager(self, socket_manager):
        """Registra el gestor de sockets para enviar actualizaciones"""
        self.socket_manager = socket_manager
        logger.info("Socket manager registrado en el procesador de video")
    
    async def start(self):
        """Inicia el procesamiento de video"""
        if self.is_running:
            logger.warning("El procesador de video ya está en ejecución")
            return
        
        logger.info("Iniciando procesamiento de video")
        self.is_running = True
        
        # Iniciar task de procesamiento
        self.processing_task = asyncio.create_task(self._process_video_stream())
    
    async def stop(self):
        """Detiene el procesamiento de video"""
        if not self.is_running:
            logger.warning("El procesador de video no está en ejecución")
            return
        
        logger.info("Deteniendo procesamiento de video")
        self.is_running = False
        
        # Esperar a que termine la task
        if self.processing_task:
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
            self.processing_task = None
        
        # Limpiar buffer
        self.frame_buffer.clear()
    
    async def update_config(self, config: Dict[str, Any]):
        """
        Actualiza la configuración del procesador
        
        Args:
            config: Diccionario con parámetros de configuración
        """
        logger.info(f"Actualizando configuración: {config}")
        
        if "violence_threshold" in config:
            try:
                threshold = float(config["violence_threshold"])
                self.violence_threshold = max(0.0, min(1.0, threshold))
                logger.info(f"Umbral de violencia actualizado a {self.violence_threshold}")
            except (ValueError, TypeError) as e:
                logger.error(f"Error al actualizar umbral de violencia: {e}")
    
    async def _process_video_stream(self):
        """Procesa el stream de video de la cámara IP"""
        from app.video.camera import IPWebcam
        
        # Crear instancia de cámara
        camera = IPWebcam()
        
        try:
            # Iniciar cámara
            await camera.start()
            
            # Procesar frames
            async for frame in camera.get_frames():
                if not self.is_running:
                    break
                
                # Añadir frame al buffer circular
                self.frame_buffer.append(frame.copy())
                if len(self.frame_buffer) > self.max_buffer_size:
                    self.frame_buffer.pop(0)
                
                # Procesar frame con el pipeline de IA
                results = await self.ai_pipeline.process_frame(frame)
                
                # Actualizar FPS actual
                self.current_fps = results.get("fps", 0)
                
                # Comprobar si se detectó violencia
                if results["violence_detected"] and results.get("violence_score", 0) >= self.violence_threshold:
                    current_time = time.time()
                    
                    # Verificar intervalo mínimo entre incidentes
                    if (self.last_incident_time is None or 
                        current_time - self.last_incident_time >= self.min_incident_interval):
                        
                        self.last_incident_time = current_time
                        
                        # Registrar incidente
                        await self._register_incident(
                            frame, 
                            results["violence_score"],
                            results["violence_class"],
                            results["persons"]
                        )
                
                # Enviar resultados al frontend si hay socket manager
                if self.socket_manager:
                    # Procesar frame para envío (redimensionar y codificar a JPEG)
                    encoded_frame = self._encode_frame_for_transmission(frame, results)
                    
                    # Incluir metadatos en el mensaje
                    message = {
                        "type": "frame",
                        "data": {
                            "frame": encoded_frame,
                            "frame_id": results["frame_id"],
                            "persons": results["persons"],
                            "violence_detected": results["violence_detected"],
                            "violence_score": results.get("violence_score", 0),
                            "violence_class": results.get("violence_class", "no_violencia"),
                            "fps": self.current_fps
                        }
                    }
                    
                    # Enviar a todos los clientes conectados
                    await self.socket_manager.broadcast(message)
                
                # Pequeña pausa para permitir otras operaciones asíncronas
                await asyncio.sleep(0.01)
            
        except Exception as e:
            logger.error(f"Error en procesamiento de video: {e}")
        finally:
            # Detener cámara
            await camera.stop()
            self.is_running = False
            logger.info("Procesamiento de video detenido")
    
    def _encode_frame_for_transmission(self, frame: np.ndarray, results: Dict[str, Any]) -> str:
        """
        Codifica el frame para transmisión por WebSocket
        
        Args:
            frame: Frame de video original
            results: Resultados del procesamiento
            
        Returns:
            Frame codificado en base64
        """
        try:
            # Dibujar información en el frame
            annotated_frame = frame.copy()
            
            # Dibujar bounding boxes de personas
            for person in results["persons"]:
                x, y, w, h = person["bbox"]
                person_id = person["id"]
                
                # Color según si hay violencia (rojo) o no (verde)
                color = (0, 0, 255) if results["violence_detected"] else (0, 255, 0)
                
                # Dibujar rectángulo
                cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), color, 2)
                
                # Dibujar ID
                cv2.putText(annotated_frame, f"ID: {person_id}", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            # Mostrar información sobre violencia
            if results["violence_detected"]:
                text = f"VIOLENCIA: {results.get('violence_score', 0):.2f}"
                cv2.putText(annotated_frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Mostrar FPS
            cv2.putText(annotated_frame, f"FPS: {self.current_fps:.1f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
            
            # Reducir tamaño para transmisión
            max_width = 640
            if annotated_frame.shape[1] > max_width:
                scale = max_width / annotated_frame.shape[1]
                new_width = int(annotated_frame.shape[1] * scale)
                new_height = int(annotated_frame.shape[0] * scale)
                annotated_frame = cv2.resize(annotated_frame, (new_width, new_height))
            
            # Codificar a JPEG
            _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            
            # Convertir a base64
            import base64
            encoded_frame = base64.b64encode(buffer).decode('utf-8')
            
            return encoded_frame
            
        except Exception as e:
            logger.error(f"Error al codificar frame: {e}")
            return ""
    
    async def _register_incident(self, frame: np.ndarray, violence_score: float, violence_class: str, persons: List[Dict[str, Any]]):
        """
        Registra un incidente de violencia en la base de datos
        
        Args:
            frame: Frame donde se detectó violencia
            violence_score: Puntuación de violencia
            violence_class: Clase de violencia detectada
            persons: Lista de personas detectadas con sus IDs
        """
        logger.info(f"Registrando incidente de violencia: {violence_class} ({violence_score:.2f})")
        
        try:
            # Guardar clip de video
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clip_filename = f"violence_{timestamp}.mp4"
            clip_path = os.path.join(settings.CLIPS_DIR, clip_filename)
            
            # Guardar también una captura del momento
            frame_filename = f"violence_{timestamp}.jpg"
            frame_path = os.path.join(settings.CLIPS_DIR, frame_filename)
            
            # Guardar frame actual
            save_frame(frame, frame_path)
            
            # Guardar clip de buffer de frames (últimos N segundos)
            if self.frame_buffer:
                await save_video_clip(self.frame_buffer, clip_path, fps=settings.PROCESS_FPS)
                logger.info(f"Clip de incidente guardado en {clip_path}")
            
            # Registrar en la base de datos
            with get_db_session() as db:
                # Crear incidente
                incident = Incident(
                    timestamp=datetime.now(),
                    violence_score=violence_score,
                    location=settings.CAMERA_LOCATION,
                    clip_path=clip_path,
                    status="new"
                )
                db.add(incident)
                db.flush()  # Para obtener el ID
                
                # Registrar personas involucradas
                for person in persons:
                    person_db = Person(
                        incident_id=incident.id,
                        person_id=person["id"],
                        bounding_box=json.dumps(person["bbox"])
                    )
                    db.add(person_db)
                
                db.commit()
                
                logger.info(f"Incidente registrado con ID {incident.id}")
                
                # Enviar notificación si hay socket manager
                if self.socket_manager:
                    notification = {
                        "type": "incident",
                        "data": {
                            "id": incident.id,
                            "timestamp": incident.timestamp.isoformat(),
                            "violence_score": violence_score,
                            "violence_class": violence_class,
                            "location": incident.location,
                            "person_ids": [p["id"] for p in persons],
                            "frame_path": frame_path
                        }
                    }
                    await self.socket_manager.broadcast(notification)
        
        except Exception as e:
            logger.error(f"Error al registrar incidente: {e}")