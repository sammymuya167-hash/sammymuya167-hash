# SHADOWNET Project Library — import register

Source: user-supplied **FULL STACK PROJECTS.pdf** (100 entries). Audited October 9, 2026 using GitHub's connected repository and branch checks.

## Audit summary

- **44** accessible project sources (including the `safak/youtube` branch `mern-social-app`).
- **50** source repositories returned 404 through the connected GitHub account.
- **5** `safak/youtube` project branches could not be found.
- **1** delivery route optimizer (#92) is already completed as **RouteForge** according to the project owner. It is not imported here.

See [projects.tsv](projects.tsv) for all 100 entries, their original URLs, status, and required review.

## What is and isn't done

This folder is the source audit, tracking register, and an executable GitHub CLI import helper. **The upstream repositories have not been copied or forked yet.** The current GitHub connector can write to existing repositories but cannot create new repositories or forks. Nothing here is a production deployment.

## Bulk import

Use a trusted local shell or GitHub Codespace, with GitHub CLI authenticated to `sammymuya167-hash`:

```bash
cd shadownet-project-library
bash import-available.sh
```

The helper asks for an explicit `FORK` confirmation, checks the GitHub login, forks reachable repositories, skips existing forks, and records failures. It skips the 9 accessible-but-mismatched sources by default. Use `bash import-available.sh --include-mismatches` only if you intentionally want those upstream repositories too.

Forks preserve the upstream repository relationship, history and credits. **Forking does not make an upstream product your original creation**, and does not mean it is legally reusable for any purpose. Check each project's exact license, contributor notices, media assets, brand/trademark rules, dependencies and deployment configuration *before* changing or commercializing the source.

## Source caveats

The PDF is an idea list, not 100 ready-to-deploy applications. Some references are libraries, tutorials, or products, and some titles mismatch their linked source:

- #46 `enaqx/awesome-react` is a list of React resources, not a budget-planning app.
- #60 `iptv-org/iptv` is IPTV data, not a gaming platform; do not treat it as licensed entertainment content.
- #61 `project_corona_tracker` is a pandemic-tracking project, not a multiplayer quiz game.
- #66 `plivo-examples-node` is API sample code, not a complete SMS platform.
- #80 `keen/keen-js`, #85 `google-authenticator`, #87 `tfjs-examples`, #88 `Surprise`, and #89 `sentiment` are not turnkey versions of the PDF's proposed full-stack applications.

## One-by-one development process

1. Select one imported project and evaluate its license, architecture and dependencies.
2. Design a distinct SHADOWNET product while retaining required attribution.
3. Upgrade its authentication, security, configuration and data persistence.
4. Test with non-production configuration and add automated tests.
5. Deploy to a separate hosting project only after the app is ready. GitHub repositories alone do **not** host dynamic backend services.
6. Record the new product link, build status and current maintainer.

Recommended first candidates: #1 E-Commerce, #10 Chat, #32 Notion-style Notes, #35 Scheduling, #55 Travel Planning, #72 Weather, #79 Dashboard, #97 Code Snippets and #100 URL Shortener.
