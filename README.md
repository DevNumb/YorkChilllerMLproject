# Chiller Energy Optimizer

A production-oriented React dashboard for AI-powered chiller optimization.

## Features

- Live clock with Open-Meteo weather integration
- Wet bulb auto-suggestion with manual override
- Operator-friendly optimization form with presets
- API-backed recommendation workflow
- Efficiency gauge, savings metrics, and OptiView action guidance
- Local history with restore and clear actions
- CSV history export and print-to-PDF export
- Responsive industrial dark UI
- Messenger-style AI assistant with chat, charts, settings, and IndexedDB history

## API

Default optimizer endpoint:

`https://DevNumb-MLYorkchillerOptimzer.hf.space/optimize`

You can override endpoints with:

- `VITE_OPTIMIZER_URL`
- `VITE_WEATHER_URL`
- `VITE_ASSISTANT_API_URL`
- `VITE_ASSISTANT_MODEL`

## Run

```bash
npm install
npm run dev
```

## AI Assistant

Frontend assistant files live under `src/components/` and `src/services/`.

Use a local `.env`:

```bash
VITE_ASSISTANT_API_URL=/api/assistant
VITE_ASSISTANT_MODEL=openrouter/free
VITE_ASSISTANT_APP_URL=https://your-vercel-app.vercel.app
```

Set these in Vercel:

```bash
OPENROUTER_API_KEY=put-your-api-key-here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_APP_URL=https://your-vercel-app.vercel.app
OPENROUTER_APP_NAME=Chiller Energy Optimizer
```

The Vercel serverless route is [api/assistant.js](C:/Users/nahdi/Documents/Codex/2026-04-26-i-need-you-to-create-a/api/assistant.js:1).

## Build

```bash
npm run build
npm run preview
```
