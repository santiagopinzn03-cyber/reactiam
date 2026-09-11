from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/materiales", tags=["Materiales"])


# GET /materiales/  -> lista todos los materiales activos (no eliminados)
@router.get("/", response_model=list[schemas.MaterialOut])
def listar_materiales(db: Session = Depends(get_db)):
    return (
        db.query(models.Material)
        .filter(models.Material.fecha_eliminacion.is_(None))
        .all()
    )


# GET /materiales/{id} -> obtiene un material puntual
@router.get("/{material_id}", response_model=schemas.MaterialOut)
def obtener_material(material_id: int, db: Session = Depends(get_db)):
    material = (
        db.query(models.Material)
        .filter(
            models.Material.id == material_id,
            models.Material.fecha_eliminacion.is_(None),
        )
        .first()
    )
    if not material:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    return material


# POST /materiales/ -> crea un material nuevo
@router.post("/", response_model=schemas.MaterialOut, status_code=201)
def crear_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    nuevo = models.Material(**material.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# PUT /materiales/{id} -> actualiza un material existente
@router.put("/{material_id}", response_model=schemas.MaterialOut)
def actualizar_material(
    material_id: int, material: schemas.MaterialUpdate, db: Session = Depends(get_db)
):
    existente = (
        db.query(models.Material).filter(models.Material.id == material_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    for campo, valor in material.model_dump(exclude_unset=True).items():
        setattr(existente, campo, valor)

    db.commit()
    db.refresh(existente)
    return existente


# DELETE /materiales/{id} -> elimina (soft delete, marca fecha_eliminacion)
@router.delete("/{material_id}", status_code=204)
def eliminar_material(material_id: int, db: Session = Depends(get_db)):
    existente = (
        db.query(models.Material).filter(models.Material.id == material_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    existente.fecha_eliminacion = datetime.utcnow()
    db.commit()
    return None
