# frontend.tf

locals {
  # Short prefix for frontend resources
  fe_prefix = "cs-fe"

  backend_url = "https://${var.backend_service_name}--${var.gcp_project_id}-${local.region_code}.run.app"

  frontend_container_env_vars = merge(
    lookup(var.fe_env_vars, "common", {}),
    {
      "BACKEND_URL" = local.backend_url
    }
  )
}

# --- Frontend Service Accounts ---

resource "google_service_account" "frontend_run_sa" {
  account_id   = "${local.fe_prefix}-${var.environment}-run"
  display_name = "SA for ${var.frontend_service_name} (${var.environment}) Runtime"
}

resource "google_service_account" "frontend_trigger_sa" {
  account_id   = "${local.fe_prefix}-${var.environment}-trig"
  display_name = "SA for ${var.frontend_service_name} (${var.environment}) Trigger"
}

# --- Frontend Resources ---

resource "google_artifact_registry_repository" "frontend_repo" {
  location      = var.gcp_region
  repository_id = "${local.fe_prefix}-${var.environment}-repo"
  description   = "Docker repository for ${var.frontend_service_name} (${var.environment})"
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

resource "google_cloud_run_v2_service" "frontend_service" {
  name     = var.frontend_service_name
  location = var.gcp_region

  template {
    service_account = google_service_account.frontend_run_sa.email
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest" # Placeholder image
      dynamic "env" {
        for_each = local.frontend_container_env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

resource "google_cloudbuild_trigger" "frontend_trigger" {
  name            = "${local.fe_prefix}-trigger"
  location        = var.gcp_region
  description     = "Trigger for ${var.frontend_service_name} changes"
  filename        = "frontend/cloudbuild.yaml"
  service_account = google_service_account.frontend_trigger_sa.id

  github {
    owner = var.github_repo_owner
    name  = var.github_repo_name
    push {
      branch = "^${var.github_branch_name}$"
    }
  }

  included_files = ["frontend/**"]

  depends_on = [google_project_service.apis]
}

# --- Frontend IAM ---

# Grant the Trigger SA permission to write to Cloud Logging
resource "google_project_iam_member" "fe_logging_writer_binding" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.frontend_trigger_sa.email}"

  depends_on = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "fe_ar_writer_binding" {
  location   = google_artifact_registry_repository.frontend_repo.location
  repository = google_artifact_registry_repository.frontend_repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.frontend_trigger_sa.email}"

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "fe_run_developer_binding" {
  name     = google_cloud_run_v2_service.frontend_service.name
  location = google_cloud_run_v2_service.frontend_service.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.frontend_trigger_sa.email}"

  depends_on = [google_project_service.apis]
}

resource "google_service_account_iam_member" "fe_run_sa_user_binding" {
  service_account_id = google_service_account.frontend_run_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.frontend_trigger_sa.email}"
  depends_on         = [google_project_service.apis]
}
