# Contributing to BookmarkMind AI

Thank you for your interest in contributing!

## Development Setup

```bash
npm install
npm run dev
```

To load in Chrome:
1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select the `dist/` directory

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Follow existing patterns in the codebase
- Run `npm run lint` before submitting

## Commit Convention

We use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code restructuring
- `test:` test additions
- `chore:` build/CI/tooling

Example: `feat: add cloud sync indicator to side panel`

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run build`
5. Submit a PR with a clear description of changes
