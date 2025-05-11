import os
import logging
import uvicorn
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Dict

from app.config import settings
from app.models.database import init_db, get_db, get_db_session, Setting
from app.api.router import router
from app.video.processor import VideoProcessor
from app.ai.pipeline import AIPipeline
from app.utils.helpers import setup_logging

# Configurar logging
logger = setup_logging()

# Contexto de inicio y cierre de la aplicación
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Inicializar la base de datos
        logger.info("Inicializando la base de datos...")
        init_db()
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")
        raise

    try:
        # Sincronizar configuraciones con la base de datos
        logger.info("Sincronizando configuraciones con la base de datos...")
        with get_db_session() as db:
            violence_threshold = db.query(Setting).filter(Setting.key == "violence_threshold").first()
            if violence_threshold:
                settings.VIOLENCE_THRESHOLD = float(violence_threshold.value)
                logger.info(f"violence_threshold actualizado desde DB: {settings.VIOLENCE_THRESHOLD}")
            yolo_conf_threshold = db.query(Setting).filter(Setting.key == "yolo_conf_threshold").first()
            if yolo_conf_threshold:
                settings.YOLO_CONF_THRESHOLD = float(yolo_conf_threshold.value)
                logger.info(f"yolo_conf_threshold actualizado desde DB: {settings.YOLO_CONF_THRESHOLD}")
    except Exception as e:
        logger.error(f"Error al sincronizar configuraciones con la base de datos: {e}")

    try:
        # Cargar modelos de IA
        logger.info("Cargando modelos de IA...")
        ai_pipeline = AIPipeline()
        app.state.ai_pipeline = ai_pipeline
    except Exception as e:
        logger.error(f"Error al cargar modelos de IA: {e}")
        raise

    try:
        # Inicializar procesador de video
        logger.info("Inicializando procesador de video...")
        video_processor = VideoProcessor(ai_pipeline)
        app.state.video_processor = video_processor
    except Exception as e:
        logger.error(f"Error al inicializar procesador de video: {e}")
        raise

    try:
        # Iniciar procesamiento de video si está configurado
        if settings.AUTO_START_PROCESSING:
            logger.info("Iniciando procesamiento automático de video...")
            await video_processor.start()
    except Exception as e:
        logger.error(f"Error al iniciar procesamiento automático: {e}")
        raise

    logger.info("¡Aplicación inicializada correctamente!")
    yield

    # Limpiar recursos al cerrar
    logger.info("Cerrando recursos...")
    try:
        if app.state.video_processor.is_running:
            await app.state.video_processor.stop()
    except Exception as e:
        logger.error(f"Error al detener procesador de video: {e}")

    try:
        await app.state.ai_pipeline.close()
    except Exception as e:
        logger.error(f"Error al cerrar modelos de IA: {e}")

    logger.info("Aplicación cerrada correctamente.")

# Crear aplicación FastAPI
app = FastAPI(
    title="Violence Detection API",
    description="API para detección de violencia en tiempo real utilizando modelos de IA",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Limitar en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(router, prefix="/api")

# Clase para gestionar conexiones WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.connection_times: Dict[WebSocket, float] = {}

    async def connect(self, websocket: WebSocket, token: str):
        # Validar token simple (en producción usar JWT o similar)
        if token != "violence_detector_token":  # Cambiar en producción
            await websocket.close(code=1008, reason="Token inválido")
            raise HTTPException(status_code=401, detail="Token inválido")
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_times[websocket] = time.time()
        logger.info(f"Nueva conexión WebSocket. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            duration = time.time() - self.connection_times[websocket]
            self.active_connections.remove(websocket)
            del self.connection_times[websocket]
            logger.info(f"Conexión WebSocket cerrada. Duración: {duration:.2f}s. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections[:]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error al enviar mensaje por WebSocket: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

# Endpoint WebSocket para streaming de video
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    try:
        await manager.connect(websocket, token)
        app.state.video_processor.register_socket_manager(manager)
        while True:
            data = await websocket.receive_json()
            if "command" in data:
                command = data["command"]
                if command == "start_stream":
                    await app.state.video_processor.start()
                elif command == "stop_stream":
                    await app.state.video_processor.stop()
                elif command == "update_config":
                    if "config" in data:
                        await app.state.video_processor.update_config(data["config"])
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )