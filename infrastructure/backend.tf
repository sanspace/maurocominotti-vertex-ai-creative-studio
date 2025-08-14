# backend.tf

locals {
  # Short prefix for backend resources to avoid character limits
  be_prefix = "cs-be"

  region_code = join("", [for s in split("-", var.gcp_region) : substr(s, 0, 1)])

  # Construct the predictable URLs
  frontend_url = "https://${var.frontend_service_name}--${var.gcp_project_id}-${local.region_code}.run.app"

  # Merge backend-specific and common environment variables
  backend_container_env_vars = merge(
    lookup(var.env_vars, "common", {}),
    {
      # The frontend URL is now passed in. It will be blank on the first apply.
      #   "CORS_ORIGINS"     = "[\"${google_cloud_run_v2_service.frontend_service.uri}\"]"
      "CORS_ORIGINS"     = "[${local.frontend_url}]"
      "GENMEDIA_BUCKET"  = google_storage_bucket.genmedia.name
      "SIGNING_SA_EMAIL" = google_service_account.bucket_reader_sa.email
      "PROJECT_ID"       = var.gcp_project_id
    }
  )

  terraform_runner_iam_member = endswith(data.google_client_openid_userinfo.me.email, ".iam.gserviceaccount.com") ? "serviceAccount:${data.google_client_openid_userinfo.me.email}" : "user:${data.google_client_openid_userinfo.me.email}"
  cloudbuild_sa               = "${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

resource "google_storage_bucket" "genmedia" {
  name                        = "${var.gcp_project_id}-${local.be_prefix}-${var.environment}-bucket"
  location                    = var.gcp_region
  uniform_bucket_level_access = true
  force_destroy               = true # Set to false for production
  depends_on                  = [google_project_service.apis]
}


# --- Backend Service Accounts ---

resource "google_service_account" "backend_run_sa" {
  account_id   = "${local.be_prefix}-${var.environment}-run"
  display_name = "SA for ${var.backend_service_name} (${var.environment}) Runtime"
}

resource "google_service_account" "backend_trigger_sa" {
  account_id   = "${local.be_prefix}-${var.environment}-trig"
  display_name = "SA for ${var.backend_service_name} (${var.environment}) Trigger"
}

resource "google_service_account" "bucket_reader_sa" {
  account_id   = "${local.be_prefix}-${var.environment}-read"
  display_name = "SA for reading GenMedia (${var.environment}) bucket"
}


# --- Backend Resources ---

resource "google_artifact_registry_repository" "backend_repo" {
  location      = var.gcp_region
  repository_id = "${local.be_prefix}-${var.environment}-repo"
  description   = "Docker repository for ${var.backend_service_name} (${var.environment})"
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
  name     = var.backend_service_name
  location = var.gcp_region

  template {
    service_account = google_service_account.backend_run_sa.email
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest" # Placeholder image
      resources {
        limits = {
          cpu    = "1000m"
          memory = "1024Mi"
        }
      }
      dynamic "env" {
        for_each = local.backend_container_env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloudbuild_trigger" "backend_trigger" {
  name            = "${local.be_prefix}-trigger"
  location        = var.gcp_region
  description     = "Trigger for ${var.backend_service_name} changes"
  filename        = "backend/cloudbuild.yaml"
  service_account = google_service_account.backend_trigger_sa.id

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

# --- Backend IAM ---

# Grant the new SA Object Viewer role on the new bucket
resource "google_storage_bucket_iam_member" "bucket_viewer_binding" {
  bucket = google_storage_bucket.genmedia.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.bucket_reader_sa.email}"
}

# Grant the Terraform runner identity Token Creator role on the new SA
resource "google_service_account_iam_member" "token_creator_binding" {
  service_account_id = google_service_account.bucket_reader_sa.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.terraform_runner_iam_member
}

# Grant the Trigger SA permission to write to Cloud Logging
resource "google_project_iam_member" "logging_writer_binding" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.backend_trigger_sa.email}"

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
  service_account_id = google_service_account.backend_run_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.backend_trigger_sa.email}"
  depends_on         = [google_project_service.apis]
}

# Grant the Cloud Run SA the AI Platform User role
resource "google_project_iam_member" "aiplatform_user_binding" {
  project = var.gcp_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.backend_run_sa.email}"
}

# Grant the Cloud Run SA the Storage Object Admin role
resource "google_project_iam_member" "storage_object_admin_binding" {
  project = var.gcp_project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.backend_run_sa.email}"
}





# (All your existing IAM bindings for the backend go here)
# Just rename the resources for clarity (e.g., backend_logging_writer_binding)
# and ensure they point to the correct backend service accounts.