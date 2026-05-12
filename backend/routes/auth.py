import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

# passlib 1.7.4 reads bcrypt.__about__.__version__, which bcrypt >= 4.0 removed.
# This shim restores the attribute so password hashing works on any bcrypt version.
import bcrypt as _bcrypt_mod
if not hasattr(_bcrypt_mod, '__about__'):
    _bcrypt_mod.__about__ = type('_about', (), {'__version__': _bcrypt_mod.__version__})()

from passlib.context import CryptContext

from database import get_db, User, new_id, now_utc
from schemas import UserCreate, UserLogin, UserOut, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY          = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM           = "HS256"
TOKEN_EXPIRE_DAYS   = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security    = HTTPBearer(auto_error=False)


# ── Helpers ────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


# ── Dependency: get the authenticated user from the Bearer token ───────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload  = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower().strip()).first():
        raise HTTPException(status_code=400, detail="An account with that email already exists.")

    user = User(
        id=new_id(),
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        created_at=now_utc(),
    )
    db.add(user)
    db.commit()

    return Token(
        token=create_access_token(user.id),
        user_id=user.id,
        name=user.name,
        email=user.email,
    )


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return Token(
        token=create_access_token(user.id),
        user_id=user.id,
        name=user.name,
        email=user.email,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/demo", response_model=Token)
def demo_login(db: Session = Depends(get_db)):
    """Return a JWT for the shared demo account, creating it if it doesn't exist."""
    email = "demo@invert.app"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=new_id(),
            name="Demo User",
            email=email,
            password_hash=hash_password("invert-demo-account"),
            created_at=now_utc(),
        )
        db.add(user)
        db.commit()

    return Token(
        token=create_access_token(user.id),
        user_id=user.id,
        name=user.name,
        email=user.email,
    )
