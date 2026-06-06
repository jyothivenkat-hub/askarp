# Askarp

**A public, test-only persona engine for source-grounded characters, learning companions, consumer profiles, and lightweight concept testing.**

Askarp is an avatar-first prototype for building interactive personas from source material. A persona can be used to learn a topic, ask questions, explore how a profile might react to an idea, or run early concept-testing conversations.

The current demo is a Karpathy-inspired learning companion grounded in public Andrej Karpathy materials. It is not Andrej Karpathy, does not impersonate him, and should not be treated as speaking on his behalf.

[Live demo](https://askarp.vercel.app)

<img src="assets/andrej-pixel-pet.png" alt="Askarp pixel avatar" width="180">

## What Is Askarp?

Askarp is a simple persona system with three layers:

**Character Layer**  
The visible persona: name, avatar, tone, and interaction style.

**Knowledge Layer**  
The source base: public articles, transcripts, videos, notes, interviews, research docs, support tickets, or other uploaded material.

**Answer Layer**  
The response behavior: beginner-friendly, critical, concise, first-principles, buyer-like, expert-like, skeptical, or quiz-based.

Together, these layers create a source-grounded character that users can talk to in plain language.

## Why This Exists

Most AI chat interfaces feel generic. Askarp explores a more specific interface: a character built from a defined source base, with a clear role, voice, and behavior.

The goal is not open-ended roleplay. The goal is to make personas useful for:

- Learning from public thinkers, creators, or experts.
- Asking questions against a source-grounded profile.
- Creating lightweight research or customer personas.
- Testing early product ideas, messaging, and concepts.
- Exploring how different profiles might react to tradeoffs.
- Turning research notes or public material into interactive conversations.

## Current Demo

The first test persona is Askarp, a Karpathy-inspired technical learning companion.

It uses public source material to answer questions, explain ideas from first principles, and support different learning modes.

This is a prototype and test version only.

## Possible Use Cases

- Learning companions based on public source material.
- Expert-style personas for education or internal training.
- Customer profiles for early concept testing.
- Buyer personas for messaging exploration.
- Research personas from interviews, notes, or surveys.
- Critique personas for product, strategy, or positioning work.
- Interactive synthesis from qualitative research material.

## What It Does Today

- Uses a pixel-pet avatar instead of a standard chatbot interface.
- Lets users ask questions through a character-based UI.
- Supports public articles and YouTube links as source material.
- Breaks source text into chunks for retrieval.
- Answers in text with optional browser voice.
- Supports Simple, Code, Deep, and Quiz response modes.
- Falls back to local/browser retrieval when hosted model keys are not configured.

## API Access

Hosted AI features require API access.

You can either:

- Bring your own API keys and run the test version yourself.
- Ask me for access to try the hosted version.

This project is experimental and intended for testing, learning, and lightweight research exploration. It is not a replacement for validated research with real users.

No real keys should be committed to this repo. Use `.env.example` as the template:

```bash
cp .env.example .env
```

Then fill in your own values:

```text
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=800
YOUTUBE_INNERTUBE_API_KEY=
```

For Vercel, add the same values in the project environment variable settings. Keep `.env` files local; they are ignored by Git.

## Run Locally

```bash
./start.sh
```

Manual start:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

Open:

```text
http://127.0.0.1:8001
```

The server tries ports `8001` through `8005` if the default port is busy.

## Adding Sources

Paste a public article URL or YouTube watch/shorts/live/embed/`youtu.be` link into the source box and click **Compile**.

Local YouTube ingestion uses `youtube-transcript-api` first, then falls back to public caption tracks when available. Article ingestion uses a lightweight HTML text extractor.

Limitations:

- YouTube links only work when captions/transcripts are exposed.
- YouTube may block hosted server requests from datacenter IPs, including Vercel.
- Hosted transcript extraction may require a managed transcript provider or user-supplied provider key.
- Some article pages block extraction or do not expose enough readable text.
- User-added sources are currently stored in browser local storage.

## Deploy

The repo includes Vercel-compatible static assets and serverless API routes in `api/`.

```bash
npx vercel --prod
```

Production demo:

```text
https://askarp.vercel.app
```

The deployed demo is for testing only. Model-backed answers require the deployer to configure their own `ANTHROPIC_API_KEY`. Transcript extraction is host-sensitive and may fail without a provider path.

## Project Structure

```text
api/                 Vercel serverless routes
assets/              Avatar and UI art
data/sources.js      Starter public-source notes
scripts/             Utility and smoke-check scripts
index.html           App shell
script.js            App logic, retrieval, voice, source ingestion
server.py            Local development server and local extraction proxy
styles.css           UI styling
```

## Safety Boundary

Askarp is not Andrej Karpathy and should not claim to be him. It is an educational demo grounded in public materials. Any future personas should be labeled clearly, grounded in permitted source material, and avoid impersonation or voice cloning.

For consumer-profile or concept-testing personas, avoid uploading sensitive personal data unless the deployment has proper access controls, consent, and data handling in place.

## Production Direction

- Add a persona builder for multiple characters/profiles.
- Store sources, chunks, and persona configs in a real backend.
- Add embeddings with Supabase `pgvector`, Qdrant, or Chroma.
- Preserve citations and video timestamps for source-grounded answers.
- Add a managed transcript provider or explicit transcript upload flow.
- Add project-level access controls before using private research data.
