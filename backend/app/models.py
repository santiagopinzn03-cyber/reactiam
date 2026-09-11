from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class Material(Base):
    __tablename__ = "materiales"

    id = Column(Integer, primary_key=True, index=True)
    nombre_material = Column(String(100), nullable=False)
    unidad_medida = Column(String(50), nullable=False)
    fecha_eliminacion = Column(DateTime, nullable=True)


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)