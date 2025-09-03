# React Preview Deployment System (Vercel-like)

A minimal, production-ready system that turns any public React GitHub repository into a globally available preview URL. It clones a repo, builds it in a Docker container on AWS ECS, uploads the build to S3, and serves it worldwide via CloudFront.

## What it does

- Accepts a GitHub repository URL (React app)
- Spins up a Docker container (build server) via AWS ECS
- Installs dependencies and runs the build (Vite or CRA)
- Fixes absolute asset paths (e.g., `/assets/*` → `./assets/*`)
- Uploads build output to S3 at `__outputs/{PROJECT_ID}/`
- Serves previews via CloudFront at `https://<cloudfront-domain>/{PROJECT_ID}/`
- Supports React Router (SPA) with CloudFront error-page fallback

## Repository layout

```
./
├─ build-server/
│  ├─ Dockerfile          # Build server container definition
│  ├─ main.sh             # Entry: clones repo then runs script.js
│  ├─ script.js           # Build + path-fix + upload to S3
│  ├─ package.json        # Build server dependencies
│  └─ node_modules/
└─ LICENSE
```

## Prerequisites

- AWS account with permissions for S3, ECS (optional for local), CloudFront
- An S3 bucket (e.g., `vercel-clone-xxxx`)
- A CloudFront distribution configured with:
  - Origin: your S3 bucket
  - OriginPath: `/__outputs`
  - Behaviors for `/*/`, `/*/assets/*`, and `/*.*`
  - Error pages: 404/403 → `/index.html` (or project-prefixed during testing)
- Docker installed locally (for local builds/tests)
- Node.js 18+ inside the container (installed via Dockerfile)

## Environment variables

The build server uses these environment variables:

- `PROJECT_ID` (required): unique ID per deployment (e.g., `P1`, `A10`)
- `GIT_REPOSITORY_URL` (required): HTTPS GitHub URL (public preferred)
- `accessKeyId` (required): AWS access key ID
- `secretAccessKey` (required): AWS secret access key

The `build-server/script.js` currently references:

- Region: `ap-south-1`
- Bucket name: change in `script.js` at upload step if needed

> Private repositories: Either make them public during testing or mount credentials and update `main.sh` to use a GitHub token.

## How to run locally (simulate the build)

1. Build the build-server image:

```bash
cd build-server
docker build -t builder-image .
```

2. Run the container (public repo recommended):

```bash
docker run -it \
  -e accessKeyId=YOUR_AWS_ACCESS_KEY_ID \
  -e secretAccessKey=YOUR_AWS_SECRET_ACCESS_KEY \
  -e PROJECT_ID=P1 \
  -e GIT_REPOSITORY_URL=https://github.com/someuser/some-react-app \
  builder-image
```

This will:

- Clone the repo into `/home/app/output`
- Run `npm install && npm run build`
- Fix asset paths in `index.html` (and referenced assets)
- Upload contents of `dist/` or `build/` to `s3://<your-bucket>/__outputs/P1/`

3. Access preview via CloudFront:

```
https://<your-cloudfront-domain>/<PROJECT_ID>/
# Example: https://d167957v6g2q0.cloudfront.net/P1/
```

## How to run in AWS ECS

- Package and push the `build-server` image to ECR
- Create an ECS task definition using the image
- Set env vars in the task (PROJECT_ID, GIT_REPOSITORY_URL, accessKeyId, secretAccessKey)
- Run the task on Fargate or EC2 backed cluster
- On completion, the build will be available in S3 at `__outputs/{PROJECT_ID}/`
- CloudFront will serve it at `https://<cloudfront-domain>/{PROJECT_ID}/`

## React Router (SPA) support

Because previews are served under `/{PROJECT_ID}/`, React Router apps should set a basename. Ask users to add these 3 lines:

```jsx
// in App.jsx / App.tsx
const projectId = window.location.pathname.split("/")[1];
const basename = projectId ? `/${projectId}` : "";

<BrowserRouter basename={basename}>{/* routes */}</BrowserRouter>;
```

This ensures routes like `/signin` work as `/{PROJECT_ID}/signin` in the CDN.

## Troubleshooting

- 403/404 on assets
  - Verify files exist in S3 under `__outputs/{PROJECT_ID}/`
  - Ensure CloudFront OriginPath is `/__outputs` and behaviors include `/*/assets/*`
- Blank page with React Router
  - Ensure basename is set as above
  - Confirm CloudFront error pages forward 404/403 to `/index.html`
- Private GitHub repo asks for credentials
  - Make repo public for testing, or update `main.sh` to use a GitHub token
- Build folder missing
  - The script checks `dist/` then `build/`. Ensure the repo has a valid `build` script

## Security notes

- Prefer using AWS IAM users/roles with least privilege
- Do not hardcode credentials; pass via environment variables or ECS task secrets
- Consider using Origin Access Control (OAC) to keep the bucket private and only allow CloudFront

## Roadmap (optional)

- GitHub OAuth + webhook-based builds
- Build logs streaming to the UI
- Custom domains per preview
- Automatic invalidation or versioned cache keys

---

MIT © 2025
