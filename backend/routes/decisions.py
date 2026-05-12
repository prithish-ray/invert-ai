from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, Decision, AgentRun, new_id, now_utc, User
from schemas import (
    DecisionCreate, DecisionOut, AgentRunOut,
    ConversationTurn, ConversationResponse, OutcomeUpdate,
)
from agents import converse_agent, run_synthesis, generate_research_questions, SCORE_FIELD_MAP, MAX_FOLLOW_UPS
from routes.auth import get_current_user

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


# ── Create decision ─────────────────────────────────────────────────────────────

@router.post("", response_model=DecisionOut)
def create_decision(
    payload: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decision = Decision(
        id=new_id(),
        user_id=current_user.id,
        ticker=payload.ticker,
        decision_type=payload.decision_type,
        thesis=payload.thesis,
        emotional_state=payload.emotional_state,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


@router.get("", response_model=list[DecisionOut])
def list_decisions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Decision)
        .filter(Decision.user_id == current_user.id)
        .order_by(Decision.created_at.desc())
        .all()
    )


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.user_id == current_user.id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Decision not found")
    return d


# ── Multi-turn conversation endpoint ───────────────────────────────────────────

@router.post("/{decision_id}/converse/{agent_name}", response_model=ConversationResponse)
def converse(
    decision_id: str,
    agent_name: str,
    payload: ConversationTurn,
    db: Session = Depends(get_db),
):
    """
    One turn of the agent interrogation loop.
    - First call: user_message=None  → agent opens with its first challenge/question
    - Subsequent calls: user_message=<investor's reply>  → agent follows up or concludes
    """
    if agent_name not in SCORE_FIELD_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {agent_name}")

    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Get or create the AgentRun record for this agent
    run = (
        db.query(AgentRun)
        .filter(
            AgentRun.decision_id == decision_id,
            AgentRun.agent_name == agent_name,
            AgentRun.skipped == False,
        )
        .order_by(AgentRun.created_at.desc())
        .first()
    )

    if run is None:
        # First call — create fresh run
        run = AgentRun(
            id=new_id(),
            decision_id=decision_id,
            agent_name=agent_name,
            prompt_sent=decision.thesis,
            response="",
            skipped=False,
            conversation_history=[],
            questions_asked=0,
            status="questioning",
        )
        db.add(run)
        db.flush()
        history = []
    else:
        history = list(run.conversation_history or [])

        # Append the user's reply to the history before calling the agent
        if payload.user_message:
            history.append({"role": "user", "content": payload.user_message})

    # Run one agent turn
    result = converse_agent(
        agent_name=agent_name,
        history=history,
        thesis=decision.thesis,
        ticker=decision.ticker or "",
        decision_type=decision.decision_type,
        questions_asked=run.questions_asked or 0,
        max_turns=MAX_FOLLOW_UPS,
    )

    # Append agent's response to history
    history.append({"role": "assistant", "content": result["content"]})
    run.conversation_history = history

    if result["status"] == "complete":
        run.response = result["content"]
        run.score    = result["score"]
        run.status   = "complete"

        # Write score back to the Decision row
        score_field = SCORE_FIELD_MAP.get(agent_name)
        if score_field and result["score"] is not None:
            setattr(decision, score_field, result["score"])
    else:
        # Agent asked a follow-up question
        run.questions_asked = (run.questions_asked or 0) + 1
        run.status = "questioning"

    db.commit()

    return ConversationResponse(
        status=result["status"],
        content=result["content"],
        score=result["score"],
        questions_asked=run.questions_asked or 0,
        max_questions=MAX_FOLLOW_UPS,
    )


# ── Skip an agent ───────────────────────────────────────────────────────────────

