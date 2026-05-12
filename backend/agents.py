"""
Five specialist agents + synthesis layer for PRICE-Guard.
Each agent runs a multi-turn interrogation loop, asking follow-up questions
until it has enough information to make a sound judgment.
"""

import os
import json
import re
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

MODEL = "llama-3.3-70b-versatile"
MAX_FOLLOW_UPS = 2   # max questions before agent is forced to conclude


# ── Low-level helpers ──────────────────────────────────────────────────────────

def _chat_with_history(system: str, messages: list[dict], temperature: float = 0.7) -> str:
    """Call Groq with a full conversation history."""
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}] + messages,
        temperature=temperature,
        max_tokens=900,
    )
    return completion.choices[0].message.content.strip()


def _extract_score(text: str) -> float | None:
    """Pull the first integer 0-10 from lines like 'Score: 7/10' or 'SCORE: 8'."""
    match = re.search(r"\b([0-9]|10)\s*/?\s*10\b", text)
    if match:
        return float(match.group(1))
    match = re.search(r"score[:\s]+([0-9]|10)\b", text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def _parse_agent_response(raw: str, force_complete: bool = False) -> dict:
    """
    Parse agent JSON response.
    Expected formats:
      {"status": "question", "content": "Your follow-up question"}
      {"status": "complete", "content": "Your full analysis. Score: X/10", "score": X}
    """
    cleaned = re.sub(r"```json\s*", "", raw)
    cleaned = re.sub(r"```\s*", "", cleaned).strip()

    try:
        result = json.loads(cleaned)
        status  = result.get("status", "complete")
        content = result.get("content", raw)
        score   = result.get("score")
        if score is not None:
            score = float(score)
        else:
            score = _extract_score(content)

        # If we're forcing a conclusion but agent still asks, override
        if force_complete and status == "question":
            status = "complete"

        return {"status": status, "content": content, "score": score}

    except (json.JSONDecodeError, ValueError):
        # Graceful fallback: treat as completion
        return {
            "status": "complete",
            "content": raw,
            "score": _extract_score(raw),
        }


# ── Multi-turn instruction suffix (appended to every agent system prompt) ──────

MULTI_TURN_SUFFIX = """

══ INTERROGATION LOOP INSTRUCTIONS ══

You are conducting a structured multi-turn interrogation. You may ask up to {max_turns} targeted follow-up questions before you must conclude with your final judgment.

ALWAYS respond with a single valid JSON object — no other text, no markdown fences:

► To ask a follow-up question:
{{"status": "question", "content": "Your single, precise follow-up question here"}}

► To deliver your final analysis (when satisfied OR when you have used all {max_turns} questions):
{{"status": "complete", "content": "Your full analysis here.\\n\\nScore: X/10", "score": X}}

Follow-up question rules:
- Ask ONE question per turn. Make it the most important unanswered question.
- Each question must probe a specific gap, evasion, inconsistency, or weak assumption you detected in what the investor has said so far.
- Do NOT ask generic questions ("Can you tell me more?"). Be precise and pointed.
- Do NOT repeat a line of questioning you have already pursued.
- If the investor's answer is evasive or incomplete, press on it directly.

Conclusion rules:
- When you conclude, write a comprehensive analysis that synthesises everything from the full conversation, not just the initial thesis.
- Your score should reflect the quality of the decision based on ALL information gathered across the conversation.
- End your content with "Score: X/10" where X is an integer from 0 to 10.

Output ONLY the JSON object. Nothing before or after it.
"""


# ── Agent system prompts ───────────────────────────────────────────────────────

PRICE_SYSTEM = """You are the Price Signal Separator — Agent P in the PRICE-Guard investment decision framework.

Your only job: help the investor distinguish between reacting to price movements versus responding to genuine changes in business fundamentals.

What you probe for:
- The investor is reacting to a price move rather than a business change
- Vague or hand-wavy references to "fundamentals" that don't hold up to scrutiny
- Inconsistency between the stated reason and the timing of the decision
- What specifically changed in earnings, competitive position, management, balance sheet, or addressable market

Be clinical. Not unkind, but direct. No flattery. Start by identifying the single most suspicious aspect of the investor's reasoning, then begin the conversation."""

RUIN_SYSTEM = """You are the Ruin Risk Assessor — Agent R in the PRICE-Guard investment decision framework.

Your only job: run the pre-mortem the investor keeps deferring. Force them to confront specific, plausible failure scenarios.

What you probe for:
- The investor has not thought carefully about downside scenarios
- Failure scenarios they are dismissing as "unlikely" without real analysis
- Risks that could impair capital, temperament, credibility, or staying power
- The single most dangerous assumption hiding inside the thesis
- Whether the investor can actually survive the worst plausible case

Do not soften. Do not hedge. Start with the most dangerous failure scenario you can identify and press them on it."""

IMITATION_SYSTEM = """You are the Independence Verifier — Agent I in the PRICE-Guard investment decision framework.

Your only job: detect mimetic pressure — decisions driven by following others rather than genuine independent analysis.

What you probe for:
- FOMO, social proof, or excitement driven by what other investors are doing
- Borrowed conviction: repeating someone else's thesis without internalising it
- Inability to state the thesis without referencing another investor, newsletter, or analyst
- The difference between "I researched this" and "I read about this and agreed"
- Whether the investor would have reached the same conclusion independently

Start by finding the most telling sign of imitation in the investor's stated thesis, then press on where the idea really came from."""

CONFIRMATION_SYSTEM = """You are the Confirmation Challenger — Agent C in the PRICE-Guard investment decision framework.

You ONLY argue the bear case. This is your defining constraint.

What you do:
- Take every pillar of the investor's thesis and find its strongest counter-argument
- Surface the disconfirming evidence the investor is most likely ignoring
- Ask the single most uncomfortable question the investor has not asked themselves
- Never validate. Never say "that's a fair point." Never soften at the end.
- If the investor pushes back, press harder — not by repeating yourself, but by finding a new angle of attack
- The investor must genuinely engage with the counter-case to satisfy you

Start with the single weakest link in the investor's thesis and attack it directly."""

EGO_SYSTEM = """You are the Ego & Inertia Probe — Agent E in the PRICE-Guard investment decision framework.

Your only job: detect when an investor is acting — or failing to act — due to ego, identity attachment, overconfidence, or irrational conviction rather than sound analysis.

Adapt your focus to the decision type:

For HOLD or SELL decisions — probe holding inertia and sunk-cost:
- The investor is holding because selling means admitting a mistake
- Over-attachment to prior research ("I spent months on this")
- Escalation of commitment: adding to a losing position to average down
- The gap between stated conviction and revealed reluctance to face being wrong
- Key test: "If you didn't already own this, would you buy it today at this price?"

For BUY decisions — probe overconfidence and ego-driven conviction:
- Overconfidence in their edge or information advantage
- Identity attachment to a particular thesis, sector, or investing style
- Anchoring to a price target or entry point without re-examining the thesis
- The investor is buying to prove a prior view right, not because the opportunity is genuinely compelling
- Whether they have stress-tested the thesis or simply fallen in love with the narrative

Start by identifying the most likely source of ego, overconfidence, or identity attachment in their stated reasoning."""


AGENT_SYSTEMS = {
    "price":        PRICE_SYSTEM,
    "ruin":         RUIN_SYSTEM,
    "imitation":    IMITATION_SYSTEM,
    "confirmation": CONFIRMATION_SYSTEM,
    "ego":          EGO_SYSTEM,
}


# ── Core conversation function ─────────────────────────────────────────────────

def converse_agent(
    agent_name: str,
    history: list[dict],      # [{role: "user"|"assistant", content: str}]
    thesis: str,
    ticker: str,
    decision_type: str,
    questions_asked: int,
    max_turns: int = MAX_FOLLOW_UPS,
) -> dict:
    """
    Run one turn of an agent's multi-turn interrogation.

    - history: the conversation so far (empty on first call)
    - questions_asked: how many follow-up questions the agent has already asked
    - Returns: {"status": "question"|"complete", "content": str, "score": float|None}
    """
    if agent_name not in AGENT_SYSTEMS:
        raise ValueError(f"Unknown agent: {agent_name}")

    force_complete = questions_asked >= max_turns

    suffix = MULTI_TURN_SUFFIX.format(max_turns=max_turns)
    if force_complete:
        suffix += (
            "\n\nYou have now asked the maximum number of follow-up questions. "
            "You MUST conclude with status 'complete' in this response."
        )

    system = AGENT_SYSTEMS[agent_name] + suffix

    if not history:
        # First turn — seed the conversation with the investor's thesis
        initial = (
            f"Ticker: {ticker or 'N/A'}\n"
            f"Decision type: {decision_type}\n"
            f"Investor's thesis: {thesis}\n\n"
            f"Begin your conversation."
        )
        messages = [{"role": "user", "content": initial}]
    else:
        messages = history

    raw = _chat_with_history(system, messages, temperature=0.75)
    return _parse_agent_response(raw, force_complete=force_complete)


# ── Synthesis layer (unchanged, single-shot) ───────────────────────────────────

SYNTHESIS_SYSTEM = """You are the Synthesis agent for PRICE-Guard. You have received the full interrogation transcripts from all five PRICE agents.

Produce a structured Decision Memo in the following exact JSON format (no markdown, pure JSON):

{
  "reflective_mind": "2-3 sentence summary of what rational analysis concluded across the five agents",
  "emotional_patterns": "2-3 sentence summary of emotional patterns detected (price-chasing, imitation, ego, etc.)",
  "price_summary": "1 sentence",
  "ruin_summary": "1 sentence",
  "imitation_summary": "1 sentence",
  "confirmation_summary": "1 sentence",
  "ego_summary": "1 sentence",
  "key_risks": ["risk 1", "risk 2", "risk 3"],
  "recommendation": "proceed" | "pause" | "reconsider",
  "recommendation_rationale": "2-3 sentence explanation of the recommendation"
}

Rules:
- "proceed" = all five agents give relatively high scores and no major red flags
- "pause" = mixed signals; investor should gather more information or wait
- "reconsider" = strong evidence of emotional bias dominating the decision
- Synthesise the FULL conversation for each agent, not just the initial thesis
- Output ONLY the JSON object. No preamble, no markdown fences."""


def _chat(system: str, user: str, temperature: float = 0.3) -> str:
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=1024,
    )
    return completion.choices[0].message.content.strip()


