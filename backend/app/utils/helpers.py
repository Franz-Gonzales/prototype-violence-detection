import os
import logging
import logging.handlers
import sys
from datetime import datetime
import cv2
import numpy as np
import asyncio
from typing import List, Optional
import tempfile
import subprocess
from pathlib import Path

from app.config import settings

def setup_logging() -> logging.Logger:
    # Crear directorio de logs si no existe
    log_dir = os.path.join(settings.DATA_DIR, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Configurar formato de logs
    log_format = '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
    formatter = logging.Formatter(log_format)
    
    # Configurar root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL)
    
    # Limpiar handlers existentes
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Handler para la consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Handler para archivo rotativo
    log_file = os.path.join(log_dir, 'violence_detector.log')
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5*1024*1024, backupCount=5, encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # Crear logger para la aplicación
    logger = logging.getLogger("violence_detector")
    
    logger.info("Sistema de logging inicializado")
    return logger

def generate_filename(prefix: str, extension: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    return f"{prefix}_{timestamp}.{extension}"

def save_frame(frame: np.ndarray, filepath: str) -> bool:
    try:
        # Asegurar que el directorio existe
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Comprimir frame a JPEG con calidad del 90%
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        with open(filepath, 'wb') as f:
            f.write(buffer)
        
        logger = logging.getLogger("violence_detector")
        logger.debug(f"Frame guardado en {filepath}")
        return True
    except Exception as e:
        logger = logging.getLogger("violence_detector")
        logger.error(f"Error al guardar frame: {e}")
        return False

async def save_video_clip(frames: List[np.ndarray], output_path: str, fps: int = None) -> bool:
    if not frames:
        logger = logging.getLogger("violence_detector")
        logger.error("No hay frames para guardar como clip")
        return False
    
    try:
        # Asegurar que el directorio existe
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Usar PROCESS_FPS (15) por defecto
        fps = fps or settings.PROCESS_FPS
        height, width = frames[0].shape[:2]
        
        # Método 1: Usar OpenCV (rápido pero limitado)
        try:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            if not writer.isOpened():
                raise Exception("No se pudo inicializar VideoWriter")
            
            for frame in frames:
                writer.write(frame)
            
            writer.release()
            
            logger = logging.getLogger("violence_detector")
            logger.debug(f"Clip guardado con OpenCV en {output_path}")
            return os.path.exists(output_path)
        
        except Exception as e:
            logger = logging.getLogger("violence_detector")
            logger.warning(f"Error al guardar video con OpenCV: {e}, intentando con FFmpeg")
        
        # Método 2: Usar FFmpeg (más compatible y mejor calidad)
        with tempfile.TemporaryDirectory() as temp_dir:
            # Guardar frames como imágenes
            for i, frame in enumerate(frames):
                frame_path = os.path.join(temp_dir, f"frame_{i:04d}.jpg")
                cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            
            # Comando FFmpeg para crear video con mayor compresión
            ffmpeg_cmd = [
                'ffmpeg',
                '-y',  # Sobrescribir si existe
                '-framerate', str(fps),
                '-i', os.path.join(temp_dir, 'frame_%04d.jpg'),
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '28',  # Mayor compresión
                '-pix_fmt', 'yuv420p',
                output_path
            ]
            
            # Ejecutar FFmpeg
            process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            # Verificar resultado
            logger = logging.getLogger("violence_detector")
            if process.returncode != 0:
                logger.error(f"Error al ejecutar FFmpeg: {stderr.decode()}")
                return False
            
            logger.debug(f"Clip guardado con FFmpeg en {output_path}")
            return os.path.exists(output_path)
    
    except Exception as e:
        logger = logging.getLogger("violence_detector")
        logger.error(f"Error al guardar clip de video: {e}")
        return False

def format_timedelta(seconds: float) -> str:
    """Formatea un tiempo en segundos como HH:MM:SS"""
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"