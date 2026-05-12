from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, Decision, JournalNote, new_id, User
from schemas import NoteCreate, NoteOut, DecisionOut
from routes.auth import get_current_user

router = APIRouter(prefix="/api/journal", tags=["journal"])


@router.get("", response_model=list[DecisionOut])
def get_journal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Decision)
        .filter(Decision.user_id == current_user.id)
        .order_by(Decision.created_at.desc())
        .all()
    )


@router.get("/{decision_id}/notes", response_model=list[NoteOut])
def get_notes(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return (
        db.query(JournalNote)
        .filter(JournalNote.decision_id == decision_id)
        .order_by(JournalNote.created_at.asc())
        .all()
    )


@router.post("/{decision_id}/notes", response_model=NoteOut)
def add_note(
    decision_id: str,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    note = JournalNote(id=new_id(), decision_id=decision_id, note=payload.note)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{decision_id}/notes/{note_id}")
def delete_note(
    decision_id: str,
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(status_code=403, detail="Not authorised")
    note = db.query(JournalNote).filter(
        JournalNote.id == note_id,
        JournalNote.decision_id == decision_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}
