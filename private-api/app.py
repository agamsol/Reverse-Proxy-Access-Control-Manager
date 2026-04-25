import os
import time
import uvicorn
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends, status, HTTPException
from fastapi.responses import FileResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from routes import service, auth, pending, connection, webhook
from models.auth_models import oauth2_token_scheme
from common_custom.utils.pydantic.health_models import StatusResponseModel

_HERE = Path(__file__).resolve().parent
DATA_DIR = (_HERE.parent / "data").resolve()

load_dotenv(DATA_DIR / ".env")
load_dotenv(DATA_DIR / "private.env")

SERVICE_VERSION = os.getenv("SERVICE_VERSION")
SERVICE_UNDER_MAINTENANCE = os.getenv("SERVICE_UNDER_MAINTENANCE") == 'True'


app = FastAPI(
    title="Reverse-Proxy-Access-Control-Manager",
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):

    start_time = time.perf_counter()
    response = await call_next(request)

    process_time = time.perf_counter() - start_time

    response.headers["X-Process-Time"] = f"{process_time:.4f}"

    return response


@app.get(
    "/status",
    tags=['Health'],
    summary="Get service status",
    response_model=StatusResponseModel
)
async def service_status():

    status_reponse = StatusResponseModel(
        version=SERVICE_VERSION,
        filesystem=os.name,
        maintenance=SERVICE_UNDER_MAINTENANCE
    )

    return status_reponse

app.include_router(
    router=auth.router
)

app.include_router(
    router=service.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

app.include_router(
    router=pending.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

app.include_router(
    router=connection.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

app.include_router(
    router=webhook.router,
    dependencies=[Depends(oauth2_token_scheme)]  # Alternativly: Annotated[str, Depends(oauth2_token_scheme)]
)

STATIC_ROOT = (_HERE / "frontend" / "dist").resolve()


def _frontend_file_response(path_within: str) -> FileResponse:
    if not STATIC_ROOT.is_dir():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Frontend not built. Run: cd private-api/frontend && npm install && npm run build",
        )
    if path_within:
        candidate = (STATIC_ROOT / path_within).resolve()
        try:
            candidate.relative_to(STATIC_ROOT)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if candidate.is_file():
            return FileResponse(candidate)
    index = STATIC_ROOT / "index.html"
    if not index.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Frontend build is incomplete (missing index.html).",
        )
    return FileResponse(index)


@app.get("/", include_in_schema=False)
async def admin_portal_index():
    return _frontend_file_response("")


@app.get("/{full_path:path}", include_in_schema=False)
async def admin_portal_static(full_path: str):
    return _frontend_file_response(full_path)


# Tags for API documentation
# ✅ Health
# ✅ Authentication
# - Login for jwt
# Services Management
# - ✅ Add
# - ✅ Remove
# - ✅ Edit
# - ✅ List
# Pending Connections Management
# - ✅ Allow
# - ✅ Deny (only remove request)
# - ✅ Ignore (And Deny)
# - ✅ List
# Access Management (Currently Allowed)
# - ✅ Revoke Access
# - ✅ List
# Notifications Webhook Route
# - Add Request

# Users Management

if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0", port=8001)
