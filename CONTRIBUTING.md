# Contributing

Thanks for your interest in contributing!

## Quick Guidelines

- Keep PRs small and focused.
- Include a short test plan in the PR description.
- Avoid committing secrets (`.env`, private keys, API keys). This repo ignores `.env*` by default.

## Development

Install dependencies:

```bash
npm install
npm --prefix apps/web install
```

Run the app:

```bash
npm --prefix apps/web run dev
```

Lint/build:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

## Contracts

Compile/test:

```bash
npm run compile
npm test
```

