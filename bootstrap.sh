#!/bin/bash

# ==============================================================================
# Creative Studio Infrastructure Bootstrap Script (Resumable)
#
# This interactive script guides a user through the entire process of setting
# up the Creative Studio infrastructure in a new or existing Google Cloud project.
# It saves progress and can be safely restarted if it fails.
# ==============================================================================

set -e

# --- Configuration ---
REQUIRED_TERRAFORM_VERSION="1.13.0" # Use the latest required version

# --- Color Definitions ---
C_RESET='\033[0m'; C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_CYAN='\033[0;36m'

# --- Helper Functions ---
info() { echo -e "${C_CYAN}➡️  $1${C_RESET}"; }
prompt() { echo -e "${C_BLUE}🤔 $1${C_RESET}"; }
warn() { echo -e "${C_YELLOW}⚠️  $1${C_RESET}"; }
fail() { echo -e "${C_RED}❌ $1${C_RESET}" >&2; exit 1; }
success() { echo -e "${C_GREEN}✅ $1${C_RESET}"; }
step() { echo -e "\n${C_BLUE}--- Step $1: $2 ---${C_RESET}"; }

# --- State Management ---
STATE_FILE=""
REPO_ROOT=""
write_state() {
    if [ -z "$STATE_FILE" ]; then return; fi
    # Use a temporary file to avoid issues with sed -i on different OSes
    TMP_STATE_FILE=$(mktemp)
    # Remove the key if it exists
    grep -v "^$1=" "$STATE_FILE" > "$TMP_STATE_FILE" || true
    # Append the new value
    echo "$1=$2" >> "$TMP_STATE_FILE"
    mv "$TMP_STATE_FILE" "$STATE_FILE"
}
read_state() {
    if [ -f "$STATE_FILE" ]; then
        info "Found previous state file. Resuming..."
        set -a; source "$STATE_FILE"; set +a
    fi
}

# --- Script Functions ---

check_prerequisites() {
    step 1 "Checking Prerequisites"
    command -v gcloud >/dev/null || fail "gcloud CLI not found. Please install from https://cloud.google.com/sdk/docs/install"
    command -v git >/dev/null || fail "git not found. Please install it."

    if ! command -v jq &> /dev/null; then
        warn "The 'jq' command is required but not found."
        prompt "Would you like to try and install it now? (y/n)"
        read -r REPLY
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            warn "This may require sudo privileges."
            if command -v apt-get &>/dev/null; then
                sudo apt-get update && sudo apt-get install -y jq
            elif command -v brew &>/dev/null; then
                brew install jq
            elif command -v yum &>/dev/null; then
                sudo yum install -y jq
            else
                fail "Cannot automatically install jq on this OS. Please install it manually and run again."
            fi
        else
            fail "Please install jq and run this script again."
        fi
    fi
    success "Prerequisites (gcloud, git, jq) met."
}

check_and_install_terraform() {
    step 2 "Checking Terraform Installation"
    if ! command -v terraform &> /dev/null; then
        warn "Terraform is not installed."
        install_terraform
        return
    fi

    INSTALLED_VERSION=$(terraform version -json | jq -r .terraform_version)
    if [[ "$(printf '%s\n' "$REQUIRED_TERRAFORM_VERSION" "$INSTALLED_VERSION" | sort -V | head -n1)" != "$REQUIRED_TERRAFORM_VERSION" ]]; then
        warn "Your Terraform version ($INSTALLED_VERSION) is older than the required version ($REQUIRED_TERRAFORM_VERSION)."
        install_terraform
    else
        success "Terraform version $INSTALLED_VERSION is sufficient."
    fi
}

