# main.tf

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.47.0"
    }
  }

  backend "gcs" {
    bucket  = "cstudio-dev-tfstate"
    prefix  = "devpipeline/terraform/state"
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

locals {
  region_code   = join("", [for s in split("-", var.gcp_region) : substr(s, 0, 1)])
  cloudbuild_sa = "${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# --- Enable the required Google Cloud APIs ---
resource "google_project_service" "apis" {
  # Use a for_each loop to enable each API from the variable list
  for_each = toset(var.apis_to_enable)

  project = var.gcp_project_id
  service = each.key

  # This prevents Terraform from disabling APIs when you run `terraform destroy`
  disable_on_destroy = false
}

data "google_project" "project" {}





resource "google_cloudbuildv2_repository" "backend_repo_source" {
  provider          = google-beta
  name              = var.github_repo_name
  location          = var.gcp_region
  parent_connection = "projects/${var.gcp_project_id}/locations/${var.gcp_region}/connections/${var.github_conn_name}"
  remote_uri        = "https://github.com/${var.github_repo_owner}/${var.github_repo_name}.git"
}














