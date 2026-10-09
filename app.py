import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables (expects GEMINI_API_KEY in a .env file next to this script)
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Choose From Options API")

# NOTE: allow_credentials must be False when allow_origins is "*" — browsers
# reject the combination of wildcard origin + credentials. We don't need
# cookies/auth headers here, so this is the correct fix (not narrowing origins).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini client
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_KEY)


# ---- Data models --------------------------------------------------------

class Options(BaseModel):
    choices: list[str]


class UserAnswer(BaseModel):
    choices: list[str]
    scenario: str
    user_text: str


# ---- Routes ---------------------------------------------------------------

@app.get("/")
def home():
    return {"status": "API is running!"}


@app.post("/generate-scenario")
def generate_scenario():
    prompt = f"""Generate a SHORT, vivid scenario (2-3 sentences) set in a believable,
everyday place, with ONE unsettling or mysterious detail that forces the
reader to decide how to react. Avoid random surreal imagery (like
strangers dressed identically or odd food). Keep it plain, not poetic.

Loosely hint at themes from these options without naming them directly
or asking the reader to choose between them: {options_str}.

Return ONLY a raw JSON object with a single key: "scenario"."""

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return json.loads(response.text)
    except Exception as e:
        print("ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-response")
def analyze_response(payload: UserAnswer):
    """Analyzes the user's reaction and picks the option that best fits their vibe."""
    prompt = f"""
    Scenario: "{payload.scenario}"
    The user's reaction: "{payload.user_text}"
    Their options: {payload.choices}

    Step 1: Work out what the REACTION shows about the person (for example:
    curious vs cautious, impulsive vs calculated, emotional vs logical,
    aggressive vs avoidant).

    Step 2: For each option, think about what it actually stands for: its
    core traits and the kind of person who gravitates to it. Pick the ONE
    option whose real traits best match the reaction. Do NOT pick based on
    loose word association with the scenario's setting or objects.

    Step 3: Write "vibe_summary": 1-2 punchy, witty sentences that name the
    specific trait from the reaction that matches the option's trait. The
    joke must not contradict the choice.

    Return a raw JSON object with these keys IN THIS ORDER:
        1. "reasoning": one sentence on which trait links the reaction to the option.
        2. "winning_choice": the exact item from the list, copied character for character.
        3. "vibe_summary": the witty line.
        4. "color": a hex color code matching the energy of the reaction.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))