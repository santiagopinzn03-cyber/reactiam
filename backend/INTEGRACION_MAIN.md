# Cómo integrar el CRUD de materiales en tu backend existente

## 1. Modelo (`app/models.py`)
Copia el contenido de `models_materiales.py` dentro de tu `models.py` actual
(la clase `Material`). Si ya tienes esa tabla mapeada, no la dupliques.

## 2. Schemas (`app/schemas.py`)
Copia el contenido de `schemas_materiales.py` dentro de tu `schemas.py` actual.

## 3. Router
Copia la carpeta `routers/materiales.py` dentro de tu proyecto en
`app/routers/materiales.py`. Si no tienes carpeta `routers`, créala con un
`__init__.py` vacío.

## 4. Registrar el router en `app/main.py`

```python
from fastapi import FastAPI
from app.routers import materiales

app = FastAPI()

app.include_router(materiales.router)
```

## 5. CORS (necesario para que React Native pueda llamar a la API)

Si tu `main.py` no tiene CORS configurado, agrégalo:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción restringe esto
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 6. Probar

Con el servidor corriendo (`uvicorn app.main:app --reload --port 8000`):

- `GET    http://localhost:8000/materiales/`
- `POST   http://localhost:8000/materiales/`      body: {"nombre_material": "...", "unidad_medida": "..."}
- `PUT    http://localhost:8000/materiales/1`      body: {"nombre_material": "..."}
- `DELETE http://localhost:8000/materiales/1`

También puedes verlos documentados en `http://localhost:8000/docs`.