def run_synthesis(
    thesis: str,
    ticker: str,
    decision_type: str,
    price_transcript: str,
    ruin_transcript: str,
    imitation_transcript: str,
    confirmation_transcript: str,
    ego_transcript: str,
) -> dict:
    user_msg = (
        f"Ticker: {ticker or 'N/A'}\n"
        f"Decision type: {decision_type}\n"
        f"Original thesis: {thesis}\n\n"
        f"--- Agent P (Price Signal Separator) ---\n{price_transcript}\n\n"
        f"--- Agent R (Ruin Risk Assessor) ---\n{ruin_transcript}\n\n"
        f"--- Agent I (Independence Verifier) ---\n{imitation_transcript}\n\n"
        f"--- Agent C (Confirmation Challenger) ---\n{confirmation_transcript}\n\n"
        f"--- Agent E (Ego & Inertia Probe) ---\n{ego_transcript}\n\n"
        f"Synthesise these interrogation transcripts into a Decision Memo JSON."
    )

    raw = _chat(SYNTHESIS_SYSTEM, user_msg)
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "reflective_mind": raw,
            "emotional_patterns": "",
            "price_summary": "", "ruin_summary": "", "imitation_summary": "",
            "confirmation_summary": "", "ego_summary": "",
            "key_risks": [],
            "recommendation": "pause",
            "recommendation_rationale": "Could not parse structured memo — review agent transcripts manually.",
        }


