from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import usuarios

# Crea las tablas que falten en la base de datos (no borra las existentes)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="TitanV API")

# Permite que React Native (Expo) pueda llamar a esta API sin bloqueo de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción, restringe a los orígenes que necesites
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(usuarios.router)


@app.get("/")
def raiz():
    return {"mensaje": "API de Titán V corriendo correctamente"}


@app.get("/health")
def health():
    return {"estado": "ok"}