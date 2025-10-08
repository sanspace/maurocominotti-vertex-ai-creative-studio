variable "gcp_project_id" {
  type        = string
  description = "The GCP Project ID to deploy resources into."
}

variable "gcp_region" {
  type        = string
  description = "The GCP region for the resources."
  default     = "us-central1"
}

# --- List of APIs to enable ---
variable "apis_to_enable" {
  type        = list(string)
  description = "A list of Google Cloud APIs to enable on the project."
  default = [
    "serviceusage.googleapis.com",     # Required to enable other APIs
    "iam.googleapis.com",              # Required for IAM management
    "cloudbuild.googleapis.com",       # Required for Cloud Build
    "artifactregistry.googleapis.com", # Required for Artifact Registry
    "run.googleapis.com"               # Required for Cloud Run
  ]
}

variable "backend_service_name" {
  type        = string
  description = "The name of the backend service."
  default     = "creative-studio-backend"
}

variable "backend_custom_audiences" {
  type        = list(string)
  description = "The custom audiences the backend service."
  default     = []
}

variable "frontend_custom_audiences" {
  type        = list(string)
  description = "The custom audiences the frontend service."
  default     = []
}

variable "frontend_service_name" {
  type        = string
  description = "The name of the frontend service."
  default     = "creative-studio"
}



variable "github_conn_name" {
  type        = string
  description = "The owner of the GitHub repository."
  default     = "gh-mauro-con"
}

variable "github_repo_owner" {
  type        = string
  description = "The owner of the GitHub repository."
  default     = "sanspace"
}

variable "github_repo_name" {
  type        = string
  description = "The name of the GitHub repository."
  default     = "maurocominotti-vertex-ai-creative-studio"
}

variable "github_branch_name" {
  type        = string
  description = "The branch name to trigger builds from."
  default     = "feature/add-angular-and-fastapi"
}

variable "environment" {
  description = "The deployment environment (e.g., 'development', 'staging', 'production')."
  type        = string
  default     = "development"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "The environment must be either 'development', 'staging' or 'production'."
  }
}

variable "be_env_vars" {
  description = "A map of environment variables for different deployment environments."
  type        = map(map(string))
  default = {
    common = {
      LOG_LEVEL = "INFO"
    }
    development = {
      FRONTEND_URL = "http://localhost:4200"
      CORS_ORIGINS = "[\"http://localhost:4200\",\"http://127.0.0.1:4200\"]"
    }
    production = {
      FRONTEND_URL = "https://your-production-frontend.com"
      CORS_ORIGINS = "[\"https://your-production-frontend.com\"]"
      LOG_LEVEL    = "WARN"
    }
  }
}

variable "fe_env_vars" {
  description = "A map of environment variables for different deployment environments."
  type        = map(map(string))
  default = {
    common = {
      LOG_LEVEL = "INFO"
    }
    development = {
      BACKEND_URL = "http://localhost:4200"

    }
    production = {
      BACKEND_URL = "https://your-production-frontend.com"
      LOG_LEVEL   = "WARN"
    }
  }
}

