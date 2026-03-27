# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A standalone vanilla JavaScript web application for laboratory equipment control and data analysis. It communicates with Arduino/hardware devices via the Web Serial API to run voltage sweep and time-series measurements, visualizes results in real-time with Chart.js, and persists data to a remote REST API.

## Running the App

No build step — serve the files directly via any static file server:

```bash
# e.g., using Python
python3 -m http.server 8080

# or VS Code Live Server extension
```

To use the local backend instead of production, edit `index.html` to load `config.local.js` instead of `config.prod.js`.

## Architecture

### File Structure

| File | Purpose |
|------|---------|
| `index.html` | Single-page entry point; loads Chart.js from CDN, imports `main.js` |
| `main.js` | App orchestration — event listeners, state, serial + API coordination |
| `SerialCommunication.js` | Web Serial API wrapper (baud: 115200, auto-reconnect via localStorage) |
| `GateAnalysis.js` | Bidirectional gate voltage sweep analysis class |
| `TimeAnalysis.js` | Time-series measurement class with baseline capture |
| `chartsConfig.js` | Chart.js config factories for gate and time charts |
| `utils.js` | Logging, response parsing, TSV file export |
| `config.prod.js` | `window.env.API_URL = "https://research-api.layerlogic.se"` |
| `config.local.js` | `window.env.API_URL = "http://localhost:5073"` |

### Data Flow

1. User authenticates (cookie-based: `ui_Auth_x`, `ui_user_id`)
2. `main.js` connects to hardware via `SerialCommunication` (Web Serial API)
3. User starts a Gate or Time analysis run — `main.js` instantiates `GateAnalysis` or `TimeAnalysis`
4. Analysis classes send serial commands to the device and collect measurements
5. Chart.js charts update in real-time via `chartsConfig.js` factories
6. On completion, data saves locally as TSV and/or POSTs to the REST API

### Serial Device Protocol

Commands sent to device:
- `s, <sample>` — select channel
- `ACgn, <voltage>` — get AC measurement at voltage
- `Vg, <voltage>` — set gate voltage
- `dt, <delay>` — set delay (ms)

Response format: `X[mV], Y[mV], I[uA], f[Hz]` → parsed into resistance values by `parseResponse()` in `utils.js`.

### API Integration

All endpoints are under `window.env.API_URL`:
- `POST /api/auth/login` — returns auth token stored in cookies
- `POST /api/researcher/trials/{trialId}/testsResearcherTestUi` — saves analysis results (gate or time)

Payload includes measurements, channel, analysis type, settings, notes, analysis run ID, and baseline data.

### Chart Configuration

Both chart types (gate and time) use dual Y-axes:
- Left axis: Channel 1 resistance (blue)
- Right axis: Channel 2 resistance (red)
- Plugins: zoom (wheel + pinch), annotations

### State Management

State lives in `main.js` as plain objects:
- `gateAnalysiss` — map of active gate analysis instances per channel
- `timeAnalysiss` — map of active time analysis instances per channel
- Channel selection: 4 hardcoded channels, toggled before running analysis

## Key Constraints

- **Browser requirement**: Web Serial API requires Chrome/Edge (not Firefox/Safari)
- **No bundler/transpiler**: ES6 module syntax only; no TypeScript, no npm
- **CDN dependencies**: Chart.js and plugins loaded from `jsdelivr.net` — no offline mode
- **Cookie auth**: Tokens set with `Secure; SameSite=None` — requires HTTPS in production
