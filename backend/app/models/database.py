import os
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import ForeignKey
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from contextlib import contextmanager

from app.config import settings

# Crear motor de base de datos
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

# Crear sesión
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Crear base declarativa
Base = declarative_base()

# Modelo para incidentes
class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now, index=True)
    violence_score = Column(Float, nullable=False)
    location = Column(String, nullable=True)
    clip_path = Column(String, nullable=False)
    status = Column(String, default="new", index=True)
    
    # Relación con personas
    persons = relationship("Person", back_populates="incident")
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "violence_score": self.violence_score,
            "location": self.location,
            "clip_path": self.clip_path,
            "status": self.status,
            "persons": [person.to_dict() for person in self.persons]
        }

# Modelo para personas involucradas en incidentes
class Person(Base):
    __tablename__ = "persons"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"))
    person_id = Column(Integer, nullable=False)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    w = Column(Integer, nullable=False)
    h = Column(Integer, nullable=False)
    
    # Relación con incidente
    incident = relationship("Incident", back_populates="persons")
    
    def to_dict(self):
        return {
            "id": self.id,
            "incident_id": self.incident_id,
            "person_id": self.person_id,
            "bounding_box": [self.x, self.y, self.w, self.h]
        }

# Modelo para configuración
class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    
    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value
        }

# Índices adicionales
Index('ix_incidents_timestamp', Incident.timestamp)
Index('ix_incidents_status', Incident.status)

# Inicializar base de datos
def init_db():
    Base.metadata.create_all(bind=engine)
    
    with get_db_session() as db:
        if db.query(Setting).filter(Setting.key == "violence_threshold").first() is None:
            db.add(Setting(key="violence_threshold", value=str(settings.VIOLENCE_THRESHOLD)))
        if db.query(Setting).filter(Setting.key == "yolo_conf_threshold").first() is None:
            db.add(Setting(key="yolo_conf_threshold", value=str(settings.YOLO_CONF_THRESHOLD)))
        if db.query(Setting).filter(Setting.key == "camera_location").first() is None:
            db.add(Setting(key="camera_location", value=settings.CAMERA_LOCATION))

@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()