install_terraform() {
    prompt "Would you like this script to attempt to install/update Terraform to version $REQUIRED_TERRAFORM_VERSION? (y/n)"
    read -r REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        fail "Please install or update Terraform manually to version $REQUIRED_TERRAFORM_VERSION or newer and run this script again."
    fi
    info "Downloading Terraform v${REQUIRED_TERRAFORM_VERSION}..."
    curl -Lo terraform.zip "https://releases.hashicorp.com/terraform/${REQUIRED_TERRAFORM_VERSION}/terraform_${REQUIRED_TERRAFORM_VERSION}_linux_amd64.zip"
    unzip -o terraform.zip
    warn "This script will now try to move the terraform binary to /usr/local/bin. This requires sudo privileges and may ask for your password."
    sudo mv terraform /usr/local/bin/
    rm terraform.zip LICENSE.txt

    info "Updating current terminal session..."
    export PATH=$PATH:/usr/local/bin
    hash -r
    
    if command -v terraform &> /dev/null && [[ "$(terraform version -json | jq -r .terraform_version)" == "$REQUIRED_TERRAFORM_VERSION" ]]; then
        success "Terraform v$(terraform -version | head -n 1) is now active in this terminal."
    else
        fail "Terraform installation failed to update the current session. Please open a new terminal and run this script again."
    fi
}

setup_project() {
    step 3 "Configuring Google Cloud Project"
    if [ -n "$GCP_PROJECT_ID" ]; then
        prompt "Found project '$GCP_PROJECT_ID' from a previous run. Use this project? (y/n)"
        read -r REPLY
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            gcloud config set project "$GCP_PROJECT_ID"
            success "Project '$GCP_PROJECT_ID' is configured."
            return
        fi
    fi
    
    prompt "Do you already have a Google Cloud Project to use? (y/n)"
    read -r REPLY
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        prompt "Please enter your existing Google Cloud Project ID:"
        read -p "   Project ID: " GCP_PROJECT_ID
    else
        prompt "What is the desired new Google Cloud Project ID? (e.g., my-creative-studio)"
        read -p "   Project ID: " GCP_PROJECT_ID
        prompt "What is your Google Cloud Billing Account ID? (Find it with 'gcloud beta billing accounts list')"
        read -p "   Billing Account ID: " BILLING_ACCOUNT_ID
        info "Creating project '$GCP_PROJECT_ID'..."
        gcloud projects create "$GCP_PROJECT_ID" || warn "Project '$GCP_PROJECT_ID' may already exist. Continuing..."
        info "Linking billing account '$BILLING_ACCOUNT_ID'..."
        gcloud beta billing projects link "$GCP_PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
    fi
    info "Setting gcloud config to use project '$GCP_PROJECT_ID'..."
    gcloud config set project "$GCP_PROJECT_ID"
    success "Project '$GCP_PROJECT_ID' is configured."
}

setup_repo() {
    step 4 "Configuring Git Repository"
    if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        info "Script is running inside a Git repository."
        REPO_ROOT=$(git rev-parse --show-toplevel)
        prompt "Use the current repository at '$REPO_ROOT'? (y/n)"
        read -r REPLY
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$REPO_ROOT"
            info "Current directory set to repository root."
        else
            fail "Please re-run the script from outside a Git repository to clone a new one."
        fi
    else
        warn "Please fork the repository at https://github.com/MauroCominotti/maurocominotti-vertex-ai-creative-studio first and then continue here."
            while true; do
                prompt "What is the git URL of YOUR forked repository? (e.g., https://github.com/user/repo.git)"
                read -p "   Git URL: " GITHUB_REPO_URL
                info "Validating repository URL..."
                if git ls-remote --exit-code -h "$GITHUB_REPO_URL" > /dev/null 2>&1; then
                    success "Repository found."
                    break
                else
                    warn "Repository not found at that URL. Please check for typos and try again."
                fi
            done
        prompt "What is the GitHub Branch you want to deploy from? [main]"
        read -p "   Branch Name: " GITHUB_BRANCH
        GITHUB_BRANCH=${GITHUB_BRANCH:-main}
        
        REPO_NAME=$(basename "$GITHUB_REPO_URL" .git)
        
        if [[ -d "$REPO_NAME" ]]; then
            warn "Directory '$REPO_NAME' already exists."
            prompt "Use this existing directory? (y/n)"
            read -r REPLY
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then fail "Please remove the directory or choose a different location and restart the script."; fi
            cd "$REPO_NAME"
        else
            warn "The script will now clone the repository."
            info "Cloning a lightweight copy of the '$GITHUB_BRANCH' branch..."
            git clone --single-branch --branch "$GITHUB_BRANCH" --depth=1 "$GITHUB_REPO_URL"
            cd "$REPO_NAME"
            success "Repository cloned successfully."
        fi
    fi
    
    # Set the repository root as our anchor for all future commands
    REPO_ROOT=$(git rev-parse --show-toplevel)
    export REPO_ROOT 
    
    GITHUB_REPO_OWNER=$(git remote get-url origin | sed -n 's/.*github.com\/\(.*\)\/.*/\1/p')
    GITHUB_REPO_NAME=$(basename "$REPO_ROOT")
    info "Detected GitHub owner: $GITHUB_REPO_OWNER"
    info "Detected GitHub repo name: $GITHUB_REPO_NAME"
    write_state "GITHUB_BRANCH" "$GITHUB_BRANCH"
}

