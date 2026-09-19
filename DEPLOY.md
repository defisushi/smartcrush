# Deploying Smartcrush

## Architecture

```
Browser  →  /api/nansen/*  →  Vercel Serverless Function  →  api.nansen.ai
                                    ↑
                              NANSEN_API_KEY
                           (Vercel env variable)
```

The frontend never sees the API key. The Vercel function at `api/nansen/[...path].ts` injects it server-side on every request.

## Steps

### 1. Push to GitHub

```bash
cd "Nansen Smart Money"
git init
git add .
git commit -m "Smartcrush v1"
git remote add origin git@github.com:YOUR_USERNAME/smart-crush.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel auto-detects Vite — accept the defaults
4. **Before deploying**, add your environment variable:
   - Name: `NANSEN_API_KEY`
   - Value: your Nansen API key
   - Environment: Production (and Preview if you want staging deploys to work)
5. Click **Deploy**

Every push to `main` auto-deploys from here.

### 3. Local development

For local dev with the Vite proxy (same architecture, just local):

```bash
mkdir -p backend
echo "NANSEN_API_KEY=your_key_here" > backend/.env
npm install
npm run dev
```

The Vite dev server proxies `/api/nansen/*` to Nansen using the key from `backend/.env`. This file is gitignored.

## How the proxy works

- User enters their own key in the app → sent as `apikey` header → proxy forwards it to Nansen
- User clicks "Use project API key" → no header sent → proxy injects `NANSEN_API_KEY` from env
- Rate limit (`Retry-After`) headers are forwarded back to the client so retry logic works

## Notes

- Vercel free tier: 10s function timeout, 100GB bandwidth/month — plenty for personal use
- The `vercel.json` SPA rewrite ensures direct URL access works
- `@vercel/node` is a devDependency for TypeScript types only — Vercel provides the runtime
