from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import os

from database import database

router = APIRouter(prefix="/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET     = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))


def make_token(user_id: str, email: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode({"sub": user_id, "email": email, "exp": exp}, SECRET, algorithm=ALGORITHM)


class RegisterBody(BaseModel):
    email: str
    password: str
    username: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterBody):
    existing = await database.fetch_one("SELECT user_id FROM users WHERE email = :e", {"e": body.email})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    hashed = pwd.hash(body.password)
    row = await database.fetch_one(
        "INSERT INTO users (email, password, username) VALUES (:e, :p, :u) RETURNING user_id, email, username, coin_balance",
        {"e": body.email, "p": hashed, "u": body.username},
    )
    await database.execute(
        "INSERT INTO streaks (user_id) VALUES (:uid) ON CONFLICT DO NOTHING",
        {"uid": str(row["user_id"])},
    )
    token = make_token(str(row["user_id"]), row["email"])
    return {"token": token, "user": dict(row)}


@router.post("/login")
async def login(body: LoginBody):
    row = await database.fetch_one(
        "SELECT user_id, email, username, password, coin_balance FROM users WHERE email = :e",
        {"e": body.email},
    )
    if not row or not pwd.verify(body.password, row["password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    token = make_token(str(row["user_id"]), row["email"])
    user = {k: v for k, v in dict(row).items() if k != "password"}
    user["user_id"] = str(user["user_id"])
    return {"token": token, "user": user}
