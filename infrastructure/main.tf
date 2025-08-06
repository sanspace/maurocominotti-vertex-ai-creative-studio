# main.tf

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "6.47.0"
    }
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

locals {
  artifact_repo_id = "${var.service_name}-repo"
  cloudbuild_sa    = "${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

resource "google_service_account" "cloudrun_sa" {
  account_id   = "${var.service_name}-run-sa"
  display_name = "Service Account for ${var.service_name}"

  # Explicitly depend on the API enablement
  depends_on = [google_project_service.apis]
}

resource "google_service_account" "cloudbuild_trigger_sa" {
  account_id   = "${var.service_name}-trigger-sa"
  display_name = "Service Account for ${var.service_name} Trigger"
  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository" "backend_repo" {
  location      = var.gcp_region
  repository_id = local.artifact_repo_id
  description   = "Docker repository for ${var.service_name}"
  format        = "DOCKER"
  cleanup_policies {
    id     = "delete-untagged-images"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "backend_service" {
  name     = var.service_name
  location = var.gcp_region

  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun_sa.email
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest"
    }
  }

  depends_on = [google_project_service.apis]
}


resource "google_cloudbuildv2_repository" "backend_repo_source" {
  provider = google-beta
  name     = var.github_repo_name
  location = var.gcp_region
  parent_connection = "projects/${var.gcp_project_id}/locations/${var.gcp_region}/connections/gh-cstudio"
  remote_uri = "https://github.com/${var.github_repo_owner}/${var.github_repo_name}.git"
}

resource "google_cloudbuild_trigger" "backend_trigger" {
  name        = "${var.service_name}-trigger"
  location    = var.gcp_region
  description = "Trigger for ${var.service_name} changes"
  filename    = "backend/cloudbuild.yaml"
  service_account = google_service_account.cloudbuild_trigger_sa.id

  github {
    owner = var.github_repo_owner
    name  = var.github_repo_name
    push {
      branch = "^${var.github_branch_name}$"
    }
  }

  included_files = ["backend/**"]

  depends_on = [google_project_service.apis]
}

# --- IAM Permissions: All IAM resources also depend on API enablement ---

# Grant the Trigger SA permission to write to Cloud Logging
resource "google_project_iam_member" "logging_writer_binding" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloudbuild_trigger_sa.email}"

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "ar_writer_binding" {
  location   = google_artifact_registry_repository.backend_repo.location
  repository = google_artifact_registry_repository.backend_repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${local.cloudbuild_sa}"

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "run_developer_binding" {
  name     = google_cloud_run_v2_service.backend_service.name
  location = google_cloud_run_v2_service.backend_service.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${local.cloudbuild_sa}"

  depends_on = [google_project_service.apis]
}

resource "google_service_account_iam_member" "run_sa_user_binding" {
  service_account_id = google_service_account.cloudrun_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cloudbuild_trigger_sa.email}"
  depends_on         = [google_project_service.apis]
}

# resource "google_cloud_run_v2_service_iam_member" "allow_unauthenticated" {
#   name     = google_cloud_run_v2_service.backend_service.name
#   location = google_cloud_run_v2_service.backend_service.location
#   role     = "roles/run.invoker"
#   member   = "allUsers"

#   depends_on = [google_project_service.apis]
# }