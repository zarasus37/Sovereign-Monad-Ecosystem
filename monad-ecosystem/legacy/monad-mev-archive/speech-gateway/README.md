# speech-gateway

Azure Speech-backed gateway for:

- speech-to-text
- text-to-speech
- speech-aware reply handling

## Purpose

This package gives the workspace a clean speech I/O service instead of scattering speech logic across unrelated services.

The contract is simple:

- `POST /speech/transcribe`
- `POST /speech/synthesize`
- `POST /speech/respond`
- `POST /speech/assistant-turn`
- `GET /health`
- browser console at `/`

## Important constraint

`/speech/transcribe` expects base64-encoded WAV input. For the first pass, the service is intentionally strict so it stays reliable. Browser microphone capture may need client-side WAV conversion before upload.

The built-in browser console handles that conversion for you.

## Environment

Copy `.env.example` to `.env` and fill:

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- optional language / voice / format overrides
- optional assistant bridge values if you want automatic assistant calls:
  - `ASSISTANT_TEXT_ENDPOINT`
  - `ASSISTANT_TEXT_FIELD`
  - `ASSISTANT_RESPONSE_FIELD`

## Endpoints

### `GET /health`

Returns service health and whether Azure Speech credentials are configured.

### `POST /speech/transcribe`

Request:

```json
{
  "audioBase64": "<base64 wav>",
  "contentType": "audio/wav",
  "language": "en-US"
}
```

### `POST /speech/synthesize`

Request:

```json
{
  "text": "Hello from Sovereign Monad.",
  "voiceName": "en-US-JennyNeural"
}
```

### `POST /speech/respond`

Request:

```json
{
  "text": "Response text to read aloud.",
  "inputMode": "speech"
}
```

If `inputMode` is `speech`, the service returns synthesized audio. If `inputMode` is `text`, it returns `speak: false`.

### `POST /speech/assistant-turn`

This endpoint forwards user text to a configured assistant HTTP endpoint and then applies the same speech-aware reply logic:

- speech input -> assistant text response + spoken audio
- text input -> assistant text response only

Expected request:

```json
{
  "text": "User message",
  "inputMode": "speech"
}
```

## Browser console

Open:

```text
http://localhost:4030/
```

The console supports:

- microphone capture
- WAV conversion in the browser
- transcript display
- manual response text
- optional assistant bridge calls
- automatic spoken playback only when the last input mode was `speech`

This is the intended first-pass behavior for your stated goal:

- speech in -> spoken reply out
- text in -> no forced spoken reply

## Run

```powershell
cmd /c npm install
cmd /c npm run build
cmd /c npm start
```
