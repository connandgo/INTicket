import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config.settings import settings

# JWT payload에서 사용자 ID가 담길 수 있는 claim 이름 후보.
# auth-server가 이미지로만 제공돼 실제 claim 이름을 확정할 수 없어 순서대로 시도한다.
USER_ID_CLAIMS = ("userId", "user_id", "sub", "uid")

security = HTTPBearer()

_jwks_cache: dict = {}


async def get_jwks() -> dict:
    global _jwks_cache
    if not _jwks_cache:
        async with httpx.AsyncClient() as client:
            response = await client.get(settings.jwk_set_uri)
            response.raise_for_status()
            _jwks_cache = response.json()
    return _jwks_cache


def get_signing_key(token: str, jwks: dict) -> dict:
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 헤더에 kid가 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="일치하는 공개키를 찾을 수 없습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효하지 않은 토큰입니다",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        jwks = await get_jwks()
        signing_key = get_signing_key(token, jwks)

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=settings.jwt_issuer_uri,
            options={"verify_aud": False}
        )
        return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰입니다: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_user_id(payload: dict, request: Request = None) -> int:
    """토큰 payload에서 사용자 ID를 꺼낸다. 없으면 X-User-Id 헤더를 폴백으로 쓴다.

    다른 Java 서비스들은 전부 Gateway가 넣어주는 X-User-Id 헤더만 읽으므로,
    payload에 ID claim이 없는 배포에서도 이 폴백으로 동작한다.
    """
    for claim in USER_ID_CLAIMS:
        value = (payload or {}).get(claim)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue  # sub가 이메일 같은 비숫자면 다음 후보로 넘어간다

    if request is not None:
        header_value = request.headers.get("X-User-Id")
        if header_value:
            try:
                return int(header_value)
            except ValueError:
                pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="토큰과 헤더 어디에서도 사용자 ID를 찾을 수 없습니다",
    )


async def current_user_id(
    request: Request,
    payload: dict = Depends(verify_token),
) -> int:
    """라우터에서 바로 쓰는 사용자 ID 의존성."""
    return extract_user_id(payload, request)


async def verify_service_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    payload = await verify_token(credentials)
    scopes = payload.get("scope", "").split()

    if "service.read" not in scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="서비스 권한이 없습니다"
        )

    return payload