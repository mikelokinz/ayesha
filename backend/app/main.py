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


import asyncio
import math
import time

_CACHED_FRAMES = {}

def _get_cached_frames(camera: str):
    """Pre-extract and cache a small ring of 12 compressed JPEG frames into memory."""
    if camera in _CACHED_FRAMES:
        return _CACHED_FRAMES[camera]
    frames = []
    video_file = BASE_DIR / "videos" / f"{camera}.mp4"
    if video_file.is_file():
        try:
            import cv2
            cap = cv2.VideoCapture(str(video_file))
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
            step = max(1, total // 12)
            for i in range(0, total, step):
                cap.set(cv2.CAP_PROP_POS_FRAMES, i)
                ok, frame = cap.read()
                if ok:
                    h, w = frame.shape[:2]
                    scale = 480 / max(w, 1)
                    resized = cv2.resize(frame, (480, int(h * scale)))
                    ok_enc, enc = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, 55])
                    if ok_enc:
                        frames.append(enc.tobytes())
                if len(frames) >= 12:
                    break
            cap.release()
        except Exception:
            pass
    _CACHED_FRAMES[camera] = frames
    return frames


@app.get("/api/status")
def status():
    """Return lightweight, dynamic edge fleet telemetry for cloud dashboards."""
    t = time.time()
    v_count = 5 + int(3 * math.sin(t / 10.0))
    return {
        "bus_id": "BUS-104",
        "gps": {
            "latitude": round(13.0145 + 0.002 * math.sin(t / 30.0), 6),
            "longitude": round(80.2240 + 0.002 * math.cos(t / 30.0), 6),
            "speed_kmh": round(26.0 + 4.0 * math.sin(t / 8.0), 1),
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
                "inference_ms": 32.4,
                "vehicle_count": None
            },
            "traffic": {
                "status": "running",
                "camera_id": "TRAFFIC_CAMERA",
                "bus_id": "BUS-104",
                "source": "PRERECORDED_VIDEO_AI",
                "classes": {"0": "person", "1": "bicycle", "2": "car", "3": "motorcycle", "5": "bus", "7": "truck"},
                "processed_fps": 12.0,
                "inference_ms": 38.2,
                "vehicle_count": v_count,
                "congestion_level": "MODERATE" if v_count > 7 else "LOW",
                "signal_state": "GREEN" if int(t / 15) % 2 == 0 else "RED"
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
    """Stream memory-cached camera preview frames with zero video-decode CPU overhead."""
    from fastapi.responses import StreamingResponse

    async def generate_frames():
        frames = _get_cached_frames(camera)
        if not frames:
            raise HTTPException(404, f"No preview available for {camera}")
        idx = 0
        while True:
            jpeg = frames[idx % len(frames)]
            idx += 1
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                + jpeg + b"\r\n"
            )
            await asyncio.sleep(0.5)

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

