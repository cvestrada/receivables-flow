#!/usr/bin/env bash
#
# Put the demo back to the moment it starts: an invoice nobody has submitted, nobody having
# signed, Ironline's public record at its onboarding counts, and the receivable where the later
# steps expect it.
#
# Four things drift between runs and each was reset by hand from a different place. One
# command, because a demo that is reset by remembering four steps is a demo that is sometimes
# reset by remembering three.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── local records"
rm -f apps/business/.submitted.json apps/business/.approvals.json apps/business/.repayment.json
echo "   invoice, approvals and repayment forgotten"

echo "── ENS: Ironline's record back to onboarding counts (Sepolia)"
npm run --silent onboard -w @rf/contracts-ens | grep -E "credit score|rf.invoices" || true

echo "── Hedera: wallets funded"
npm run --silent fund:accounts -w @rf/contracts-hedera-ats || true

echo "── done — open http://localhost:3200/invoices/outstanding"
