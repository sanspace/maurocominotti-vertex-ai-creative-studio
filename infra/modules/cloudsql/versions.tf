# infra/modules/cloudsql/versions.tf

terraform {
  required_version = ">= 1.9.0" # Ensures support for modern validation/preconditions

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0" # Version 6.0+ is recommended for latest Postgres features
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }
}
