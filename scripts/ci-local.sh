#!/usr/bin/env bash
#
# ci-local.sh — reprodukuje GitHub CI pipeline lokalno
#
# Pokreni iz Banka-2-Frontend root-a:
#   bash scripts/ci-local.sh [all|lint|vitest|cypress-mocked|cypress-live]
#
# all (default) pokrene sve korake istim redosledom kao CI.
# Ako sve prodje lokalno, trebalo bi da prode i na GitHub-u.
#
# Zavisnosti:
#   - Node 20+
#   - Docker + Docker Compose v2
#   - psql (za live suite)
#   - Backend repo checkovan pored Frontend-a:
#     ../Banka-2-Backend/ (ili postavi BE_REPO env-var na put)
#
set -e

TARGET="${1:-all}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[ci-local]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }

BE_REPO="${BE_REPO:-../Banka-2-Backend}"
[ -d "$BE_REPO" ] || fail "Backend repo nije pronadjen na $BE_REPO. Setuj BE_REPO env-var ili checkuj pored."

step_lint() {
  log "Running ESLint (isti kao CI job 'lint')"
  npm ci --silent
  npm run lint
  ok "ESLint clean"
}

step_vitest() {
  log "Running Vitest (ne postoji poseban job u CI-ju, ali lokalno ga vrti za sigurnost)"
  npx tsc --noEmit
  npx vitest run --reporter=default
  ok "Vitest + tsc clean"
}

step_cypress_mocked() {
  log "Running Cypress Mocked (isti kao CI job 'cypress-mocked')"
  npm run build
  # serve distribuciju kao sto CI radi
  npx serve -s dist -l 3000 &
  SERVE_PID=$!
  trap "kill $SERVE_PID 2>/dev/null || true" EXIT
  npx wait-on http://localhost:3000 --timeout 120000
  npx cypress run --config video=false \
    --spec "cypress/e2e/celina1-mock.cy.ts,cypress/e2e/celina2-mock.cy.ts,cypress/e2e/celina3-mock.cy.ts"
  kill $SERVE_PID 2>/dev/null || true
  trap - EXIT
  ok "Cypress Mocked pass"
}

step_cypress_live() {
  log "Running Cypress Live (isti kao CI job 'cypress-live')"

  # Startuj BE stack (postgres + backend + seed) — to je otprilike sto CI radi
  log "Startujem backend stack kroz docker compose..."
  (cd "$BE_REPO" && docker compose down -v >/dev/null 2>&1 || true)
  (cd "$BE_REPO" && docker compose up -d)

  # Cekaj seed
  log "Cekam seed..."
  for i in $(seq 1 30); do
    if docker logs banka2_seed 2>&1 | grep -q "Seed uspesno ubasen"; then
      ok "Seed zavrsen ($((i*5))s)"
      break
    fi
    sleep 5
  done

  # Verifikuj da je backend zdrav
  for i in $(seq 1 20); do
    if curl -sf http://localhost:8080/swagger-ui.html >/dev/null 2>&1; then
      ok "Backend zdrav"
      break
    fi
    sleep 3
  done

  # Pokreni frontend container
  log "Startujem frontend..."
  docker compose down >/dev/null 2>&1 || true
  docker compose up -d
  npx wait-on http://localhost:3000 --timeout 60000

  # Run Cypress
  npx cypress run --config video=false,baseUrl=http://localhost:3000 \
    --spec "cypress/e2e/celina1-live.cy.ts,cypress/e2e/celina2-live.cy.ts,cypress/e2e/celina3-live.cy.ts,cypress/e2e/e2e-scenario-live.cy.ts"

  ok "Cypress Live pass"
}

step_backend_tests() {
  log "Running Backend tests (isti kao CI job 'Unit Tests')"
  (cd "$BE_REPO/banka2_bek" && ./mvnw test -q)
  ok "BE Tests pass"
}

step_backend_lint() {
  log "Running Backend Checkstyle (isti kao CI job 'Checkstyle Lint')"
  (cd "$BE_REPO/banka2_bek" && ./mvnw checkstyle:check -q) || warn "Checkstyle ima upozorenja"
}

case "$TARGET" in
  lint)           step_lint ;;
  vitest)         step_vitest ;;
  cypress-mocked) step_cypress_mocked ;;
  cypress-live)   step_cypress_live ;;
  backend)        step_backend_tests; step_backend_lint ;;
  all)
    step_lint
    step_vitest
    step_backend_tests
    step_backend_lint
    step_cypress_mocked
    step_cypress_live
    ok "Sve CI korake prosle lokalno — safe push!"
    ;;
  *)
    echo "Usage: $0 [all|lint|vitest|cypress-mocked|cypress-live|backend]"
    exit 1
    ;;
esac
