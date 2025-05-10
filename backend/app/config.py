import os
from pydantic_settings import BaseSettings
from typing import Optional
import torch
from sqlalchemy.orm import Session
from app.models.database import get_db_session, Setting

class Settings(BaseSettings):
    # Configuración del servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    CLIP_FPS: int = 15

    # Configuración de la base de datos
    DATABASE_URL: str = "sqlite:///./data/db.sqlite"

    # Configuración de la cámara
    CAMERA_URL: str = "http://192.168.1.4:8080/video"
    CAMERA_USER: Optional[str] = None
    CAMERA_PASSWORD: Optional[str] = None
    CAMERA_LOCATION: str = "Pasillo Principal"

    # Configuración de los modelos de IA
    MODELS_DIR: str = "./weights"
    YOLO_MODEL_PATH: str = "./weights/yolo11_people_final.onnx"
    TIMESFORMER_MODEL_PATH: str = "./weights/timesformer_final.onnx"

    # Umbrales de detección
    YOLO_CONF_THRESHOLD: float = 0.70
    DEEPSORT_MAX_AGE: int = 30
    VIOLENCE_THRESHOLD: float = 0.80

    # Configuración de procesamiento de video
    FRAME_WIDTH: int = 640
    FRAME_HEIGHT: int = 640
    PROCESS_FPS: int = 15
    VIOLENCE_FRAME_INTERVAL: int = 4
    CLIP_DURATION_SECONDS: int = 5
    AUTO_START_PROCESSING: bool = False

    # Configuración de almacenamiento
    DATA_DIR: str = "./data"
    CLIPS_DIR: str = "./data/clips"

    # Configuración de hardware
    USE_GPU: bool = True
    DEVICE: str = ("cuda" if torch.cuda.is_available() and USE_GPU else "cpu")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

# Crear instancia global de configuración
settings = Settings()

# Validar existencia de modelos
for model_path in [settings.YOLO_MODEL_PATH, settings.TIMESFORMER_MODEL_PATH]:
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Modelo no encontrado: {model_path}")

# Sincronizar con base de datos
with get_db_session() as db:
    violence_threshold = db.query(Setting).filter(Setting.key == "violence_threshold").first()
    if violence_threshold:
        settings.VIOLENCE_THRESHOLD = float(violence_threshold.value)
    yolo_conf_threshold = db.query(Setting).filter(Setting.key == "yolo_conf_threshold").first()
    if yolo_conf_threshold:
        settings.YOLO_CONF_THRESHOLD = float(yolo_conf_threshold.value)

# Verificar configuración de GPU al inicio
if settings.USE_GPU and settings.DEVICE == "cuda":
    print(f"Utilizando GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memoria GPU disponible: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
else:
    print(f"Utilizando CPU: {settings.DEVICE} con {os.cpu_count()} núcleos")

# Asegurar que los directorios necesarios existen
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.CLIPS_DIR, exist_ok=True)