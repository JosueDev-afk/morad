from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import appointments, auth, ratings, reports, slots, therapists

app = FastAPI(title="MORAD API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://morad.kubistudio.cloud"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(slots.router)
app.include_router(appointments.router)
app.include_router(therapists.router)
app.include_router(ratings.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