configure_environment() {
    step 5 "Configuring Terraform Environment"
    cd "$REPO_ROOT/infra"
    
    if [ -z "$ENV_NAME" ]; then
        prompt "What would you like to call this deployment environment? (e.g., dev, staging)"
        read -p "   Environment Name [dev]: " ENV_NAME
        ENV_NAME=${ENV_NAME:-dev}
    else
      info "Using previously configured environment: $ENV_NAME"
    fi
    
    ENV_DIR="environments/$ENV_NAME"
    TFVARS_FILE="$ENV_NAME.tfvars"
    STATE_FILE="$ENV_DIR/.bootstrap_state"
    read_state

    if [ ! -d "$ENV_DIR" ]; then
        info "Creating new environment directory: $ENV_DIR"
        cp -r "environments/dev-infra-example" "$ENV_DIR"
        
        prompt "Do you have an existing GCS bucket for Terraform state? (y/n)"
        read -r REPLY
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            prompt "Please enter the name of your GCS bucket:"
            read -p "   Bucket Name: " BUCKET_NAME
        else
            BUCKET_NAME="${GCP_PROJECT_ID}-cstudio-${ENV_NAME}-tfstate"
            info "Creating GCS bucket '$BUCKET_NAME' for Terraform state..."
            gsutil mb -p "$GCP_PROJECT_ID" "gs://${BUCKET_NAME}" || warn "Bucket 'gs://${BUCKET_NAME}' may already exist. Continuing..."
        fi
        prompt "What prefix should be used inside the bucket? [infra/$ENV_NAME/state]"
        read -p "   Prefix: " BUCKET_PREFIX
        BUCKET_PREFIX=${BUCKET_PREFIX:-"infra/$ENV_NAME/state"}

        info "Updating backend.tf..."
        echo "terraform {
  backend \"gcs\" {
    bucket = \"$BUCKET_NAME\"
    prefix = \"$BUCKET_PREFIX\"
  }
}" > "$ENV_DIR/backend.tf"

        info "Updating $TFVARS_FILE..."
        mv "$ENV_DIR/dev.tfvars" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/gcp_project_id = \".*\"/gcp_project_id = \"$GCP_PROJECT_ID\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/github_repo_owner = \".*\"/github_repo_owner = \"$GITHUB_REPO_OWNER\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/github_repo_name = \".*\"/github_repo_name = \"$GITHUB_REPO_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/github_branch_name = \".*\"/github_branch_name = \"$GITHUB_BRANCH\"/g" "$ENV_DIR/$TFVARS_FILE"
        
        prompt "Please provide the following values (press Enter to use the default):"
        read -p "   Backend Service Name [cstudio-be-$ENV_NAME]: " val; BE_SERVICE_NAME=${val:-cstudio-be-$ENV_NAME}
        read -p "   Frontend Service Name [cstudio-fe-$ENV_NAME]: " val; FE_SERVICE_NAME=${val:-cstudio-fe-$ENV_NAME}

        sed -i.bak "s/backend_service_name = \".*\"/backend_service_name = \"$BE_SERVICE_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/frontend_service_name = \".*\"/frontend_service_name = \"$FE_SERVICE_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"
        
        write_state "ENV_NAME" "$ENV_NAME"; write_state "BE_SERVICE_NAME" "$BE_SERVICE_NAME"; write_state "FE_SERVICE_NAME" "$FE_SERVICE_NAME"
    else
      info "Environment directory '$ENV_DIR' already configured."
    fi
    
    success "Configuration files for '$ENV_NAME' environment are ready."
}

