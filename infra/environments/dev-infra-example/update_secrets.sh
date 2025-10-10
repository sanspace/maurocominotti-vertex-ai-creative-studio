#!/bin/bash

# A script to securely update secrets in Google Secret Manager
# based on the terraform outputs in the current environment directory.
#
# USAGE:
# 1. cd into the environment you want to update (e.g., `cd environments/dev`)
# 2. Run this script from that directory (`../../update_secrets.sh`)

set -e
set -o pipefail

# --- Color Definitions ---
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_CYAN='\033[0;36m'

# --- Helper Functions ---
info() {
  echo -e "${C_CYAN}> $1${C_RESET}"
}

success() {
  echo -e "${C_GREEN}✅ $1${C_RESET}"
}

warn() {
  echo -e "${C_YELLOW}⚠️ $1${C_RESET}"
}

fail() {
  echo -e "${C_RED}❌ $1${C_RESET}" >&2
  exit 1
}

# --- Dependency Check ---
info "Checking for required tools (gcloud, jq, terraform)..."
command -v gcloud >/dev/null || fail "gcloud CLI not found. Please install it."
command -v jq >/dev/null || fail "jq is not installed. Please install it (e.g., 'brew install jq')."
command -v terraform >/dev/null || fail "Terraform not found. Please install it."
info "All tools found."

# --- Main Script ---

# 1. Fetch outputs from the Terraform state in the current directory
info "Fetching secrets from Terraform state..."
TERRAFORM_OUTPUTS=$(terraform output -json)

# 2. Parse the outputs using jq
PROJECT_ID=$(echo "$TERRAFORM_OUTPUTS" | jq -r .gcp_project_id.value)
FRONTEND_SECRETS=$(echo "$TERRAFORM_OUTPUTS" | jq -r .frontend_secrets.value[])
BACKEND_SECRETS=$(echo "$TERRAFORM_OUTPUTS" | jq -r .backend_secrets.value[])

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "null" ]; then
  fail "Could not find 'gcp_project_id' in Terraform outputs. Did you run 'terraform apply'?"
fi

# Combine, de-duplicate, and sort the secret lists
ALL_SECRETS=$(echo "${FRONTEND_SECRETS} ${BACKEND_SECRETS}" | tr ' ' '\n' | sort -u | grep .)

if [ -z "$ALL_SECRETS" ]; then
  success "No secrets listed in 'frontend_secrets' or 'backend_secrets' outputs. Nothing to do."
  exit 0
fi

info "Project: ${C_YELLOW}${PROJECT_ID}${C_RESET}"
warn "The following secrets will be updated:"
echo -e "${C_YELLOW}$ALL_SECRETS${C_RESET}"

# 3. Confirmation
read -p "Continue? (y/n): " -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  fail "Operation cancelled."
fi

# 4. Attempt to auto-discover Firebase config
info "Checking for Firebase Web App configuration..."
WEB_APP_CONFIG=$(gcloud firebase apps list --project="$PROJECT_ID" --format="json" | jq -r '.[] | select(.platform=="WEB") | .appId' | head -n 1 | xargs -I {} gcloud firebase apps get-config {} --project="$PROJECT_ID" --format="json" 2>/dev/null)

if [ -n "$WEB_APP_CONFIG" ]; then
  success "Found Firebase Web App config. Will attempt to auto-populate secrets."
  # Extract values
  AUTO_FIREBASE_API_KEY=$(echo "$WEB_APP_CONFIG" | jq -r .apiKey)
  AUTO_FIREBASE_AUTH_DOMAIN=$(echo "$WEB_APP_CONFIG" | jq -r .authDomain)
  AUTO_FIREBASE_PROJECT_ID=$(echo "$WEB_APP_CONFIG" | jq -r .projectId)
  AUTO_FIREBASE_STORAGE_BUCKET=$(echo "$WEB_APP_CONFIG" | jq -r .storageBucket)
  AUTO_FIREBASE_MESSAGING_SENDER_ID=$(echo "$WEB_APP_CONFIG" | jq -r .messagingSenderId)
  AUTO_FIREBASE_APP_ID=$(echo "$WEB_APP_CONFIG" | jq -r .appId)
else
  warn "Could not automatically find a Firebase Web App config for project '$PROJECT_ID'."
  warn "You will be prompted for all Firebase secrets manually."
fi

# 5. Loop, Prompt, and Write
for SECRET_NAME in $ALL_SECRETS; do
  info "Updating secret: ${C_YELLOW}${SECRET_NAME}${C_RESET}"
  SECRET_VALUE=""
  AUTO_DISCOVERED=false

  # Check if we have an auto-discovered value for the current secret
  case $SECRET_NAME in
    "FIREBASE_API_KEY")           SECRET_VALUE=$AUTO_FIREBASE_API_KEY; AUTO_DISCOVERED=true ;;
    "FIREBASE_AUTH_DOMAIN")       SECRET_VALUE=$AUTO_FIREBASE_AUTH_DOMAIN; AUTO_DISCOVERED=true ;;
    "FIREBASE_PROJECT_ID")        SECRET_VALUE=$AUTO_FIREBASE_PROJECT_ID; AUTO_DISCOVERED=true ;;
    "FIREBASE_STORAGE_BUCKET")    SECRET_VALUE=$AUTO_FIREBASE_STORAGE_BUCKET; AUTO_DISCOVERED=true ;;
    "FIREBASE_MESSAGING_SENDER_ID") SECRET_VALUE=$AUTO_FIREBASE_MESSAGING_SENDER_ID; AUTO_DISCOVERED=true ;;
    "FIREBASE_APP_ID")            SECRET_VALUE=$AUTO_FIREBASE_APP_ID; AUTO_DISCOVERED=true ;;
  esac

  if [ "$AUTO_DISCOVERED" = true ] && [ -n "$SECRET_VALUE" ]; then
    info "  Auto-populating from Firebase config."
  else
    # Add reassurance for the user
    echo -e "${C_CYAN}  It is safe to paste your secret. The value is read securely, not displayed, and not stored in disk or history.${C_RESET}"

    # Securely prompt for the secret value (the -s flag hides the input)
    read -s -p "  Enter new value: " SECRET_VALUE
    echo # Add a newline after the prompt
  fi

  if [ -z "$SECRET_VALUE" ]; then
    warn "  No value provided. Skipping ${SECRET_NAME}."
    continue
  fi

  # Check if the secret already exists and has the same value
  LATEST_VERSION=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT_ID" 2>/dev/null || echo "")
  if [ "$LATEST_VERSION" == "$SECRET_VALUE" ]; then
    success "  Secret ${SECRET_NAME} is already up-to-date. Skipping."
  else
    # Write the secret value from the variable directly to gcloud stdin
    # This avoids saving it to disk or command history.
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
      --data-file="-" \
      --project="$PROJECT_ID" \
      --quiet

    if [ $? -eq 0 ]; then
      success "  Successfully added new version for ${SECRET_NAME}."
    else
      fail "  Failed to update secret ${SECRET_NAME}."
    fi
  fi

done

success "All secrets updated."