# ── Score field map (for updating Decision columns) ───────────────────────────

# ── Score field map (for updating Decision columns) ───────────────────────────

SCORE_FIELD_MAP = {
    "price":        "price_score",
    "ruin":         "ruin_score",
    "imitation":    "imitation_score",
    "confirmation": "confirmation_score",
    "ego":          "ego_score",
}


# ── Research Questions Generator ───────────────────────────────────────────────

RESEARCH_QUESTIONS_SYSTEM = """You are a financial research analyst generating a structured further-research questionnaire.

Based on the Invert analysis of an investment decision, generate specific actionable research questions the investor should answer before proceeding. Focus on the gaps, weaknesses, and unanswered concerns surfaced during the five-agent conversation.

Output ONLY valid JSON in this exact format — no markdown, no preamble:

{
  "priority_action": "The single most important thing to research first, in one sentence",
  "sections": [
    {
      "dimension": "P",
      "title": "Business Fundamentals",
      "concern": "The specific concern Agent P identified",
      "questions": [
        "Specific researchable question 1?",
        "Specific researchable question 2?",
        "Specific researchable question 3?"
      ]
    }
  ],
  "data_sources": [
    "Specific source 1 (e.g. Company 10-K / Annual Report)",
    "Specific source 2 (e.g. Competitor earnings calls)",
    "Specific source 3"
  ],
  "ai_prompt_suggestion": "A ready-to-use prompt the investor can paste into an AI research agent to investigate the most critical open question"
}

Rules:
- Include a section for each PRICE dimension that had a significant concern or low score
- Skip dimensions that were clearly satisfactory
- Questions must be specific enough to Google, search SEC filings, or ask an AI research agent
- Data sources should name actual document types or platforms, not vague suggestions
- The ai_prompt_suggestion should be a fully formed, specific prompt — not a description of one
- Output ONLY the JSON object"""


