# Scientific Computing Live Lab — SHADOWNET edition

Interactive browser adaptation of the Scientific-for-Computing2 coursework, maintained as a self-contained project in SHADOWNET's GitHub projects directory.

## Browser app
Eight functioning numerical experiments: server-room monitoring (Task 02), network latency (03), numerical precision (04), geometry transformations (05), server allocation (06), network load (07), temperature grid (08), and Monte Carlo overload risk (20).

Open `index.html` in a modern browser. This is a standalone static client-side app, with no build tools, API keys or backend services. All readings and simulations use synthetic data rather than actual device readings.

### Improvements over the original deployed demonstration
- Preserve the original visual design and all eight implemented experiments.
- Show a visible run counter/status on every completed calculation so identical seeded outputs aren't mistaken for non-responsive buttons.
- Show clear indicators after a slider/select is changed until the experiment is re-run.
- Keep run status visible on mobile devices.
- Clamp the Monte Carlo capacity marker to the chart's visible bounds.
- Escape calculation error messages before insertion into HTML.

## Original coursework source
`original-python/` contains a complete snapshot of the upstream repository's 59 tracked files, including 35 empty placeholder files, retrieved on November 20, 2026 from:
https://github.com/omondijurgen58-cloud/SCIENTIFIC-FOR-COMPUTING2

The upstream repository did not contain an explicit license at inspection. Preservation here does **not** transfer copyright or authorship, and public reuse of upstream material remains subject to the original author's rights. Empty coursework placeholders remain unimplemented.

## Regression test
See `TESTING.md`. The previous version's eight interactive tasks passed browser QA on November 20, 2026. Test the deployed copy again before relying on it.

## Deployment
For Vercel choose this directory as the project root, deploy as a static site, and map the root URL to `index.html`.
