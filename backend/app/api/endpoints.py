from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Path, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import logging
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.schema import IncidentDetail, IncidentCreate, PersonCreate, SettingUpdate, SettingResponse, TodayStatsResponse, WeeklyStatsResponse
from app.models.database import Incident, Person, Setting
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Endpoints para la configuración
@router.get("/settings", response_model=List[SettingResponse], tags=["config"])
async def get_settings(db: Session = Depends(get_db)):
    logger.info("Obteniendo configuraciones")
    return db.query(Setting).all()

@router.get("/settings/{key}", response_model=SettingResponse, tags=["config"])
async def get_setting(key: str, db: Session = Depends(get_db)):
    logger.info(f"Obteniendo configuración: {key}")
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Configuración {key} no encontrada")
    return setting

@router.put("/settings/{key}", response_model=SettingResponse, tags=["config"])
async def update_setting(key: str, setting: SettingUpdate, request: Request, db: Session = Depends(get_db)):
    logger.info(f"Actualizando configuración: {key} con valor: {setting.value}")
    db_setting = db.query(Setting).filter(Setting.key == key).first()
    if not db_setting:
        db_setting = Setting(key=key, value=setting.value)
        db.add(db_setting)
    else:
        db_setting.value = setting.value
    db.commit()
    db.refresh(db_setting)
    
    try:
        if hasattr(request.app.state, "video_processor"):
            await request.app.state.video_processor.update_config({key: setting.value})
    except Exception as e:
        logger.error(f"Error al actualizar la configuración en el procesador: {e}")
    
    return db_setting

# Endpoints para el stream
@router.get("/stream/status", tags=["stream"])
async def get_stream_status(request: Request):
    logger.info("Obteniendo estado del stream")
    try:
        is_running = request.app.state.video_processor.is_running
        fps = request.app.state.video_processor.current_fps
        ai_pipeline = request.app.state.ai_pipeline
        return {
            "is_running": is_running,
            "fps": fps,
            "camera_url": settings.CAMERA_URL,
            "camera_location": settings.CAMERA_LOCATION,
            "ai_metrics": {
                "yolo_latency_ms": getattr(ai_pipeline.detector, "last_inference_time", 0) * 1000,
                "deepsort_latency_ms": getattr(ai_pipeline.tracker, "last_tracking_time", 0) * 1000,
                "timesformer_latency_ms": getattr(ai_pipeline.classifier, "last_inference_time", 0) * 1000
            }
        }
    except Exception as e:
        logger.error(f"Error al obtener el estado del stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener el estado del stream: {str(e)}")

@router.post("/stream/start", tags=["stream"])
async def start_stream(request: Request):
    logger.info("Iniciando stream de video")
    try:
        await request.app.state.video_processor.start()
        return {"message": "Stream iniciado correctamente"}
    except Exception as e:
        logger.error(f"Error al iniciar el stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error al iniciar el stream: {str(e)}")

@router.post("/stream/stop", tags=["stream"])
async def stop_stream(request: Request):
    logger.info("Deteniendo stream de video")
    try:
        await request.app.state.video_processor.stop()
        return {"message": "Stream detenido correctamente"}
    except Exception as e:
        logger.error(f"Error al detener el stream: {e}")
        raise HTTPException(status_code=500, detail=f"Error al detener el stream: {str(e)}")

# Endpoints para incidentes
@router.get("/incidents", response_model=List[IncidentDetail], tags=["incidents"])
async def get_incidents(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    min_violence_score: Optional[float] = None,
    db: Session = Depends(get_db)
):
    logger.info(f"Obteniendo incidentes (skip={skip}, limit={limit}, status={status}, min_violence_score={min_violence_score})")
    
    query = db.query(Incident)
    
    if start_date:
        query = query.filter(Incident.timestamp >= start_date)
    if end_date:
        query = query.filter(Incident.timestamp <= end_date)
    if status:
        query = query.filter(Incident.status == status)
    if min_violence_score is not None:
        query = query.filter(Incident.violence_score >= min_violence_score)
    
    query = query.order_by(Incident.timestamp.desc())
    incidents = query.offset(skip).limit(limit).all()
    return incidents