def generate_research_questions(
    thesis: str,
    ticker: str,
    decision_type: str,
    synthesis_memo: dict,
    price_transcript: str = "",
    ruin_transcript: str = "",
    imitation_transcript: str = "",
    confirmation_transcript: str = "",
    ego_transcript: str = "",
) -> dict:
    """Generate a structured research questionnaire from the synthesis memo and transcripts."""

    scores_summary = "\n".join([
        f"P (Price): {synthesis_memo.get('price_summary', 'N/A')}",
        f"R (Ruin): {synthesis_memo.get('ruin_summary', 'N/A')}",
        f"I (Imitation): {synthesis_memo.get('imitation_summary', 'N/A')}",
        f"C (Confirmation): {synthesis_memo.get('confirmation_summary', 'N/A')}",
        f"E (Ego): {synthesis_memo.get('ego_summary', 'N/A')}",
    ])

    user_msg = (
        f"Ticker: {ticker or 'N/A'}\n"
        f"Decision type: {decision_type}\n"
        f"Original thesis: {thesis}\n\n"
        f"Recommendation: {synthesis_memo.get('recommendation', 'N/A')}\n"
        f"Rationale: {synthesis_memo.get('recommendation_rationale', '')}\n\n"
        f"Emotional patterns detected: {synthesis_memo.get('emotional_patterns', '')}\n\n"
        f"Key risks: {', '.join(synthesis_memo.get('key_risks', []))}\n\n"
        f"Agent summaries:\n{scores_summary}\n\n"
        f"--- Agent P transcript ---\n{price_transcript or '[not run]'}\n\n"
        f"--- Agent R transcript ---\n{ruin_transcript or '[not run]'}\n\n"
        f"--- Agent I transcript ---\n{imitation_transcript or '[not run]'}\n\n"
        f"--- Agent C transcript ---\n{confirmation_transcript or '[not run]'}\n\n"
        f"--- Agent E transcript ---\n{ego_transcript or '[not run]'}\n\n"
        f"Generate the further-research questionnaire JSON."
    )

    raw = _chat(RESEARCH_QUESTIONS_SYSTEM, user_msg, temperature=0.4)
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "priority_action": "Review the full conversation transcripts and identify the most critical unanswered question.",
            "sections": [],
            "data_sources": ["Company Annual Report / 10-K", "Earnings call transcripts", "Competitor filings"],
            "ai_prompt_suggestion": f"Research the investment thesis for {ticker or 'this company'}: {thesis}. Identify the key risks and provide a bear case analysis.",
        }