handle_manual_steps() {
    step 6 "Manual Steps Required"
    cd "$REPO_ROOT/infra"
    if [ -z "$GITHUB_CONN_NAME" ]; then
        warn "Terraform cannot automate browser-based OAuth authorization."
        info "Please perform the following manual steps for the GitHub connection:"
        echo "1. Open this URL in your browser:"; echo -e "   ${C_YELLOW}https://console.cloud.google.com/cloud-build/connections/create?project=${GCP_PROJECT_ID}${C_RESET}"
        echo "2. Select 'GitHub (Cloud Build GitHub App)' and click 'CONTINUE'."
        echo "3. Follow the prompts to authorize the app on your GitHub account."
        echo "4. Grant access to your forked repository: '${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}'."
        echo "5. After creating the connection, copy its name (e.g., 'gh-yourname-con')."
        prompt "Paste the Cloud Build Connection Name here:"
        read -p "   Connection Name: " GITHUB_CONN_NAME
        sed -i.bak "s/github_conn_name = \".*\"/github_conn_name = \"$GITHUB_CONN_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"; cd ..
        write_state "GITHUB_CONN_NAME" "$GITHUB_CONN_NAME"
    fi
    
    warn "\nTerraform cannot accept legal terms on your behalf."
    info "Please perform this one-time manual step for Firebase:"
    echo "1. Open this URL in your browser:"; echo -e "   ${C_YELLOW}https://console.firebase.google.com/?project=${GCP_PROJECT_ID}${C_RESET}"
    echo "2. You should be prompted to 'Add Firebase' to your existing project."
    echo "3. Follow the prompts and accept the terms."
    prompt "Press [Enter] to continue after you have linked the project."
    read
    rm -f "$ENV_DIR"/*.bak
}

run_terraform() {
    step 7 "Deploying Infrastructure with Terraform"
    info "Navigating to $REPO_ROOT/infra/$ENV_DIR..."
    cd "$REPO_ROOT/infra/$ENV_DIR"
    
    info "Initializing Terraform..."
    terraform init -reconfigure
    
    info "Planning Terraform changes..."
    terraform plan -var-file="$TFVARS_FILE" -parallelism=30
    
    prompt "\nTerraform is ready to apply the changes. This will create all the required infrastructure and may take several minutes."
    prompt "Do you want to proceed with 'terraform apply'? (y/n)"
    read -r REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        warn "Apply cancelled. You can run 'terraform apply -var-file=$TFVARS_FILE' manually later."; return
    fi
    
    terraform apply -auto-approve -var-file="$TFVARS_FILE" -parallelism=30
    cd ../..
}

update_secrets() {
    step 8 "Updating Secrets"
    info "Terraform has created the secret 'shells'. You will now be prompted to provide the actual secret values."
    cd "infra/$ENV_DIR"
    chmod +x ../../update_secrets.sh
    chmod +x ./update_secrets.sh
    ./update_secrets.sh
}

trigger_builds() {
    step 9 "Triggering Initial Builds"
    cd "$REPO_ROOT"
    prompt "Would you like to trigger the initial builds for the frontend and backend now? (y/n)"
    read -r REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "You can trigger the builds manually later by pushing a commit or via the Cloud Build UI."; return
    fi
    
    info "Triggering backend build..."
    gcloud builds triggers run "${BE_SERVICE_NAME}-trigger" --branch="$GITHUB_BRANCH" --project="$GCP_PROJECT_ID"
    
    info "Triggering frontend build..."
    gcloud builds triggers run "${FE_SERVICE_NAME}-trigger" --branch="$GITHUB_BRANCH" --project="$GCP_PROJECT_ID"
    
    success "Builds have been triggered."
    info "You can monitor their progress in the Cloud Build console:"
    echo -e "   ${C_YELLOW}https://console.cloud.google.com/cloud-build/builds?project=${GCP_PROJECT_ID}${C_RESET}"
}

# --- Main Execution ---
main() {
    echo -e "${C_GREEN}=====================================================${C_RESET}"
    echo -e "${C_GREEN} Welcome to the Creative Studio Infrastructure Setup ${C_RESET}"
    echo -e "${C_GREEN}=====================================================${C_RESET}"
    
    # This logic allows resuming from a specific environment if the script is run again.
    prompt "Are you resuming a previous installation? (y/n)"
    read -r REPLY
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        prompt "Please enter the full local path to your cloned repository:"
        read -p "   Local Path: " REPO_ROOT
        if [[ ! -d "$REPO_ROOT/.git" ]]; then fail "The path you provided does not appear to be a valid git repository."; fi
        export REPO_ROOT

        prompt "Please enter the environment name you were setting up (e.g., dev):"
        read -p "   Environment Name: " ENV_NAME
        STATE_FILE="$REPO_ROOT/infra/environments/$ENV_NAME/.bootstrap_state"
        if [[ ! -f "$STATE_FILE" ]]; then fail "Could not find a state file at the specified location. Cannot resume."; fi

    fi
    read_state

    LAST_COMPLETED_STEP=${LAST_COMPLETED_STEP:-0}

    if (( LAST_COMPLETED_STEP < 1 )); then check_prerequisites; write_state "LAST_COMPLETED_STEP" 1; fi
    if (( LAST_COMPLETED_STEP < 2 )); then check_and_install_terraform; write_state "LAST_COMPLETED_STEP" 2; fi
    if (( LAST_COMPLETED_STEP < 3 )); then setup_project; write_state "LAST_COMPLETED_STEP" 3; fi
    if (( LAST_COMPLETED_STEP < 4 )); then setup_repo; write_state "LAST_COMPLETED_STEP" 4; fi
    if (( LAST_COMPLETED_STEP < 5 )); then configure_environment; write_state "LAST_COMPLETED_STEP" 5; fi
    if (( LAST_COMPLETED_STEP < 6 )); then handle_manual_steps; write_state "LAST_COMPLETED_STEP" 6; fi
    if (( LAST_COMPLETED_STEP < 7 )); then run_terraform; write_state "LAST_COMPLETED_STEP" 7; fi
    if (( LAST_COMPLETED_STEP < 8 )); then update_secrets; write_state "LAST_COMPLETED_STEP" 8; fi
    if (( LAST_COMPLETED_STEP < 9 )); then trigger_builds; write_state "LAST_COMPLETED_STEP" 9; fi

    step 10 "🎉 Deployment Complete! 🎉"
    info "Fetching your application URLs..."
    FRONTEND_URL=$(cd "infra/environments/$ENV_NAME" && terraform output -raw frontend_service_url)
    BACKEND_URL=$(cd "infra/environments/$ENV_NAME" && terraform output -raw backend_service_url)

    success "Your infrastructure is ready."
    echo "------------------------------------------------------------------"
    echo -e "   Frontend URL: ${C_YELLOW}${FRONTEND_URL}${C_RESET}"
    echo -e "   Backend URL:  ${C_YELLOW}${BACKEND_URL}${C_RESET}"
    echo "------------------------------------------------------------------"
    info "It may take a few minutes for the builds to complete and the services to become available."
}

main "$@"
