# pi-credits

A [pi](https://pi.dev/) extension that shows the active model provider's credit balance or rate-limit usage as a footer status.

- The status appears only while a supported provider is active and uses that provider's stored credential or API key.
- Supported providers: OpenAI Codex, OpenRouter, and Vercel AI Gateway.
- The status refreshes on session start, model switch, and after each turn that incurs usage.

## Install

Install from npm:

```bash
pi install npm:pi-credits
```

Install from git:

```bash
pi install git:github.com/zlliang/pi-credits
```

## Configure

pi-credits reads config from `~/.pi/agent/credits.json` and from the current project's `.pi/credits.json`. Project config overrides matching global fields.

The extension is enabled by default and currently has no options. Set `"credits": false` to disable it, for example, in a project where you don't want the status:

```json
{
  "credits": false
}
```
