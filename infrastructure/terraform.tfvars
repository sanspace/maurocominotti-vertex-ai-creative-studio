# terraform.tfvars
# -----------------------------------------------------------------
# This file provides values for the variables defined in variables.tf.
# Replace the placeholder values with your specific project details.
# DO NOT COMMIT THIS FILE to version control.
# -----------------------------------------------------------------

# [REQUIRED] Your Google Cloud Project ID.
gcp_project_id = "dojo-creativestudio"

# [OPTIONAL] The GCP region. Overrides the default "us-central1".
gcp_region = "us-central1"

# [OPTIONAL] The name for your Cloud Run service and related resources.
service_name = "backend-service"

# [OPTIONAL] GitHub repository details.
github_repo_owner  = "sanspace"
github_repo_name   = "maurocominotti-vertex-ai-creative-studio"
github_branch_name = "feat/infra"
