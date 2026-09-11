from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MaterialBase(BaseModel):
    nombre_material: str
    unidad_medida: str

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    nombre_material: Optional[str] = None
    unidad_medida: Optional[str] = None

class MaterialResponse(MaterialBase):
    id: int
    fecha_eliminacion: Optional[datetime] = None

    class Config:
        from_attributes = True

# Alias requerido por materiales.py
MaterialOut = MaterialResponse

class UsuarioBase(BaseModel):
    nombre: str
    email: str

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioResponse(UsuarioBase):
    id: int

    class Config:
        from_attributes = True