# Lockbox

Private file storage on AWS S3. You sign in with an email and password or with Google, upload files straight to S3, and each file gets AI-written tags and a one-line summary so you can search by what's inside.

Built with Next.js (App Router), TypeScript, Tailwind CSS, NextAuth, the AWS SDK v3 and the Gemini API.

## How it works

```
Browser ──(1) ask for upload link──▶ /api/upload ──▶ checks session, signs a 5-minute S3 URL
   │                                                       
   └──(2) PUT the file directly ───────────────────────▶ S3  users/<google-id>/<id>__<name>
   │
   └──(3) /api/analyze ──▶ reads file from S3 ──▶ Gemini ──▶ tags + summary saved to users/<id>/.index.json
```

- **Ask your vault:** the chat panel sends your question to `/api/ask`. The server loads only *your* file list (names, tags, summaries, never S3 keys or file contents) and asks Gemini to answer from that list. The file ids Gemini returns are checked against the real list before anything is shown. With no Gemini key, or if the AI call fails, it falls back to a keyword search and labels the answer "Keyword match, not AI".
- **Stars and share links:** stars are saved in the same per-user index file. A share link is a presigned S3 URL that works for 1 hour, 1 day or 7 days (the server only accepts those three values). Anyone who holds the link can open that one file until it expires, so treat it like a password. When the app runs on AWS with an IAM role instead of access keys, a link can't outlive the role's temporary credentials, so it may expire sooner than chosen.
- **Dashboard summary:** storage used, a file-type bar and the share of AI-tagged files are all computed in the browser from the file list. Chart colours were checked for colour-blind separation and contrast in both themes.
- **Preview, multi-select and shortcuts:** click an image or PDF name to preview it in a pop-up (arrow keys move between files, Esc closes). Tick several files to delete them together. Press `/` to jump to search. Files can be dropped anywhere on the page.
- **Grid and list views:** files show as cards by default (picture thumbnails for images up to 6 MB, a coloured tile with the AI summary for everything else), with a list view one click away. Picture links come from `/api/thumbs`, which only signs images inside your own folder and expire after 15 minutes (the page renews them).
- **Light and dark theme:** colours are CSS variables in `app/globals.css`; the toggle sets `data-theme` on `<html>` and remembers the choice in the browser.
- **Files never pass through the server.** The server only hands out short-lived presigned URLs, so uploads stay fast and cheap.
- **Two ways to sign in:** Google, or an email and password. Password accounts are stored in the same bucket (`users/_accounts/<sha256 of email>.json`). The password itself is never saved, only a salted `scrypt` hash. Five wrong tries lock that email for 15 minutes, and sign-ups are limited to 10 an hour per connection. These counters live in server memory, so they slow guessing down but are not a guarantee on serverless hosts.
- **Every API route checks the session on the server** (`lib/auth.ts`). The browser never tells the server who it is.
- **Every file key is checked against the caller's folder** (`ownsKey` in `lib/s3.ts`), so one user can't open or delete another user's file by guessing its key.
- **Tags live in S3**, in one small JSON file per user, so nothing depends on the local disk and it works on any host.
- **If there is no Gemini key, or the call fails,** the file gets simple type-based tags and the UI shows them in grey. AI tags are amber, so the two are never confused.

## Setup

### 1. Install

Copy these folders next to your existing `app` folder, replacing what's there: `app`, `components`, `lib`, `types`. Keep your own `package.json`; no new packages are needed.

```bash
npm install
```

Delete these leftovers if you have them: `app/page..tsx` (duplicate), `data-cache.json`.

### 2. Google sign-in

1. Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add your deployed URL too, later).
3. Copy the client ID and secret into `.env.local`.

### 3. S3 bucket

1. Keep **Block all public access** turned ON. Files are only reachable through signed links.
2. Bucket → Permissions → CORS: paste `s3-cors.json` (replace the domain). Without this, uploads fail in the browser.
3. Create an IAM user for local development with `iam-policy.json` (replace `YOUR-BUCKET-NAME`), and put its keys in `.env.local`. When you deploy on AWS, attach the same policy to a role instead of using keys.

### 4. Environment

```bash
cp .env.example .env.local
# fill in the values
npm run dev
```

Open http://localhost:3000.

## If something doesn't work

- **Upload fails with an error 403 or "blocked":** the bucket CORS rule is missing or has the wrong origin (step 3.2). If CORS is right and it still returns 403, open `app/api/upload/route.ts` and delete the `ContentLength: fileSize,` line. The server still checks size and type before signing, you only lose the extra check inside S3.
- **Every file gets grey tags and none are amber:** `GEMINI_API_KEY` is missing or invalid, or the model name has changed. Set `GEMINI_MODEL` to a current model from https://ai.google.dev/gemini-api/docs/models.
- **"Sign-in isn't set up correctly":** `NEXTAUTH_SECRET` is empty, or the Google redirect URI doesn't match exactly.
- **"AWS_S3_BUCKET_NAME is not set":** the old code fell back to a hard-coded bucket name. This version needs it in `.env.local`.

## Notes

- **Password accounts, honest limits:** there is no email verification and no "forgot password" flow, and a Google account and a password account with the same email are two separate vaults. The upgrade path is Amazon Cognito, which handles all of that (and MFA) for you.
- Files uploaded with the old version were stored under `uploads/<email>/`. The app now uses `users/<google-id>/`, so old files won't show up. Delete them from the bucket, or move them into your new folder.
- If an AWS key was ever pasted into a chat, a commit, or a screenshot, deactivate it in IAM and create a new one.
- Uploads are limited to 25 MB and to a fixed list of file types (`lib/types.ts`).
- AI tagging reads images, PDFs and text files up to 8 MB. Other types (Word, Excel, zip) get type-based tags.

## Ideas for next steps

These double as DevOps practice for your resume:

- Dockerize the app and run it on ECS or EC2
- Add a GitHub Actions pipeline that builds, tests and deploys
- Create the bucket, IAM role and CORS rules with Terraform
- Move the tag index to DynamoDB
- Add CloudWatch alarms for failed uploads
