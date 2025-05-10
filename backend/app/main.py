import os
import logging
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.models.database import init_db, get_db
from app.api.router import router
from app.video.processor import VideoProcessor
from app.ai.pipeline import AIPipeline
from app.utils.helpers import setup_logging

# Configurar logging
logger = setup_logging()

# Contexto de inicio y cierre de la aplicación
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializar la base de datos al inicio
    logger.info("Inicializando la base de datos...")
    init_db()
    
    # Cargar modelos de IA
    logger.info("Cargando modelos de IA...")
    ai_pipeline = AIPipeline()
    app.state.ai_pipeline = ai_pipeline
    
    # Inicializar procesador de video
    logger.info("Inicializando procesador de video...")
    video_processor = VideoProcessor(ai_pipeline)
    app.state.video_processor = video_processor
    
    # Iniciar procesamiento de video si está configurado para comenzar automáticamente
    if settings.AUTO_START_PROCESSING:
        logger.info("Iniciando procesamiento automático de video...")
        await video_processor.start()
    
    logger.info("¡Aplicación inicializada correctamente!")
    yield
    
    # Limpiar recursos al cerrar
    logger.info("Cerrando recursos...")
    if app.state.video_processor.is_running:
        await app.state.video_processor.stop()
    
    # Cerrar modelos de IA (especialmente importante para liberar memoria GPU)
    await app.state.ai_pipeline.close()
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
    allow_origins=["*"],  # Para desarrollo, en producción limitar a orígenes específicos
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

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Nueva conexión WebSocket. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Conexión WebSocket cerrada. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error al enviar mensaje por WebSocket: {e}")

manager = ConnectionManager()


# Endpoint WebSocket para streaming de video
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Registrar el socket con el procesador de video para que reciba las actualizaciones
        app.state.video_processor.register_socket_manager(manager)
        
        # Escuchar mensajes del cliente
        while True:
            data = await websocket.receive_json()
            
            # Manejar comandos del cliente
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


# Punto de entrada para ejecución directa
if __name__ == "__main__":
    # Ejecutar con Uvicorn
    uvicorn.run(
        "app.main:app", 
        host=settings.HOST, 
        port=settings.PORT,
        reload=settings.DEBUG
    )