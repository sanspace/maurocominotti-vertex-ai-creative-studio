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
REQUIRED_TERRAFORM_VERSION="1.13.0"
UPSTREAM_REPO_URL="https://github.com/MauroCominotti/maurocominotti-vertex-ai-creative-studio"
TEMPLATE_ENV_DIR="environments/dev-infra-example"
DEFAULT_ENV_NAME="dev-infra"
DEFAULT_BRANCH_NAME="main"
GCS_BUCKET_SUFFIX_FORMAT="cstudio-%s-tfstate"
GCS_BUCKET_PREFIX_FORMAT="infra/%s/state"
DEFAULT_BE_SERVICE_NAME_FORMAT="cstudio-be-%s"
DEFAULT_FE_SERVICE_NAME_FORMAT="cstudio-fe-%s"

# --- Color Definitions ---
C_RESET='\033[0m'; C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_CYAN='\033[0;36m'

# --- Helper Functions ---
info() { echo -e "${C_CYAN}➡️  $1${C_RESET}"; }
prompt() { echo -e "${C_BLUE}🤔 $1${C_RESET}"; }
warn() { echo -e "${C_YELLOW}⚠️  $1${C_RESET}"; }
fail() { echo -e "${C_RED}❌ $1${C_RESET}" >&2; exit 1; }
success() { echo -e "${C_GREEN}✅ $1${C_RESET}"; }
step() { echo -e "\n${C_BLUE}--- Step $1: $2 ---${C_RESET}"; }

# A reusable function to prompt for a value and update the .tfvars file
prompt_and_update_tfvar() {
    local prompt_text=$1
    local default_value=$2
    local tfvar_name=$3
    local var_to_set_ref=$4
    
    read -p "   $prompt_text [default value: $default_value]: " user_input < /dev/tty
    local final_value=${user_input:-$default_value}
    
    sed -i.bak "s/$tfvar_name = \".*\"/$tfvar_name = \"$final_value\"/g" "$TFVARS_FILE"
    
    # Set the variable in the script's global scope
    eval "$var_to_set_ref='$final_value'"
}

# --- State Management ---
STATE_FILE="" 
REPO_ROOT=""
write_state() {
    if [ -z "$STATE_FILE" ]; then return; fi
    touch "$STATE_FILE"
    TMP_STATE_FILE=$(mktemp)
    grep -v "^$1=" "$STATE_FILE" > "$TMP_STATE_FILE" || true
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
        prompt "Would you like to try and install it now? (y/n)"; read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            warn "This may require sudo privileges."
            if command -v apt-get &>/dev/null; then sudo apt-get update && sudo apt-get install -y jq
            elif command -v brew &>/dev/null; then brew install jq
            elif command -v yum &>/dev/null; then sudo yum install -y jq
            else fail "Cannot automatically install jq on this OS. Please install it manually and run again."
            fi
        else fail "Please install jq and run this script again."
        fi
    fi
    success "Prerequisites met."
}

get_platform_arch() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;; aarch64) ARCH="arm64" ;; arm64) ARCH="arm64" ;;
    esac
    echo "${OS}_${ARCH}"
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
    warn "Terraform is missing or outdated. The required version ($REQUIRED_TERRAFORM_VERSION) will be installed now."
    PLATFORM_ARCH=$(get_platform_arch)
    TF_ZIP_FILENAME="terraform_${REQUIRED_TERRAFORM_VERSION}_${PLATFORM_ARCH}.zip"
    TF_DOWNLOAD_URL="https://releases.hashicorp.com/terraform/${REQUIRED_TERRAFORM_VERSION}/${TF_ZIP_FILENAME}"
    info "Downloading Terraform for your platform (${PLATFORM_ARCH})..."
    curl -Lo terraform.zip "$TF_DOWNLOAD_URL"
    unzip -o terraform.zip
    info "Installing Terraform into the persistent ~/bin directory..."
    mkdir -p "$HOME/bin"
    mv terraform "$HOME/bin/"
    if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc; then
        info "Adding ~/bin to your PATH in ~/.bashrc for future sessions..."
        echo -e '\n# Add local bin to PATH\nexport PATH="$HOME/bin:$PATH"' >> ~/.bashrc
    fi
    export PATH="$HOME/bin:$PATH"
    hash -r
    rm terraform.zip LICENSE.txt
    if command -v terraform &> /dev/null && [[ "$(terraform version -json | jq -r .terraform_version)" == "$REQUIRED_TERRAFORM_VERSION" ]]; then
        success "Terraform v$(terraform -version | head -n 1) is now active."
    else
        fail "Terraform installation failed. Please open a new terminal and run this script again."
    fi
}

