from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, Decision, AgentRun, User
from schemas import BiasProfile
from routes.auth import get_current_user

router = APIRouter(prefix="/api/bias", tags=["bias"])

DIMENSION_LABELS = {
    "price":        "P · Price",
    "ruin":         "R · Ruin",
    "imitation":    "I · Imitation",
    "confirmation": "C · Confirmation",
    "ego":          "E · Ego",
}


@router.get("", response_model=BiasProfile)
def get_bias_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decisions = db.query(Decision).filter(Decision.user_id == current_user.id).all()
    total = len(decisions)

    if total == 0:
        return BiasProfile(
            total_decisions=0,
            avg_scores={k: None for k in DIMENSION_LABELS},
            weakest_dimension=None,
            skip_counts={k: 0 for k in DIMENSION_LABELS},
            emotional_regret_rate=None,
            imitation_rate=None,
            insights=["No decisions logged yet. Run a new session to start building your profile."],
        )

    # Average scores per dimension
    avg_scores = {}
    for dim in ["price", "ruin", "imitation", "confirmation", "ego"]:
        col = getattr(Decision, f"{dim}_score")
        row = db.query(func.avg(col)).filter(
            Decision.user_id == current_user.id,
            col != None,
        ).scalar()
        avg_scores[dim] = round(float(row), 1) if row is not None else None

    # Weakest dimension
    scored = {k: v for k, v in avg_scores.items() if v is not None}
    weakest = min(scored, key=scored.get) if scored else None

    # Skip counts (only this user's decisions)
    user_decision_ids = [d.id for d in decisions]
    skip_counts = {}
    for dim in DIMENSION_LABELS:
        count = (
            db.query(AgentRun)
            .filter(
                AgentRun.agent_name == dim,
                AgentRun.skipped == True,
                AgentRun.decision_id.in_(user_decision_ids),
            )
            .count()
        ) if user_decision_ids else 0
        skip_counts[dim] = count

    # Emotional regret rate
    high_emotion = [d for d in decisions if d.emotional_state and d.emotional_state >= 4 and d.outcome_rating is not None]
    if high_emotion:
        regrets = [d for d in high_emotion if d.outcome_rating <= 2]
        emotional_regret_rate = round(len(regrets) / len(high_emotion) * 100, 1)
    else:
        emotional_regret_rate = None

    # Imitation rate
    scored_imitation = [d for d in decisions if d.imitation_score is not None]
    if scored_imitation:
        imitation_rate = round(
            len([d for d in scored_imitation if d.imitation_score < 5]) / len(scored_imitation) * 100, 1
        )
    else:
        imitation_rate = None

    # Plain-language insights
    insights = []

    if weakest:
        insights.append(
            f"Your weakest PRICE dimension is **{DIMENSION_LABELS[weakest]}** "
            f"(avg {avg_scores[weakest]}/10). This is where your decisions carry the most risk."
        )

    most_skipped = max(skip_counts, key=skip_counts.get) if any(skip_counts.values()) else None
    if most_skipped and skip_counts[most_skipped] > 0:
        insights.append(
            f"You most often skip the **{DIMENSION_LABELS[most_skipped]}** agent "
            f"({skip_counts[most_skipped]} time{'s' if skip_counts[most_skipped] > 1 else ''}). "
            f"Avoidance of this check may indicate a blind spot."
        )

    if emotional_regret_rate is not None:
        if emotional_regret_rate > 50:
            insights.append(
                f"**{emotional_regret_rate}%** of your high-emotion decisions were later rated as poor outcomes. "
                f"Elevated emotional state at decision time is a strong warning signal for you."
            )
        else:
            insights.append(
                f"Only **{emotional_regret_rate}%** of your high-emotion decisions resulted in poor outcomes. "
                f"You appear to manage emotional pressure reasonably well."
            )

    if imitation_rate is not None and imitation_rate > 40:
        insights.append(
            f"**{imitation_rate}%** of your decisions show signs of mimetic influence (Imitation score < 5). "
            f"Consider whether your ideas are truly independent."
        )

    recs = [d.recommendation for d in decisions if d.recommendation]
    if recs:
        reconsider_pct = round(recs.count("reconsider") / len(recs) * 100)
        if reconsider_pct > 30:
            insights.append(
                f"**{reconsider_pct}%** of your sessions ended with a Reconsider recommendation. "
                f"Emotional bias appears to be regularly influencing your decision-making."
            )

    if not insights:
        insights.append(
            f"You have logged {total} decision{'s' if total > 1 else ''}. "
            f"Keep going — your bias fingerprint sharpens significantly after 10 sessions."
        )

    return BiasProfile(
        total_decisions=total,
        avg_scores=avg_scores,
        weakest_dimension=weakest,
        skip_counts=skip_counts,
        emotional_regret_rate=emotional_regret_rate,
        imitation_rate=imitation_rate,
        insights=insights,
    )
