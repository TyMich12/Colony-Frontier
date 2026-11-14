# Colony Frontier translation service

The game uses Google Cloud Translation through a Cloudflare Worker. The Google API key stays on the server and is never shipped to the browser.

## 1. Configure Google Cloud

1. Create or select a Google Cloud project.
2. Enable **Cloud Translation API (Basic v2)**.
3. Configure billing and check Google's current pricing/free allowance.
4. Create an API key and restrict it to the Cloud Translation API.

## 2. Deploy the Cloudflare Worker

From this directory:

```sh
npx wrangler secret put GOOGLE_TRANSLATE_API_KEY
npx wrangler deploy
```

Paste the Google API key when Wrangler prompts for it.

The included `wrangler.toml` allows local Vite origins at `localhost:5173` and `127.0.0.1:5173`. Before production, change `ALLOWED_ORIGINS` to the exact origin(s) hosting Colony Frontier, then deploy again. Do not use `*` for a public production deployment.

## 3. Point the game at the Worker

Create `.env.local` in the Vite project root (the folder containing `package.json`):

```env
VITE_TRANSLATION_API_URL=https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev
```

Do not put the Google API key in `.env.local` or any `VITE_` variable. Vite variables are exposed to the browser. Restart the Vite dev server after changing `.env.local`.

## Included behaviour

- The language picker searches Google's language list, loaded from the Cloud Translation API through the Worker.
- The selected language is saved in local storage.
- Visible UI text, including dynamically appearing mission warnings and response options, is translated.
- Text nodes are sent in batches of up to 40 strings to reduce request overhead.
- Repeated strings are cached in the browser to reduce API usage.
- English is the source language and is not sent to Google.

## Important

Google Cloud Translation is an online service and may incur charges after any applicable free allowance. Translation will not work until the Worker is deployed, its Google API key is configured, and `VITE_TRANSLATION_API_URL` is set. Technical identifiers, code samples, and some text embedded in images are intentionally not translated.
