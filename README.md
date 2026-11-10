# CARAXES AI

A clean, responsive AI chat starter with a matte-black / antique-bronze interface.

## Included and working
- Responsive desktop and mobile layout
- Large readable chat area and full-width assistant responses
- New chat and local chat history (saved in this browser)
- Gemini text chat through a server-side API key
- TXT, MD, CSV, JSON and LOG file attachments (up to 300 KB)
- Browser voice input where supported
- Device text-to-speech
- Copy and read-aloud controls for assistant responses

## Not connected yet
Image generation, video generation, web search grounding, PDF/DOCX parsing and cloud-synced accounts require additional providers or services. The interface labels these honestly; it does not pretend these features work yet.

## Requirements
- Node.js 18 or newer
- A Gemini API key for AI chat

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `caraxes-ai` folder.
3. Set your API key as an environment variable. Do not put it in `public/` or share it:
   - macOS/Linux: `export GEMINI_API_KEY="YOUR_KEY"`
   - Windows PowerShell: `$env:GEMINI_API_KEY="YOUR_KEY"`
4. Run: `node server.js`
5. Open: `http://localhost:3000`

Optional:
- `PORT=3000`
- `HOST=0.0.0.0`
- `GEMINI_MODEL=gemini-2.5-flash`

## Deploy
Deploy the folder to a Node.js host such as Render:
- Build command: leave blank
- Start command: `node server.js`
- Add `GEMINI_API_KEY` in the host's private environment variables.
- Optional: add `GEMINI_MODEL` and `HOST=0.0.0.0`.
- Never commit `.env`, API keys, or secrets to GitHub.

## Notes
- Browser chat history stays in the same browser/device. It is not a user account or cloud sync.
- The text-file attachment is included in the prompt; avoid uploading private or sensitive files.
- Voice recognition availability depends on browser/device and microphone permission.
- Review provider pricing and terms before enabling paid image/video APIs.