setup_project() {
    step 3 "Configuring Google Cloud Project"

    # try detecting current project on the current terminal
    CURRENT_GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")

    if [ -n "$GCP_PROJECT_ID" ]; then
        prompt "Found project '$GCP_PROJECT_ID' from a previous run. Use this project? (y/n)"; read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            gcloud config set project "$GCP_PROJECT_ID"
            success "Project '$GCP_PROJECT_ID' is configured."
            return
        fi
    elif [ -n "$CURRENT_GCLOUD_PROJECT" ]; then
        prompt "Detected active gcloud project '$CURRENT_GCLOUD_PROJECT'. Use this project? (y/n)"
        read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            GCP_PROJECT_ID=$CURRENT_GCLOUD_PROJECT
            info "Using existing project '$GCP_PROJECT_ID'."
            gcloud config set project "$GCP_PROJECT_ID"
            success "Project '$GCP_PROJECT_ID' is configured."
            return
        fi
    fi
    prompt "Do you already have a Google Cloud Project to use? (y/n)"; read -r REPLY < /dev/tty
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        prompt "Please enter your existing Google Cloud Project ID:"; read -p "   Project ID: " GCP_PROJECT_ID < /dev/tty
    else
        prompt "What is the desired new Google Cloud Project ID? (e.g., my-creative-studio)"; read -p "   Project ID: " GCP_PROJECT_ID < /dev/tty
        prompt "What is your Google Cloud Billing Account ID? (Find it with 'gcloud beta billing accounts list')"; read -p "   Billing Account ID: " BILLING_ACCOUNT_ID < /dev/tty
        info "Creating project '$GCP_PROJECT_ID'..."; gcloud projects create "$GCP_PROJECT_ID" || warn "Project '$GCP_PROJECT_ID' may already exist. Continuing..."
        info "Linking billing account '$BILLING_ACCOUNT_ID'..."; gcloud beta billing projects link "$GCP_PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
    fi
    info "Setting gcloud config to use project '$GCP_PROJECT_ID'..."; gcloud config set project "$GCP_PROJECT_ID"
    success "Project '$GCP_PROJECT_ID' is configured."
}

setup_repo() {
    step 4 "Configuring Git Repository"
    if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        REPO_ROOT=$(git rev-parse --show-toplevel)
        prompt "Use the current repository at '$REPO_ROOT'? (y/n)"; read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$REPO_ROOT"; info "Current directory set to repository root."
        else
            fail "Please re-run the script from outside a Git repository to clone a new one."
        fi
    else
        warn "Please fork the repository at ${UPSTREAM_REPO_URL}/fork first."
        while true; do
            prompt "What is the git URL of YOUR forked repository? (e.g., https://github.com/user/repo.git)"; read -p "   Git URL: " GITHUB_REPO_URL < /dev/tty
            info "Validating repository URL..."; if git ls-remote --exit-code -h "$GITHUB_REPO_URL" > /dev/null 2>&1; then success "Repository found."; break; else warn "Repository not found at that URL. Please check for typos and try again."; fi
        done
        REPO_NAME=$(basename "$GITHUB_REPO_URL" .git)
        if [[ -d "$REPO_NAME" ]]; then
            warn "Directory '$REPO_NAME' already exists."; prompt "Use this existing directory? (y/n)"; read -r REPLY < /dev/tty
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then fail "Please remove the directory or choose a different location and restart the script."; fi
            cd "$REPO_NAME"
        else
            info "Cloning a lightweight copy of the '$DEFAULT_BRANCH_NAME' branch..."; git clone --single-branch --branch "$DEFAULT_BRANCH_NAME" --depth=1 "$GITHUB_REPO_URL"; cd "$REPO_NAME"; success "Repository cloned successfully."
        fi
    fi
    REPO_ROOT=$(git rev-parse --show-toplevel); export REPO_ROOT
    GITHUB_REPO_OWNER=$(git remote get-url origin | sed -n 's/.*github.com\/\(.*\)\/.*/\1/p'); GITHUB_REPO_NAME=$(basename "$REPO_ROOT")
    info "Detected GitHub owner: $GITHUB_REPO_OWNER"; info "Detected GitHub repo name: $GITHUB_REPO_NAME"
}

