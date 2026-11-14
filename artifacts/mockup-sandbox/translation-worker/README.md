# Colony Frontier translation service

The game UI uses Google Cloud Translation through a Cloudflare Worker. The Google API key stays on the server and is never shipped to the browser.

## 1. Configure Google Cloud

1. Create or select a Google Cloud project.
2. Enable **Cloud Translation API** and configure billing.
3. Create an API key. Restrict it to the Cloud Translation API.

## 2. Deploy the Cloudflare Worker

From this directory:

```sh
npx wrangler secret put GOOGLE_TRANSLATE_API_KEY
npx wrangler deploy
```

Paste the Google API key when Wrangler prompts for it. Then edit `ALLOWED_ORIGIN` in `wrangler.toml` to the exact origin hosting Colony Frontier and deploy again.

## 3. Point the game at the Worker

Set the Vite environment variable `VITE_TRANSLATION_API_URL` to the deployed Worker URL plus `/` (for example, `https://colony-frontier-translation.example.workers.dev/`), or configure a same-origin `/api/translate` reverse proxy to the Worker.

For a local Vite environment, add that variable to `.env.local` in `artifacts/mockup-sandbox`, then restart the dev server.

## Included behaviour

- Language selector is available on every preview screen.
- Selected language is saved in local storage.
- Visible UI text, including dynamically appearing mission warnings and response options, is translated in batches.
- Repeated strings are cached locally to reduce API usage.
- English is the source language and is not sent to Google.

## Notes

Google Cloud Translation is a paid API after any applicable free allowance. The translation UI cannot contact Google until the Worker is deployed and its URL is configured. Technical identifiers, code samples, and some text embedded in images are intentionally not translated.
