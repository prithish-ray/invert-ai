import os
from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON
from datetime import datetime, timezone
import uuid

# Auto-detect: use SQLite locally, Postgres in production
DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    JSONType = JSONB
else:
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), "invert.db")
    engine = create_engine(f"sqlite:///{SQLITE_PATH}", connect_args={"check_same_thread": False})
    JSONType = JSON

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def new_id():
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


# Models

class User(Base):
    __tablename__ = "users"

    id            = Column(String, primary_key=True, default=new_id)
    name          = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at    = Column(DateTime(timezone=True), default=now_utc)

    decisions = relationship("Decision", back_populates="user", cascade="all, delete-orphan")


class Decision(Base):
    __tablename__ = "decisions"

    id                  = Column(String, primary_key=True, default=new_id)
    created_at          = Column(DateTime(timezone=True), default=now_utc)

    user_id             = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    user                = relationship("User", back_populates="decisions")

    ticker              = Column(String(20), nullable=True)
    decision_type       = Column(String(20))
    thesis              = Column(Text)
    emotional_state     = Column(Integer)

    price_score         = Column(Float, nullable=True)
    ruin_score          = Column(Float, nullable=True)
    imitation_score     = Column(Float, nullable=True)
    confirmation_score  = Column(Float, nullable=True)
    ego_score           = Column(Float, nullable=True)

    synthesis_memo      = Column(JSON, nullable=True)
    recommendation      = Column(String(20), nullable=True)

    outcome             = Column(String(30), nullable=True)
    outcome_rating      = Column(Integer, nullable=True)
    outcome_notes       = Column(Text, nullable=True)
    outcome_updated_at  = Column(DateTime(timezone=True), nullable=True)

    status              = Column(String(20), default="in_progress")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id                   = Column(String, primary_key=True, default=new_id)
    decision_id          = Column(String, nullable=False)
    agent_name           = Column(String(30))
    prompt_sent          = Column(Text)
    response             = Column(Text)
    score                = Column(Float, nullable=True)
    skipped              = Column(Boolean, default=False)
    created_at           = Column(DateTime(timezone=True), default=now_utc)
    conversation_history = Column(JSON, default=list)
    questions_asked      = Column(Integer, default=0)
    status               = Column(String(20), default="idle")


class JournalNote(Base):
    __tablename__ = "journal_notes"

    id           = Column(String, primary_key=True, default=new_id)
    decision_id  = Column(String, nullable=False)
    note         = Column(Text)
    created_at   = Column(DateTime(timezone=True), default=now_utc)


def create_tables():
    Base.metadata.create_all(bind=engine)