configure_environment() {
    step 5 "Configuring Terraform Environment"
    cd "$REPO_ROOT/infra"
    if [ -z "$ENV_NAME" ]; then
        prompt "What would you like to call this deployment environment?";
        read -p "   Environment Name [default value: $DEFAULT_ENV_NAME]: " ENV_NAME < /dev/tty
        ENV_NAME=${ENV_NAME:-$DEFAULT_ENV_NAME}
    else
        info "Using previously configured environment: $ENV_NAME"
    fi
    ENV_DIR="environments/$ENV_NAME"; 
    TFVARS_FILE="$ENV_DIR/$ENV_NAME.tfvars"; 
    STATE_FILE="$ENV_DIR/.bootstrap_state";
    read_state
    if [ ! -d "$ENV_DIR" ]; then
        info "Creating new environment directory from template: $TEMPLATE_ENV_DIR";
        cp -r "$TEMPLATE_ENV_DIR" "$ENV_DIR"
        prompt "Do you have an existing GCS bucket for Terraform state? (y/n)";
        read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            prompt "Please enter the name of your GCS bucket:"; read -p "   Bucket Name: " BUCKET_NAME < /dev/tty
        else
            BUCKET_SUFFIX=$(printf "$GCS_BUCKET_SUFFIX_FORMAT" "$ENV_NAME");
            BUCKET_NAME="${GCP_PROJECT_ID}-${BUCKET_SUFFIX}"
            info "Creating GCS bucket '$BUCKET_NAME' for Terraform state...";
            gsutil mb -p "$GCP_PROJECT_ID" "gs://${BUCKET_NAME}" || warn "Bucket 'gs://${BUCKET_NAME}' may already exist. Continuing..."
        fi
        BUCKET_PREFIX=$(printf "$GCS_BUCKET_PREFIX_FORMAT" "$ENV_NAME")
        prompt "What prefix should be used inside the bucket?";
        read -p "   Prefix [default value: $BUCKET_PREFIX]: " BUCKET_PREFIX_INPUT < /dev/tty;
        BUCKET_PREFIX=${BUCKET_PREFIX_INPUT:-$BUCKET_PREFIX}
        info "Updating backend.tf..."; echo "terraform {
  backend \"gcs\" {
    bucket = \"$BUCKET_NAME\"
    prefix = \"$BUCKET_PREFIX\"
  }
}" > "$ENV_DIR/backend.tf"
        info "Updating $TFVARS_FILE..."; mv "$ENV_DIR/dev.tfvars" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/gcp_project_id = \".*\"/gcp_project_id = \"$GCP_PROJECT_ID\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/github_repo_owner = \".*\"/github_repo_owner = \"$GITHUB_REPO_OWNER\"/g" "$ENV_DIR/$TFVARS_FILE"
        sed -i.bak "s/github_repo_name = \".*\"/github_repo_name = \"$GITHUB_REPO_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"
        prompt "Please provide the following values:"
        prompt_and_update_tfvar "Backend Service Name" "$(printf "$DEFAULT_BE_SERVICE_NAME_FORMAT" "$ENV_NAME")" "backend_service_name" "BE_SERVICE_NAME"
        prompt_and_update_tfvar "Frontend Service Name" "$(printf "$DEFAULT_FE_SERVICE_NAME_FORMAT" "$ENV_NAME")" "frontend_service_name" "FE_SERVICE_NAME"
        prompt_and_update_tfvar "GitHub Branch to deploy from" "$DEFAULT_BRANCH_NAME" "github_branch_name" "GITHUB_BRANCH"
        write_state "ENV_NAME" "$ENV_NAME"; write_state "BE_SERVICE_NAME" "$BE_SERVICE_NAME"; write_state "FE_SERVICE_NAME" "$FE_SERVICE_NAME"; write_state "GITHUB_BRANCH" "$GITHUB_BRANCH"
    else
        info "Environment directory '$ENV_DIR' already configured."
    fi
    success "Configuration files for '$ENV_NAME' environment are ready."
}

