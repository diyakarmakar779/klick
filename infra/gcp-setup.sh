#!/usr/bin/env bash
# One-time Google Cloud setup for Connected Event Networking.
# Run on your laptop with the gcloud CLI logged in:  gcloud auth login && gcloud auth application-default login
# Usage: PROJECT_ID=my-project-id ./gcp-setup.sh
# Safe to re-run: each step skips what already exists.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-south1}"            # Mumbai: Cloud Run, Firestore and Gemini on Vertex AI are all available
SERVICE="${SERVICE:-event-networking-api}"
BUCKET="${BUCKET:-${PROJECT_ID}-media}"
SA="${SERVICE}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Project"
gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 || gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"
if [[ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')" != "True" ]]; then
  echo "!! Billing is not enabled. Link a billing account (hackathon credits) at:"
  echo "   https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
  echo "   then re-run this script."
  exit 1
fi

echo "==> APIs"
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com aiplatform.googleapis.com storage.googleapis.com \
  secretmanager.googleapis.com firebase.googleapis.com identitytoolkit.googleapis.com \
  calendar-json.googleapis.com firebasehosting.googleapis.com

echo "==> Firestore (Native mode)"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "==> Media bucket (private, uniform access)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention

echo "==> Service account for Cloud Run (least privilege)"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SERVICE" --display-name="Event networking API"
# A new service account takes a few seconds to be visible to IAM; retry instead of failing.
retry() { for i in 1 2 3 4 5 6; do "$@" && return 0; echo "   (waiting for the new service account, try $i)"; sleep 10; done; return 1; }
for role in roles/datastore.user roles/aiplatform.user roles/secretmanager.secretAccessor; do
  retry gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null
done
retry gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
# Needed so the service can sign short-lived URLs for private voice/photo uploads.
retry gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" --role=roles/iam.serviceAccountTokenCreator >/dev/null

echo "==> Secrets"
gcloud secrets describe job-secret >/dev/null 2>&1 || \
  openssl rand -hex 24 | gcloud secrets create job-secret --data-file=- --replication-policy=automatic

echo "==> LinkedIn sign-in secrets (optional; create an app at https://www.linkedin.com/developers/apps"
echo "    with the 'Sign In with LinkedIn using OpenID Connect' product, then re-run with these set)"
if [[ -n "${LINKEDIN_CLIENT_ID:-}" && -n "${LINKEDIN_CLIENT_SECRET:-}" ]]; then
  gcloud secrets describe linkedin-client-secret >/dev/null 2>&1 || \
    printf %s "$LINKEDIN_CLIENT_SECRET" | gcloud secrets create linkedin-client-secret --data-file=- --replication-policy=automatic
fi

echo "==> Firebase (Auth) on the same project"
if ! npx -y firebase-tools projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
  npx -y firebase-tools projects:addfirebase "$PROJECT_ID" || echo "!! Add Firebase manually at https://console.firebase.google.com"
fi
echo "   Then enable Google sign-in: Firebase console > Authentication > Sign-in method > Google."
echo "   OAuth consent screen: add scope calendar.events.readonly and both demo Google accounts as test users:"
echo "   https://console.cloud.google.com/auth/audience?project=$PROJECT_ID"

echo "==> Firestore rules and indexes"
( cd "$(dirname "$0")/../backend" && npx -y firebase-tools deploy --only firestore --project "$PROJECT_ID" )

echo "==> Deploy API to Cloud Run"
( cd "$(dirname "$0")/../backend" && gcloud run deploy "$SERVICE" --source . --region "$REGION" \
    --service-account "$SA" --allow-unauthenticated --min-instances 0 --max-instances 3 \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,MEDIA_BUCKET=$BUCKET,DEMO_MODE=1,GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash},VERTEX_LOCATION=global,LINKEDIN_CLIENT_ID=${LINKEDIN_CLIENT_ID:-}" \
    --set-secrets "JOB_SECRET=job-secret:latest$( gcloud secrets describe linkedin-client-secret >/dev/null 2>&1 && echo ',LINKEDIN_CLIENT_SECRET=linkedin-client-secret:latest' )" )
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
# Luma identifies us by fetching $URL/oauth/luma-client.json, so the API needs to know its own public URL.
# Set WEB_URL=https://<project>.web.app before running to allow the web app's Luma callback.
gcloud run services update "$SERVICE" --region "$REGION" \
  --update-env-vars "PUBLIC_API_URL=$URL,WEB_URL=${WEB_URL:-https://$PROJECT_ID.web.app}" >/dev/null

# The demo triggers reconnection with an "advance time" call. Set SCHEDULER=1 for a real hourly job.
if [[ "${SCHEDULER:-0}" == "1" ]]; then
echo "==> Hourly reconnection job"
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs describe reconnect-prompts --location "$REGION" >/dev/null 2>&1 || \
  gcloud scheduler jobs create http reconnect-prompts --location "$REGION" --schedule="0 * * * *" \
    --uri="$URL/jobs/reconnect" --http-method=POST \
    --headers="x-job-secret=$(gcloud secrets versions access latest --secret=job-secret),Content-Type=application/json" \
    --message-body='{}'
fi

echo
echo "Reminder: set a budget alert at https://console.cloud.google.com/billing/budgets"
echo "Done. API: $URL"
echo "Health check: curl $URL/health"
echo "Seed demo data: cd backend && GOOGLE_CLOUD_PROJECT=$PROJECT_ID npm run seed"
