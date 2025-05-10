import cv2
import numpy as np
import asyncio
import aiohttp
import time
import logging
from typing import Optional, AsyncGenerator
import urllib.parse

from app.config import settings

logger = logging.getLogger(__name__)

class IPWebcam:
    """Interfaz para conectar con cámara IP Webcam"""
    
    def __init__(self, url: str = None, user: str = None, password: str = None):
        """
        Inicializa la conexión con la cámara IP
        
        Args:
            url: URL de la cámara IP Webcam
            user: Usuario para autenticación
            password: Contraseña para autenticación
        """
        self.url = url or settings.CAMERA_URL
        self.user = user or settings.CAMERA_USER
        self.password = password or settings.CAMERA_PASSWORD
        self.location = settings.CAMERA_LOCATION
        
        # Estado de la cámara
        self.is_running = False
        self.frame_count = 0
        self.last_frame = None
        
        # Para medición de FPS
        self.fps = 0
        self.fps_frames = 0
        self.fps_start_time = 0
        
        logger.info(f"Interfaz de cámara inicializada: {self.url}")
    
    async def start(self):
        """Inicia la captura de video"""
        if self.is_running:
            logger.warning("La cámara ya está en ejecución")
            return
        
        self.is_running = True
        self.fps_start_time = time.time()
        self.fps_frames = 0
        logger.info(f"Iniciando captura de video desde {self.url}")
    
    async def stop(self):
        """Detiene la captura de video"""
        if not self.is_running:
            logger.warning("La cámara no está en ejecución")
            return
        
        self.is_running = False
        logger.info("Captura de video detenida")
    
    async def get_frames(self) -> AsyncGenerator[np.ndarray, None]:
        """
        Generador asíncrono de frames desde la cámara IP
        
        Yields:
            Frames de video como arrays numpy
        """
        if not self.is_running:
            logger.error("La cámara no está iniciada")
            return
        
        # Configurar sesión HTTP
        headers = {}
        auth = None
        
        if self.user and self.password:
            auth = aiohttp.BasicAuth(self.user, self.password)
        
        # Si la URL es de tipo mjpeg streaming (común en IP Webcam)
        if "mjpg" in self.url.lower() or "mjpeg" in self.url.lower():
            boundary_str = b"--"  # Para buscar límites en el stream MJPEG
            
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(self.url, auth=auth, headers=headers, timeout=30) as response:
                        if response.status != 200:
                            logger.error(f"Error al conectar con la cámara: HTTP {response.status}")
                            return
                        
                        # Para procesamiento de MJPEG Stream
                        buffer = b""
                        content_type = response.headers.get('Content-Type', '')
                        
                        if 'multipart/x-mixed-replace' not in content_type:
                            logger.error(f"La cámara no proporciona un stream MJPEG válido: {content_type}")
                            return
                        
                        # Extraer boundary
                        boundary = content_type.split('boundary=')[1]
                        boundary = boundary.encode('utf-8')
                        
                        # Procesar stream MJPEG
                        async for data, _ in response.content.iter_chunks():
                            if not self.is_running:
                                break
                            
                            buffer += data
                            
                            # Buscar límites entre frames
                            jpg_start = buffer.find(b'\xff\xd8')
                            jpg_end = buffer.find(b'\xff\xd9')
                            
                            if jpg_start != -1 and jpg_end != -1:
                                jpg_data = buffer[jpg_start:jpg_end+2]
                                buffer = buffer[jpg_end+2:]
                                
                                # Decodificar JPEG a frame de numpy
                                frame = cv2.imdecode(np.frombuffer(jpg_data, dtype=np.uint8), cv2.IMREAD_COLOR)
                                
                                if frame is not None:
                                    self.frame_count += 1
                                    self.last_frame = frame
                                    
                                    # Actualizar FPS
                                    self.fps_frames += 1
                                    elapsed = time.time() - self.fps_start_time
                                    if elapsed >= 1.0:
                                        self.fps = self.fps_frames / elapsed
                                        self.fps_frames = 0
                                        self.fps_start_time = time.time()
                                    
                                    yield frame
                                    
                                    # Pequeña pausa para no saturar la CPU
                                    await asyncio.sleep(0.01)
                
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    logger.error(f"Error de conexión con la cámara: {e}")
                    self.is_running = False
                    return
                except Exception as e:
                    logger.error(f"Error al procesar el stream MJPEG: {e}")
                    self.is_running = False
                    return
        
        # Alternativa: para cámaras que solo proporcionan capturas individuales
        else:
            while self.is_running:
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(self.url, auth=auth, headers=headers, timeout=5) as response:
                            if response.status != 200:
                                logger.error(f"Error al obtener frame: HTTP {response.status}")
                                await asyncio.sleep(1)  # Esperar antes de reintentar
                                continue
                            
                            # Leer imagen
                            data = await response.read()
                            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                            
                            if frame is not None:
                                self.frame_count += 1
                                self.last_frame = frame
                                
                                # Actualizar FPS
                                self.fps_frames += 1
                                elapsed = time.time() - self.fps_start_time
                                if elapsed >= 1.0:
                                    self.fps = self.fps_frames / elapsed
                                    self.fps_frames = 0
                                    self.fps_start_time = time.time()
                                
                                yield frame
                            
                            # Pequeña pausa entre capturas
                            await asyncio.sleep(1/30)  # ~30 FPS máximo
                
                except Exception as e:
                    logger.error(f"Error al capturar frame: {e}")
                    await asyncio.sleep(1)  # Esperar antes de reintentar
    
    async def get_snapshot(self) -> Optional[np.ndarray]:
        """
        Obtiene una captura individual de la cámara
        
        Returns:
            Frame de video como array numpy, o None si hay error
        """
        if self.last_frame is not None:
            return self.last_frame.copy()
        
        # Si no hay un frame previo, intentar capturar uno
        if not self.is_running:
            await self.start()
        
        # Obtener el primer frame del generador
        try:
            async for frame in self.get_frames():
                return frame
        except Exception as e:
            logger.error(f"Error al obtener snapshot: {e}")
            return None