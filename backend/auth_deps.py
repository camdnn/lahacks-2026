import os
from fastapi import Header, HTTPException
from jose import jwt, JWTError

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def get_current_user_id(authorization: str = Header(...)) -> str:
    try:
        scheme, token = authorization.split()
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload["sub"]
    except (JWTError, ValueError):
        raise HTTPException(401, "Invalid or expired token")
