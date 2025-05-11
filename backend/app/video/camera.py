import cv2
import numpy as np
import asyncio
import aiohttp
import time
import logging
from typing import Optional, AsyncGenerator

from app.config import settings

logger = logging.getLogger(__name__)

class IPWebcam:
    def __init__(self, url: str = None, user: str = None, password: str = None):
        self.url = url or settings.CAMERA_URL
        self.user = user or settings.CAMERA_USER
        self.password = password or settings.CAMERA_PASSWORD
        self.location = settings.CAMERA_LOCATION
        self.is_running = False
        self.frame_count = 0
        self.last_frame = None
        self.fps = 0
        self.fps_frames = 0
        self.fps_start_time = 0
        logger.info(f"Interfaz de cámara inicializada: {self.url}")

    async def start(self):
        if self.is_running:
            logger.warning("La cámara ya está en ejecución")
            return
        self.is_running = True
        self.fps_start_time = time.time()
        self.fps_frames = 0
        logger.info(f"Iniciando captura de video desde {self.url}")

    async def stop(self):
        if not self.is_running:
            logger.warning("La cámara no está en ejecución")
            return
        self.is_running = False
        logger.info("Captura de video detenida")

    async def get_frames(self) -> AsyncGenerator[np.ndarray, None]:
        if not self.is_running:
            logger.error("La cámara no está iniciada")
            return
        
        headers = {}
        auth = None
        if self.user and self.password:
            auth = aiohttp.BasicAuth(self.user, self.password)
        
        max_retries = 5
        retry_delay = 1  # Segundos iniciales
        
        while self.is_running:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(self.url, auth=auth, headers=headers, timeout=30) as response:
                        if response.status != 200:
                            logger.error(f"Error al conectar con la cámara: HTTP {response.status}")
                            raise aiohttp.ClientError(f"HTTP {response.status}")
                        
                        content_type = response.headers.get('Content-Type', '')
                        if 'multipart/x-mixed-replace' not in content_type:
                            logger.error(f"La cámara no proporciona un stream MJPEG válido: {content_type}")
                            return
                        
                        boundary = content_type.split('boundary=')[1].encode('utf-8')
                        buffer = b""
                        
                        async for data, _ in response.content.iter_chunks():
                            if not self.is_running:
                                break
                            
                            buffer += data
                            jpg_start = buffer.find(b'\xff\xd8')
                            jpg_end = buffer.find(b'\xff\xd9')
                            
                            if jpg_start != -1 and jpg_end != -1:
                                jpg_data = buffer[jpg_start:jpg_end+2]
                                buffer = buffer[jpg_end+2:]
                                frame = cv2.imdecode(np.frombuffer(jpg_data, dtype=np.uint8), cv2.IMREAD_COLOR)
                                
                                if frame is not None:
                                    self.frame_count += 1
                                    self.last_frame = frame
                                    self.fps_frames += 1
                                    elapsed = time.time() - self.fps_start_time
                                    if elapsed >= 1.0:
                                        self.fps = self.fps_frames / elapsed
                                        self.fps_frames = 0
                                        self.fps_start_time = time.time()
                                    yield frame
                                    await asyncio.sleep(1.0 / settings.PROCESS_FPS)  # Ajustado dinámicamente
                        
                        # Reset retries on successful connection
                        retry_delay = 1
                        
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.error(f"Error de conexión con la cámara: {e}")
                if retry_delay > 32:  # Máximo 32 segundos
                    logger.error("Máximo de reintentos alcanzado, deteniendo cámara")
                    self.is_running = False
                    return
                logger.info(f"Reintentando conexión en {retry_delay} segundos...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Backoff exponencial
            except Exception as e:
                logger.error(f"Error al procesar el stream MJPEG: {e}")
                self.is_running = False
                return

    async def get_snapshot(self) -> Optional[np.ndarray]:
        if self.last_frame is not None:
            return self.last_frame.copy()
        
        if not self.is_running:
            await self.start()
        
        try:
            async for frame in self.get_frames():
                return frame
        except Exception as e:
            logger.error(f"Error al obtener snapshot: {e}")
            return None