handle_manual_steps() {
    step 6 "Manual Steps Required"; cd "$REPO_ROOT/infra"
    info "Enabling Cloud Build and Secret Manager APIs..."; gcloud services enable cloudbuild.googleapis.com secretmanager.googleapis.com --project="$GCP_PROJECT_ID"
    if [ -z "$GITHUB_CONN_NAME" ]; then
        prompt "\nDo you already have a Cloud Build Host Connection for GitHub in this project? (y/n)"; read -r REPLY < /dev/tty
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            prompt "Please enter the existing connection name:"; read -p "   Connection Name: " GITHUB_CONN_NAME < /dev/tty
        else
            warn "You will now be guided to create a new GitHub connection."; info "Please perform the following manual steps:"
            echo "1. Open this URL in your browser:"; echo -e "   ${C_YELLOW}https://console.cloud.google.com/cloud-build/connections/create?project=${GCP_PROJECT_ID}${C_RESET}"
            echo "2. Select 'GitHub (Cloud Build GitHub App)' and click 'CONTINUE'."
            echo "3. Follow the prompts to authorize the app on your GitHub account."; echo "4. Grant access to your forked repository: '${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}'."
            echo "5. After creating the connection, copy its name (e.g., 'gh-yourname-con')."
            prompt "Paste the new Cloud Build Connection Name here:"; read -p "   Connection Name: " GITHUB_CONN_NAME < /dev/tty
        fi
        sed -i.bak "s/github_conn_name = \".*\"/github_conn_name = \"$GITHUB_CONN_NAME\"/g" "$ENV_DIR/$TFVARS_FILE"
        write_state "GITHUB_CONN_NAME" "$GITHUB_CONN_NAME"
    fi
    warn "\nTerraform cannot accept legal terms on your behalf."; info "Please perform this one-time manual step for Firebase:"
    echo "1. Open this URL in your browser:"; echo -e "   ${C_YELLOW}https://console.firebase.google.com/?project=${GCP_PROJECT_ID}${C_RESET}"
    echo "2. You should be prompted to 'Add Firebase' to your existing project."; echo "3. Follow the prompts and accept the terms."
    prompt "Press [Enter] to continue after you have linked the project."; read -r < /dev/tty
    rm -f "$ENV_DIR"/*.bak
}

run_terraform() {
    step 7 "Deploying Infrastructure with Terraform"; info "Navigating to $REPO_ROOT/infra/$ENV_DIR..."; cd "$REPO_ROOT/infra/$ENV_DIR"
    info "Initializing Terraform..."; terraform init -reconfigure
    info "Planning Terraform changes..."; terraform plan -var-file="$TFVARS_FILE" -parallelism=30
    prompt "\nTerraform is ready to apply the changes. This will create all the required infrastructure and may take several minutes."; prompt "Do you want to proceed with 'terraform apply'? (y/n)"; read -r REPLY < /dev/tty
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then warn "Apply cancelled. You can run 'terraform apply -var-file=$TFVARS_FILE' manually later."; return; fi
    terraform apply -auto-approve -var-file="$TFVARS_FILE" -parallelism=30
}

update_secrets() {
    step 8 "Updating Secrets"; info "Navigating to $REPO_ROOT/infra/$ENV_DIR..."; cd "$REPO_ROOT/infra/$ENV_DIR"
    info "Terraform has created the secret 'shells'. You will now be prompted to provide the actual secret values."
    chmod +x ./update_secrets.sh; ./update_secrets.sh
}

trigger_builds() {
    step 9 "Triggering Initial Builds"; cd "$REPO_ROOT"
    prompt "Would you like to trigger the initial builds for the frontend and backend now? (y/n)"; read -r REPLY < /dev/tty
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then info "You can trigger the builds manually later by pushing a commit or via the Cloud Build UI."; return; fi
    info "Triggering backend build..."; gcloud builds triggers run "${BE_SERVICE_NAME}-trigger" --branch="$GITHUB_BRANCH" --project="$GCP_PROJECT_ID"
    info "Triggering frontend build..."; gcloud builds triggers run "${FE_SERVICE_NAME}-trigger" --branch="$GITHUB_BRANCH" --project="$GCP_PROJECT_ID"
    success "Builds have been triggered."; info "You can monitor their progress in the Cloud Build console:"
    echo -e "   ${C_YELLOW}https://console.cloud.google.com/cloud-build/builds?project=${GCP_PROJECT_ID}${C_RESET}"
}

# --- Main Execution ---
main() {
    echo -e "${C_GREEN}=====================================================${C_RESET}"
    echo -e "${C_GREEN} Welcome to the Creative Studio Infrastructure Setup ${C_RESET}"
    echo -e "${C_GREEN}=====================================================${C_RESET}"
    prompt "Are you resuming a previous installation? (y/n)"; read -r REPLY < /dev/tty
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        prompt "Please enter the full local path to your cloned repository:"; read -p "   Local Path: " REPO_ROOT < /dev/tty
        if [[ ! -d "$REPO_ROOT/.git" ]]; then fail "The path you provided does not appear to be a valid git repository."; fi
        export REPO_ROOT
        prompt "Please enter the environment name you were setting up:"; read -p "   Environment Name: " ENV_NAME < /dev/tty
        STATE_FILE="$REPO_ROOT/infra/environments/$ENV_NAME/.bootstrap_state"
        if [[ ! -f "$STATE_FILE" ]]; then fail "Could not find a state file at the specified location."; fi
    fi
    read_state
    LAST_COMPLETED_STEP=${LAST_COMPLETED_STEP:-0}

    # Define the sequence of steps
    declare -a steps_to_run=(
        "check_prerequisites" 
        "check_and_install_terraform" 
        "setup_project" 
        "setup_repo" 
        "configure_environment" 
        "handle_manual_steps" 
        "run_terraform" 
        "update_secrets" 
        "trigger_builds"
    )
    
    # Execute steps in order, starting from the last completed step
    for i in "${!steps_to_run[@]}"; do
        step_num=$((i + 1))
        if (( LAST_COMPLETED_STEP < step_num )); then
            ${steps_to_run[$i]}
            write_state "LAST_COMPLETED_STEP" "$step_num"
        fi
    done

    step 10 "🎉 Deployment Complete! 🎉"
    info "Fetching your application URLs..."; cd "$REPO_ROOT/infra/environments/$ENV_NAME"
    FRONTEND_URL=$(terraform output -raw frontend_service_url)
    BACKEND_URL=$(terraform output -raw backend_service_url)
    success "Your infrastructure is ready."
    echo "------------------------------------------------------------------"
    echo -e "   Frontend URL: ${C_YELLOW}${FRONTEND_URL}${C_RESET}"
    echo -e "   Backend URL:  ${C_YELLOW}${BACKEND_URL}${C_RESET}"
    echo "------------------------------------------------------------------"
    info "It may take a few minutes for the builds to complete and the services to become available."
}

main "$@"
