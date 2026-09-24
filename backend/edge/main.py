"""Local demonstration previews. Central service receives events, not these streams.
Includes video upload + reset for per-camera live sources, with auto-restart
of the affected camera worker so new videos take effect immediately.
"""
import asyncio
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from edge.runtime import EdgeRuntime, load_config, CameraWorker

runtime = None
_cfg = None
_video_paths = None
_backup_paths = None


def _init_paths():
    """Resolve the current video paths once at startup."""
    global _cfg, _video_paths, _backup_paths
    _cfg = load_config()
    _video_paths = {
        "road":    Path(_cfg["road_video"]).resolve(),
        "traffic": Path(_cfg["traffic_video"]).resolve(),
    }
    _backup_paths = {
        "road":    _video_paths["road"].with_suffix(".original.mp4"),
        "traffic": _video_paths["traffic"].with_suffix(".original.mp4"),
    }


def _ensure_backup(camera: str):
    """One-time backup of the original demo video so reset can restore it."""
    src = _video_paths[camera]
    bak = _backup_paths[camera]
    if not bak.exists() and src.exists():
        shutil.copy2(src, bak)


def _stop_worker(camera: str):
    """Stop the camera worker so its open video file handles are released."""
    global runtime
    if runtime is None:
        return
    old = runtime.workers.get(camera)
    if old is not None:
        old.stop.set()
        old.thread.join(timeout=6)
        time.sleep(0.3)


def _start_worker(camera: str):
    """Start a new camera worker."""
    global runtime
    if runtime is None:
        return False, "runtime not initialized"
    try:
        new_worker = CameraWorker(camera, runtime.config, runtime.outbox,
                                  runtime.started, runtime.gps)
        new_worker.thread.start()
        runtime.workers[camera] = new_worker
        return True, None
    except Exception as exc:
        return False, str(exc)


def _restart_worker(camera: str):
    """Stop and restart the camera worker."""
    _stop_worker(camera)
    return _start_worker(camera)


def _safe_replace(src_path: Path, dst_path: Path, retries: int = 6, delay: float = 0.3):
    """Safely replace or copy a file on Windows by retrying if file locks are being released."""
    for attempt in range(retries):
        try:
            if dst_path.exists():
                try:
                    dst_path.unlink()
                except (PermissionError, OSError):
                    pass
            src_path.replace(dst_path)
            return
        except (PermissionError, OSError) as exc:
            if attempt == retries - 1:
                try:
                    shutil.copy2(src_path, dst_path)
                    src_path.unlink(missing_ok=True)
                    return
                except Exception:
                    raise exc
            time.sleep(delay)



@asynccontextmanager
async def lifespan(app):
    global runtime
    _init_paths()
    runtime = EdgeRuntime()
    runtime.start()
    yield
    runtime.close()


app = FastAPI(title="UrbanPulse Bus Edge Preview", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status():
    return runtime.status()


@app.get("/api/live/{camera}")
async def live(camera: str):
    worker = runtime.workers.get(camera)
    if worker is None:
        raise HTTPException(404, "Unknown camera")
    if worker.snapshot()["status"] == "error":
        raise HTTPException(503, worker.snapshot()["error"])

    async def frames():
        last = -1
        while not worker.stop.is_set():
            with worker.lock:
                jpeg, sequence = worker.jpeg, worker.sequence
                failed = worker.state["status"] == "error"
            if failed:
                break
            if jpeg is not None and sequence != last:
                last = sequence
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                    + jpeg + b"\r\n"
                )
            await asyncio.sleep(0.04)

    return StreamingResponse(
        frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────────────────────────
# Video source management
# ─────────────────────────────────────────────────────────────
@app.get("/api/camera-config")
def camera_config():
    """Show which video file each camera is currently pointed at."""
    out = {}
    for cam, path in _video_paths.items():
        out[cam] = {
            "path": str(path),
            "exists": path.exists(),
            "size_bytes": path.stat().st_size if path.exists() else None,
            "has_backup": _backup_paths[cam].exists(),
        }
    return out


@app.post("/api/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    camera: str = Query(None),
    form_camera: str = Form(None),
):
    """Replace the video used by the given camera and restart the worker.
    Accepts camera from query string OR form body.
    """
    camera = camera or form_camera or "road"
    if camera not in ("road", "traffic"):
        return {"ok": False, "error": f"Invalid camera: {camera}"}

    _ensure_backup(camera)
    target = _video_paths[camera]

    try:
        data = await file.read()
    except Exception as exc:
        return {"ok": False, "error": f"Failed to read upload: {exc}"}

    if len(data) < 1024:
        return {"ok": False, "error": "File too small to be a valid video"}

    # Stop worker before modifying file to release Windows file handles
    _stop_worker(camera)

    tmp = target.with_suffix(".uploading")
    try:
        tmp.write_bytes(data)
        _safe_replace(tmp, target)
    except Exception as exc:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        _start_worker(camera)
        return {"ok": False, "error": f"Failed to save video: {exc}"}

    frames, fps = None, None
    try:
        import cv2
        cap = cv2.VideoCapture(str(target))
        if cap.isOpened():
            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = round(float(cap.get(cv2.CAP_PROP_FPS)), 2)
        cap.release()
    except Exception:
        pass

    restarted, restart_err = _start_worker(camera)

    return {
        "ok": True,
        "camera": camera,
        "filename": file.filename or target.name,
        "bytes": len(data),
        "path": str(target),
        "frames": frames,
        "fps": fps,
        "worker_restarted": restarted,
        "worker_restart_error": restart_err,
    }


@app.post("/api/reset-video")
def reset_video(camera: str = Query(..., pattern="^(road|traffic)$")):
    """Restore the original demo video and restart the worker."""
    bak = _backup_paths[camera]
    if not bak.exists():
        raise HTTPException(404, f"No backup exists for {camera}; nothing to reset to.")
    _stop_worker(camera)
    _safe_replace(bak, _video_paths[camera]) if False else shutil.copy2(bak, _video_paths[camera])
    restarted, restart_err = _start_worker(camera)
    return {
        "ok": True,
        "reset": True,
        "camera": camera,
        "restored_from": str(bak),
        "path": str(_video_paths[camera]),
        "worker_restarted": restarted,
        "worker_restart_error": restart_err,
    }

