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

## API

Default optimizer endpoint:

`https://DevNumb-MLYorkchillerOptimzer.hf.space/optimize`

You can override endpoints with:

- `VITE_OPTIMIZER_URL`
- `VITE_WEATHER_URL`

## Run

```bash
npm install
npm run dev
```

## AI Assistant

The assistant UI is isolated under `src/features/assistant/`.

Set frontend env values in a local `.env` file:

```bash
VITE_ASSISTANT_API_URL=http://localhost:8787/api/assistant
```

Set backend proxy env values before starting the proxy:

```bash
OPENAI_API_KEY=put-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

Run the proxy:

```bash
npm run assistant:proxy
```

## Build

```bash
npm run build
npm run preview
```
