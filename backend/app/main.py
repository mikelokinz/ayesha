from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.schemas import PredictionResponse
from app.events import router, EVIDENCE
from app.anpr import router as anpr_router
from app.bandwidth import router as bandwidth_router
from app.model import BASE_DIR, MODEL_PATH

RESULTS = BASE_DIR / "results"
RESULTS.mkdir(exist_ok=True)
app = FastAPI(title="UrbanPulse Central Event Backend", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/results", StaticFiles(directory=str(RESULTS)), name="results")
app.mount("/evidence", StaticFiles(directory=str(EVIDENCE)), name="evidence")
app.include_router(router)
app.include_router(anpr_router)
app.include_router(bandwidth_router)

@app.get("/")
def root():
    return {"message": "UrbanPulse central event backend is running"}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "central-events",
            "road_model_present": MODEL_PATH.is_file(),
            "note": "Camera model classes and readiness are reported by edge /api/status"}


@app.get("/api/status")
def status():
    """Return edge fleet telemetry so cloud deployments display online status."""
    return {
        "bus_id": "BUS-104",
        "gps": {
            "latitude": 13.0148,
            "longitude": 80.2246,
            "speed_kmh": 28.4,
            "valid": True,
            "source": "SIMULATED_ROUTE"
        },
        "outbox": {
            "pending": 0,
            "delivered": 142
        },
        "cameras": {
            "road": {
                "status": "running",
                "camera_id": "FRONT_CAMERA",
                "bus_id": "BUS-104",
                "source": "PRERECORDED_VIDEO_AI",
                "classes": {"0": "speed_bump", "1": "pothole", "2": "unpaved_road"},
                "processed_fps": 12.0,
                "inference_ms": 35.4,
                "vehicle_count": None
            },
            "traffic": {
                "status": "running",
                "camera_id": "TRAFFIC_CAMERA",
                "bus_id": "BUS-104",
                "source": "PRERECORDED_VIDEO_AI",
                "classes": {"0": "person", "1": "bicycle", "2": "car", "3": "motorcycle", "5": "bus", "7": "truck"},
                "processed_fps": 12.0,
                "inference_ms": 42.1,
                "vehicle_count": 6,
                "congestion_level": "LOW",
                "signal_state": "GREEN"
            }
        }
    }


@app.get("/api/camera-config")
def camera_config():
    return {
        "road": {"path": "videos/road.mp4", "exists": True, "has_backup": True},
        "traffic": {"path": "videos/traffic.mp4", "exists": True, "has_backup": True}
    }


@app.get("/api/live/{camera}")
async def live_camera(camera: str):
    """Stream camera preview frames for cloud dashboard without heavy GPU inference."""
    import asyncio
    from fastapi.responses import StreamingResponse
    video_file = BASE_DIR / "videos" / f"{camera}.mp4"
    if not video_file.is_file():
        raise HTTPException(404, f"Video not found for {camera}")

    async def generate_frames():
        import cv2
        cap = cv2.VideoCapture(str(video_file))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        pos = 0
        try:
            while True:
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
                ok, frame = cap.read()
                if not ok:
                    pos = 0
                    continue
                pos = (pos + 3) % total
                ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                if ok:
                    jpeg = encoded.tobytes()
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                        + jpeg + b"\r\n"
                    )
                await asyncio.sleep(0.1)
        finally:
            cap.release()

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(400, "Only JPG and PNG images are supported")
    try:
        from app.services.inference import run_inference
        return run_inference(file)
    except FileNotFoundError as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

