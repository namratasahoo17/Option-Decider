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
    prompt = """Generate a SHORT, vivid, immersive, and slightly surreal or
    unusual scenario not repetitive or absurd (2-3 sentences).
    The scenario should not be poetic.
    Example: "You're standing in a dark alley and your hear footsteps behind you which you acn hear behind yiu inly when you're walking."
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
    The user was given this scenario: "{payload.scenario}"
    The user responded with: "{payload.user_text}"
    Their list of options was: {payload.choices}

    Pick exactly ONE option from their list that best fits their reaction.

    Then write a "vibe_summary" like a witty, slightly savage horoscope or
    meme caption — punchy, conversational, a little roasting, NOT clinical
    or academic. Avoid words like "aligns," "reflects," "subjective,"
    "narrative," or "underlying traits." Keep it to 1-2 short, quotable
    sentences that a person would actually want to screenshot and share.

    Example tone (don't copy, just match the energy):
    "You didn't hesitate for a second — {{winning_choice}} energy, no notes."


    Return a raw JSON object with these keys:
        1. "winning_choice": the exact item chosen from their list.
        2. "vibe_summary": a short, witty two-sentence explanation of why
           their reaction aligns with that choice.
        3. "color": a hex color code matching the energy of their reaction.
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