from pydantic import BaseModel, validator, Field
from typing import List, Optional
from datetime import datetime
import json


# Schema para incidentes
class IncidentBase(BaseModel):
    violence_score: float = Field(..., ge=0.0, le=1.0, description="Puntuación de violencia (0-1)")
    location: Optional[str] = None
    status: str = "new"

class IncidentCreate(IncidentBase):
    clip_path: str

class PersonBase(BaseModel):
    person_id: int
    bounding_box: List[float]
    
    @validator('bounding_box')
    def validate_bbox(cls, v):
        if len(v) != 4:
            raise ValueError('El bounding box debe tener 4 valores [x, y, w, h]')
        return v
    
class PersonCreate(PersonBase):
    incident_id: int

class PersonInIncident(PersonBase):
    id: int
    
    class Config:
        orm_mode = True

class IncidentDetail(IncidentBase):
    id: int
    timestamp: datetime
    clip_path: str
    persons: List[PersonInIncident] = []
    
    class Config:
        orm_mode = True

# Schema para respuesta en el stream
class DetectionResponse(BaseModel):
    frame_id: int
    persons: List[dict]
    violence_detected: bool = False
    violence_score: Optional[float] = None


# Schema para configuración
class SettingUpdate(BaseModel):
    value: str

class SettingResponse(BaseModel):
    key: str
    value: str
    
    class Config:
        orm_mode = True

# Schema para websocket
class WebSocketCommand(BaseModel):
    command: str
    config: Optional[dict] = None