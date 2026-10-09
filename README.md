# Option Decider

Can't pick between a few options? Type them in as floating bubbles, get dropped into a short AI-written scenario, say how you'd react, and let the AI pick the option that matches your vibe. The page then shifts to a color the AI chooses to match your energy.

Built with plain HTML/CSS/JavaScript on the front end and a FastAPI backend that calls the Google Gemini API.

<!-- Add a screenshot or short GIF here, e.g. ![Demo](docs/demo.gif) -->

## How it works

1. **Add options.** Type up to 6 options and press Enter. Each one appears as a glassy bubble that floats around the screen, bounces off the window edges, and bounces off the other bubbles. Click the × on a bubble to remove it.
2. **Generate a scene.** The bubbles spiral into the center, and the backend asks Gemini for a short scenario with one unsettling detail.
3. **React.** The scenario appears in a floating cloud. You write what you'd feel or do in a second cloud.
4. **Get your result.** Gemini reads your reaction, picks the option that best fits it, writes a short witty explanation, and returns a hex color that tints the result card.
5. **Start over** to go back to your options without retyping them.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Backend | Python, FastAPI, Uvicorn |
| AI | Google Gemini (`gemini-2.5-flash`) through the `google-genai` SDK |

The bubble motion is a small physics loop written in JavaScript (`requestAnimationFrame`), with wall bounces and circle-to-circle collisions. The swirl-away animation uses the Web Animations API.

## Project structure

```
.
├── index.html      # page structure (3 steps: options, scenario, result)
├── style.css       # styling and animations
├── script.js       # bubble physics, step flow, API calls
├── main.py         # FastAPI backend + Gemini prompts
├── requirements.txt
├── .env            # your API key (not committed)
└── .gitignore
```

## Getting started

### Prerequisites

- Python 3.10 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/namratasahoo17/option-decider.git
cd option-decider

# 2. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# 3. Install dependencies
pip install -r requirements.txt
```

Create a file named `.env` next to `main.py`:

```
GEMINI_API_KEY=your_key_here
```

### Run it

```bash
uvicorn main:app --reload --port 8000
```

Leave that terminal open, then open `index.html` in your browser. The page talks to the backend at `http://127.0.0.1:8000`.

## API

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| GET | `/` | none | `{"status": "API is running!"}` |
| POST | `/generate-scenario` | `{"choices": ["a", "b"]}` | `{"scenario": "..."}` |
| POST | `/analyze-response` | `{"choices": [...], "scenario": "...", "user_text": "..."}` | `{"winning_choice": "...", "vibe_summary": "...", "color": "#hex"}` |

## Known limitations

- The AI's pick is a judgment call from a short reaction, so it can feel off when options are single words with little meaning behind them. Descriptive options give better results.
- The backend has to be running locally, because the API address is hard-coded in `script.js` (`API_URL`).
- It makes two Gemini calls per round, so it depends on your API quota and connection.

## Ideas for next steps

- Deploy the backend so the app works without running anything locally
- Move `API_URL` into a config value
- Add a "share my result" card

## Security note

Never commit your `.env` file or your API key. The included `.gitignore` excludes `.env` and `venv/`.

## License

Add a license of your choice (for example MIT) as a `LICENSE` file.
