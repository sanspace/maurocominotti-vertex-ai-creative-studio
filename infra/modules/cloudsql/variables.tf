# infra/modules/cloudsql/variables.tf

variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "env_name" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env_name)
    error_message = "The env_name value must be dev, staging, or prod."
  }
}

variable "tier" {
  description = "Database instance tier (e.g., db-f1-micro, db-custom-1-3840)"
  type        = string
  default     = "db-f1-micro"

  validation {
    condition     = can(regex("^db-", var.tier))
    error_message = "The tier must start with 'db-', e.g., 'db-f1-micro'."
  }
}

variable "deletion_protection" {
  description = "Whether to prevent the instance from being destroyed by Terraform"
  type        = bool
  default     = false
}

variable "db_name" {
  description = "The name of the application database to create"
  type        = string
  default     = "cstudio_db"
}

variable "db_user_name" {
  description = "The name of the application database user"
  type        = string
  default     = "cstudio_user"
}
