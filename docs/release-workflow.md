# Release workflow (GitHub and Netlify)

Netlify is connected to GitHub with automatic deploys. Merging to the production branch publishes the site, so merging is
the step that needs your explicit approval. Nothing here has been run against your repository; I had no access to it.

## Steps

1. Update your local copy and branch: `git switch main`, `git pull`, `git switch -c launch-prep`.
2. Put the release candidate in the branch: unzip `curiohatch-release-candidate.zip` over the folder (keep your `.git`),
   or apply `milestone2-changes.patch` with `git apply`. That patch is built on top of the first redesign
   (`curiohatch-website-redesign.zip`), which is what the live site served when I checked on 2026-10-17. Use
   `release-candidate-vs-original.patch` only if your `main` is still the original pre-redesign site. If your `main`
   differs from those, expect conflicts and tell me.
3. Look before committing: `git status` and `git diff`. Nothing from `node_modules`, `__pycache__`, `.DS_Store` or test output
   should appear (the included `.gitignore` covers them). No file should contain a password, key or personal email address.
4. Run `python tests/run_all.py` (see `docs/testing.md`) and `python tools/site.py check`.
5. Commit and push the branch, not `main`: `git push -u origin launch-prep`.
6. Open a pull request into `main` on GitHub. If Deploy Previews are on for the site (the default for GitHub-connected
   sites, but confirm in Netlify under Build & deploy), Netlify comments on the pull request with a preview address. If no
   comment appears within a few minutes, the preview is not set up; do not merge.
7. Open the preview and work through `docs/launch-checklist.md`. Review it on a phone.
8. Approve: merge the pull request. Netlify publishes to `curiohatch.studio`. Watch the deploy log until it says published.
9. On the live site, repeat the quick checks and send the real contact-form test.

## Costs and limits to watch

Netlify's free plan, as I understand it, gives 300 credits a month as a hard limit, and a production deploy costs credits.
If credits run out the site can pause. Check **Usage & billing** before opening several pull requests, and make
changes in batches. Confirm the exact numbers on your own account.

## Rollback

- Fastest: in Netlify, **Deploys**, open the last good production deploy, and choose **Publish deploy**. As I understand it,
  Netlify then stops auto-publishing until you press **Start auto publishing**, so remember to turn it back on.
- In Git: `git revert -m 1 <merge commit>` on `main`, push, and let Netlify deploy the revert.
- Content-only mistakes (a price, a sentence): fix the file and push; no rollback needed.

Until step 8 the live site stays as it is now (the first redesign). Keep that deploy listed in Netlify so rollback stays one click.

## What becomes public

Netlify publishes the repository root. Everything in it can be opened by address, including `content/`, `docs/`,
`tools/` and `tests/`. `robots.txt` asks search engines to skip them, but that does not hide them. Do not put anything private in
`content/learn/topics.json` (planned video ideas are visible there) or in the docs.
