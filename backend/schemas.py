from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


# Auth

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    token: str
    user_id: str
    name: str
    email: str


# Decision

class DecisionCreate(BaseModel):
    ticker: Optional[str] = None
    decision_type: str = Field(..., pattern="^(buy|sell|hold|add|pass)$")
    thesis: str = Field(..., min_length=10)
    emotional_state: int = Field(..., ge=1, le=5)


class OutcomeUpdate(BaseModel):
    outcome: str = Field(..., pattern="^(proceeded|paused|reversed)$")
    outcome_rating: int = Field(..., ge=1, le=5)
    outcome_notes: Optional[str] = None


class DecisionOut(BaseModel):
    id: str
    created_at: datetime
    ticker: Optional[str]
    decision_type: str
    thesis: str
    emotional_state: int
    price_score: Optional[float]
    ruin_score: Optional[float]
    imitation_score: Optional[float]
    confirmation_score: Optional[float]
    ego_score: Optional[float]
    synthesis_memo: Optional[Any]
    recommendation: Optional[str]
    outcome: Optional[str]
    outcome_rating: Optional[int]
    outcome_notes: Optional[str]
    outcome_updated_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True


# Agent

class AgentRunRequest(BaseModel):
    extra_context: Optional[str] = None


class ConversationTurn(BaseModel):
    user_message: Optional[str] = None


class ConversationResponse(BaseModel):
    status: str
    content: str
    score: Optional[float]
    questions_asked: int
    max_questions: int


class AgentRunOut(BaseModel):
    id: str
    decision_id: str
    agent_name: str
    response: str
    score: Optional[float]
    skipped: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Journal Notes

class NoteCreate(BaseModel):
    note: str = Field(..., min_length=1)


class NoteOut(BaseModel):
    id: str
    decision_id: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True


# Bias Fingerprint

class BiasProfile(BaseModel):
    total_decisions: int
    avg_scores: dict[str, Optional[float]]
    weakest_dimension: Optional[str]
    skip_counts: dict[str, int]
    emotional_regret_rate: Optional[float]
    imitation_rate: Optional[float]
    insights: list[str]
