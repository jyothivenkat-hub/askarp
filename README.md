# Askarp

**A test-only persona engine for asking questions, simulating characters, and trying lightweight concept tests.**

Askarp is an avatar-first prototype for building source-grounded personas. A persona can represent an expert, creator, teacher, customer segment, consumer profile, or research participant pattern. You add source material, define the character surface, and ask questions through a simple speaking avatar interface.

[Live demo](https://askarp.vercel.app)

<img src="assets/andrej-pixel-pet.png" alt="Askarp pixel avatar" width="180">

## Status

This repository is a **test-only prototype**. It does not include personal API keys, production credentials, or a production data store. Anyone running or deploying it must add their own API keys through local environment variables or their hosting provider.

The current demo character is **Askarp**, a Karpathy-inspired learning companion grounded in public Andrej Karpathy materials. The broader application is a reusable persona system for learning, profile simulation, and early concept testing.

## Why This Exists

Most chatbots feel generic. Askarp explores a more character-based interface: a persona with an avatar, a knowledge base, and a response style.

Possible applications:

- Expert personas for learning and research.
- Consumer profiles for concept testing.
- Buyer profiles for messaging and positioning tests.
- Interview synthesis from user research notes.
- Internal training characters.
- Critique personas for product ideas.
- Creator or public-thinker companions built from public sources.

## Persona Model

Each persona has three layers:

1. **Character**
   The avatar, name, tone, and interaction style.

2. **Knowledge**
   The source base: transcripts, articles, research notes, survey responses, support tickets, or interview excerpts.

3. **Answer Behavior**
   The response rules: concise, skeptical, beginner-friendly, buyer-like, expert-like, first-principles, critical, or exploratory.

## What It Does Today

- Uses a pixel-pet avatar instead of a standard chat log.
- Answers through speech bubbles, optional browser voice, and source references.
- Lets users add public article links and YouTube links as knowledge sources.
- Breaks source text into browser-side retrieval chunks.
- Supports Simple, Code, Deep, and Quiz response modes.
- Falls back to local/browser retrieval when hosted model keys are not configured.

## Bring Your Own Keys

No real keys should be committed to this repo.

Use `.env.example` as the template:

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
