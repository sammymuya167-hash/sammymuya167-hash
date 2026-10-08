#!/usr/bin/env bash
# Fork available GitHub examples into the connected SHADOWNET account.
# Run locally or in GitHub Codespaces after authenticating gh CLI.
set -uo pipefail
cd "$(dirname "$0")"
if ! command -v gh >/dev/null 2>&1; then echo "Install GitHub CLI: https://cli.github.com"; exit 1; fi
if ! gh auth status >/dev/null 2>&1; then echo "Run: gh auth login"; exit 1; fi
account="$(gh api user --jq .login)" || exit 1
if [[ "$account" != "sammymuya167-hash" ]]; then
  echo "Connected as $account; expected sammymuya167-hash. Nothing forked."
  exit 1
fi
include_mismatches=false
if [[ "${1:-}" == "--include-mismatches" ]]; then include_mismatches=true; fi
echo "Import target: $account"
echo "Forks preserve upstream authorship; they are NOT customized or deployed."
echo "A source license and trademark review is required before rebranding."
echo
read -r -p "Proceed with verified sources? Enter FORK: " confirmation
if [[ "$confirmation" != "FORK" ]]; then echo "Cancelled"; exit 1; fi
success=0; failed=0; skipped=0
while IFS=$'\t' read -r id title upstream ref source status review; do
  [[ "$id" == "number" ]] && continue
  [[ "$status" == "available" ]] || { ((skipped+=1)); continue; }
  if [[ "$review" == "concept_mismatch" && "$include_mismatches" != true ]]; then
    echo "SKIP mismatch #$id: $title (source $upstream)"; ((skipped+=1)); continue
  fi
  canonical="$(gh api "repos/$upstream" --jq '.full_name' 2>/dev/null || true)"
  if [[ -z "$canonical" ]]; then
    echo "FAILED #$id: cannot resolve $upstream"; ((failed+=1)); continue
  fi
  destination="$account/${canonical##*/}"
  if gh repo view "$destination" >/dev/null 2>&1; then
    parent="$(gh api "repos/$destination" --jq '.parent.full_name // ""' 2>/dev/null || true)"
    if [[ "${parent,,}" == "${canonical,,}" ]]; then
      echo "EXISTS fork #$id: $destination"; ((skipped+=1))
    else
      echo "CONFLICT #$id: $destination already exists and is not a fork of $upstream"; ((failed+=1))
    fi
    continue
  fi
  echo "Forking #$id: $upstream"
  if GH_PROMPT_DISABLED=1 gh repo fork "$upstream" --clone=false; then
    echo "SUCCESS #$id"; ((success+=1))
  else
    echo "FAILED #$id: $upstream"; ((failed+=1))
  fi
  sleep 3
done < projects.tsv
echo "Results: $success forked; $failed failed/conflicted; $skipped skipped or already present."
echo "Next: review each fork's LICENSE, dependencies, secrets, and deployment requirements."
