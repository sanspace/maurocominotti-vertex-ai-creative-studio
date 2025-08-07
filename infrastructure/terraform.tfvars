# terraform.tfvars
# -----------------------------------------------------------------
# This file provides values for the variables defined in variables.tf.
# Replace the placeholder values with your specific project details.
# DO NOT COMMIT THIS FILE to version control.
# -----------------------------------------------------------------

# [REQUIRED] Your Google Cloud Project ID.
gcp_project_id = "dojo-creativestudio"

apis_to_enable = [
  "serviceusage.googleapis.com",     # Required to enable other APIs
  "iam.googleapis.com",              # Required for IAM management
  "cloudbuild.googleapis.com",       # Required for Cloud Build
  "artifactregistry.googleapis.com", # Required for Artifact Registry
  "run.googleapis.com",              # Required for Cloud Run

  "cloudresourcemanager.googleapis.com",


  "compute.googleapis.com",
  "cloudfunctions.googleapis.com",
  "iamcredentials.googleapis.com",
  "aiplatform.googleapis.com",
]

# [OPTIONAL] The GCP region. Overrides the default "us-central1".
gcp_region = "us-central1"

# [OPTIONAL] The name for your Cloud Run service and related resources.
service_name = "backend-service" # TODO: creative-studio-backend 

env_vars = {
  # Keep the default common and development variables...
  common = {
    LOG_LEVEL = "INFO"
  }
  development = {
    FRONTEND_URL = "http://localhost:4200"
    CORS_ORIGINS = "[\"http://localhost:4200\",\"http://127.0.0.1:4200\"]"
    ENVIRONMENT  = "development"
  }
  # But override the production values with specific settings
  production = {
    FRONTEND_URL = "https://my-app.com"
    CORS_ORIGINS = "[\"https://my-app.com\"]"
    LOG_LEVEL    = "ERROR"
    API_KEY      = "prod_api_key_goes_here"
    ENVIRONMENT  = "production"
  }
}

environment = "development"

# [OPTIONAL] GitHub repository details.
github_repo_owner  = "sanspace"
github_repo_name   = "maurocominotti-vertex-ai-creative-studio"
github_branch_name = "feat/infra"
