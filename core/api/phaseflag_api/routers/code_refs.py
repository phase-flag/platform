"""Code reference endpoints — flag usage tracking across codebases."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import code_ref_service
from phaseflag_api.repositories import flag_repository

router = APIRouter(dependencies=[Depends(require_api_key)])


class CodeReference(BaseModel):
    file: str
    line: int = 0
    repo: str = ""
    branch: str = "main"
    language: str = ""
    context: str = ""


class UploadRefsRequest(BaseModel):
    flag_key: str
    references: list[CodeReference] = Field(..., max_length=1000)


class RefOut(BaseModel):
    file: str
    line: int
    repo: str
    branch: str
    language: str
    context: str
    uploaded_at: str


@router.post(
    "/code-refs/upload", status_code=201, dependencies=[require_role("editor")]
)
async def upload_references(body: UploadRefsRequest):
    count = code_ref_service.upload_references(
        body.flag_key,
        [r.model_dump() for r in body.references],
    )
    return {"uploaded": count, "flag_key": body.flag_key}


@router.get("/code-refs/{flag_key}", response_model=list[RefOut])
async def get_references(flag_key: str):
    refs = code_ref_service.get_references(flag_key)
    return [RefOut(**r) for r in refs]


@router.get("/code-refs/summary")
async def get_summary():
    return code_ref_service.get_summary()


@router.get("/code-refs/unused")
async def get_unused_flags(session: AsyncSession = Depends(get_session)):
    flags, _ = await flag_repository.list_flags(session, limit=10000, offset=0)
    flag_keys = [f.key for f in flags]
    unused = code_ref_service.get_unused_flags(flag_keys)
    return {"unused_flags": unused, "count": len(unused)}