@router.get("/incidents/{incident_id}", response_model=IncidentDetail, tags=["incidents"])
async def get_incident(incident_id: int, db: Session = Depends(get_db)):
    logger.info(f"Obteniendo detalles del incidente {incident_id}")
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incidente {incident_id} no encontrado")
    return incident

@router.put("/incidents/{incident_id}", response_model=IncidentDetail, tags=["incidents"])
async def update_incident_status(
    incident_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    logger.info(f"Actualizando estado del incidente {incident_id} a '{status}'")
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incidente {incident_id} no encontrado")
    
    incident.status = status
    db.commit()
    db.refresh(incident)
    return incident

@router.delete("/incidents/{incident_id}", tags=["incidents"])
async def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    logger.info(f"Eliminando incidente {incident_id}")
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incidente {incident_id} no encontrado")
    
    # Opcional: Eliminar clip físico
    if os.path.exists(incident.clip_path):
        try:
            os.remove(incident.clip_path)
        except Exception as e:
            logger.warning(f"Error al eliminar clip {incident.clip_path}: {e}")
    
    db.delete(incident)
    db.commit()
    return {"message": f"Incidente {incident_id} eliminado correctamente"}

@router.get("/incidents/{incident_id}/clip", tags=["incidents"])
async def get_incident_clip(incident_id: int, db: Session = Depends(get_db)):
    logger.info(f"Obteniendo clip del incidente {incident_id}")
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incidente {incident_id} no encontrado")
    
    clip_path = incident.clip_path
    if not os.path.exists(clip_path):
        raise HTTPException(status_code=404, detail="Clip de video no encontrado")
    
    return FileResponse(
        clip_path,
        media_type="video/mp4",
        filename=f"incidente_{incident_id}_{incident.timestamp.strftime('%Y%m%d_%H%M%S')}.mp4"
    )

# Endpoints para estadísticas
@router.get("/stats/today", response_model=TodayStatsResponse, tags=["stats"])
async def get_today_stats(db: Session = Depends(get_db)):
    logger.info("Obteniendo estadísticas del día")
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = db.query(Incident).filter(Incident.timestamp >= today_start).count()
    new_count = db.query(Incident).filter(Incident.timestamp >= today_start, Incident.status == "new").count()
    resolved_count = db.query(Incident).filter(Incident.timestamp >= today_start, Incident.status == "resolved").count()
    false_alarm_count = db.query(Incident).filter(Incident.timestamp >= today_start, Incident.status == "false_alarm").count()
    
    return {
        "total": total_today,
        "by_status": {
            "new": new_count,
            "resolved": resolved_count,
            "false_alarm": false_alarm_count
        },
        "date": today_start.strftime("%Y-%m-%d")
    }

@router.get("/stats/weekly", response_model=WeeklyStatsResponse, tags=["stats"])
async def get_weekly_stats(db: Session = Depends(get_db)):
    logger.info("Obteniendo estadísticas de la semana")
    today = datetime.now()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    daily_counts = []
    
    for day_offset in range(7):
        day_start = start_of_week + timedelta(days=day_offset)
        day_end = day_start + timedelta(days=1)
        count = db.query(Incident).filter(
            Incident.timestamp >= day_start,
            Incident.timestamp < day_end
        ).count()
        daily_counts.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "day": day_start.strftime("%A"),
            "count": count
        })
    
    total_weekly = sum(day["count"] for day in daily_counts)
    
    return {
        "total": total_weekly,
        "daily_counts": daily_counts,
        "week_start": start_of_week.strftime("%Y-%m-%d"),
        "week_end": (start_of_week + timedelta(days=6)).strftime("%Y-%m-%d")
    }