@router.post("/{decision_id}/skip-agent/{agent_name}", response_model=AgentRunOut)
def skip_agent(decision_id: str, agent_name: str, db: Session = Depends(get_db)):
    if agent_name not in SCORE_FIELD_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {agent_name}")

    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    run = AgentRun(
        id=new_id(),
        decision_id=decision_id,
        agent_name=agent_name,
        prompt_sent="",
        response="[skipped]",
        score=None,
        skipped=True,
        conversation_history=[],
        questions_asked=0,
        status="complete",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


# ── Synthesise ──────────────────────────────────────────────────────────────────

@router.post("/{decision_id}/synthesise", response_model=DecisionOut)
def synthesise(decision_id: str, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Get the most recent completed run per agent
    runs = (
        db.query(AgentRun)
        .filter(AgentRun.decision_id == decision_id, AgentRun.skipped == False)
        .order_by(AgentRun.created_at.desc())
        .all()
    )

    run_map: dict[str, str] = {}
    for r in runs:
        if r.agent_name not in run_map:
            # Build a readable transcript from the conversation history
            if r.conversation_history:
                transcript = _build_transcript(r.conversation_history)
            else:
                transcript = r.response or "[not run]"
            run_map[r.agent_name] = transcript

    memo = run_synthesis(
        thesis=decision.thesis,
        ticker=decision.ticker or "",
        decision_type=decision.decision_type,
        price_transcript=run_map.get("price", "[not run]"),
        ruin_transcript=run_map.get("ruin", "[not run]"),
        imitation_transcript=run_map.get("imitation", "[not run]"),
        confirmation_transcript=run_map.get("confirmation", "[not run]"),
        ego_transcript=run_map.get("ego", "[not run]"),
    )

    decision.synthesis_memo = memo
    decision.recommendation  = memo.get("recommendation")
    decision.status          = "complete"
    db.commit()
    db.refresh(decision)
    return decision


def _build_transcript(history: list[dict]) -> str:
    """Convert conversation history to a readable transcript for synthesis."""
    lines = []
    for msg in history:
        role = "Investor" if msg["role"] == "user" else "Agent"
        lines.append(f"{role}: {msg['content']}")
    return "\n\n".join(lines)


# ── Outcome update ──────────────────────────────────────────────────────────────

@router.patch("/{decision_id}/outcome", response_model=DecisionOut)
def update_outcome(decision_id: str, payload: OutcomeUpdate, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    decision.outcome           = payload.outcome
    decision.outcome_rating    = payload.outcome_rating
    decision.outcome_notes     = payload.outcome_notes
    decision.outcome_updated_at = now_utc()
    db.commit()
    db.refresh(decision)
    return decision


# ── Research Questions ─────────────────────────────────────────────────────────

@router.post("/{decision_id}/research-questions")
def get_research_questions(decision_id: str, db: Session = Depends(get_db)):
    """Generate a further-research questionnaire from the synthesis memo and transcripts."""
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    if not decision.synthesis_memo:
        raise HTTPException(status_code=400, detail="Run synthesis first before generating research questions.")

    runs = (
        db.query(AgentRun)
        .filter(AgentRun.decision_id == decision_id, AgentRun.skipped == False)
        .order_by(AgentRun.created_at.desc())
        .all()
    )
    run_map: dict[str, str] = {}
    for r in runs:
        if r.agent_name not in run_map:
            run_map[r.agent_name] = (
                _build_transcript(r.conversation_history)
                if r.conversation_history
                else (r.response or "")
            )

    questions = generate_research_questions(
        thesis=decision.thesis,
        ticker=decision.ticker or "",
        decision_type=decision.decision_type,
        synthesis_memo=decision.synthesis_memo,
        price_transcript=run_map.get("price", ""),
        ruin_transcript=run_map.get("ruin", ""),
        imitation_transcript=run_map.get("imitation", ""),
        confirmation_transcript=run_map.get("confirmation", ""),
        ego_transcript=run_map.get("ego", ""),
    )
    return questions


# -- Agent run history --

@router.get("/{decision_id}/agent-runs", response_model=list[AgentRunOut])
def get_agent_runs(decision_id: str, db: Session = Depends(get_db)):
    return (
        db.query(AgentRun)
        .filter(AgentRun.decision_id == decision_id)
        .order_by(AgentRun.created_at.asc())
        .all()
    )
