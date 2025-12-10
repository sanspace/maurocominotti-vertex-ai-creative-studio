# infra/modules/backend/main.tf

# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "7.12.0"
    }
  }
}

provider "google" {
  # Configuration options
}

# --- Service Accounts ---
resource "google_service_account" "run_sa" {
  account_id   = "${var.resource_prefix}-${var.environment}-run"
  display_name = "SA for ${var.service_name} (${var.environment}) Runtime"
}

resource "google_service_account" "trigger_sa" {
  account_id   = "${var.resource_prefix}-${var.environment}-trig"
  display_name = "Build Trigger SA for ${var.service_name}"
}

# --- Artifact Registry (Preserved) ---
resource "google_artifact_registry_repository" "repo" {
  location      = var.gcp_region
  repository_id = "${var.resource_prefix}-${var.environment}-repo"
  description   = "Docker repository for ${var.service_name}"
  format        = "DOCKER"
}

# --- Cloud Run Service (The App) ---
resource "google_cloud_run_v2_service" "this" {
  name     = var.service_name
  location = var.gcp_region
  custom_audiences = var.custom_audiences
  deletion_protection = false

  template {
    service_account = google_service_account.run_sa.email

    # 1. SQL Connection Sidecar (Conditional)
    dynamic "volumes" {
      for_each = var.use_sql ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [var.cloudsql_instance_connection_name]
        }
      }
    }

    containers {
      image = var.image_url # Default placeholder if not built yet

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      # 2. SQL Environment Variables (Conditional)
      dynamic "env" {
        for_each = var.use_sql ? [1] : []
        content {
          name  = "DATABASE_URL"
          value = "postgresql+asyncpg://${var.db_user}:$(DB_PASSWORD)@/${var.db_name}?host=/cloudsql/${var.cloudsql_instance_connection_name}"
        }
      }
      dynamic "env" {
        for_each = var.use_sql ? [1] : []
        content {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = var.db_password_secret_id
              version = "latest"
            }
          }
        }
      }

      # 3. Firestore Environment Variables (Conditional)
      dynamic "env" {
        for_each = var.use_sql ? [] : [1]
        content {
          name  = "FIRESTORE_DB_NAME"
          value = "(default)"
        }
      }

      # 4. Standard Env Vars (CORS, etc.)
      env {
        name  = "ALLOWED_ORIGINS"
        value = join(",", var.cors_allowed_origins)
      }

      # 5. Runtime Secrets (Client Config, etc.)
      dynamic "env" {
        for_each = var.runtime_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # 6. Manual Env Vars
      dynamic "env" {
        for_each = var.container_env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }
    scaling {
      min_instance_count = var.scaling_min_instances
      max_instance_count = var.scaling_max_instances
    }
  }
}

# --- Cloud Run Job (The Seeder) ---
# This is new. It reuses the same image/config but runs a "job" command.
resource "google_cloud_run_v2_job" "seed_job" {
  name     = "${var.service_name}-seed"
  location = var.gcp_region

  template {
    template {
      service_account = google_service_account.run_sa.email
      
      # Reuse Volume Logic
      dynamic "volumes" {
        for_each = var.use_sql ? [1] : []
        content {
          name = "cloudsql"
          cloud_sql_instance { instances = [var.cloudsql_instance_connection_name] }
        }
      }

      containers {
        image = var.image_url
        
        # The Command: SQL=Alembic, NoSQL=Python Script
        command = var.use_sql ? ["alembic", "upgrade", "head"] : ["python", "scripts/seed_firestore.py"]
        
        # Reuse Env Logic (Copy-paste the dynamic blocks from Service above)
        dynamic "env" {
          for_each = var.use_sql ? [1] : []
          content {
            name  = "DATABASE_URL"
            value = "postgresql+asyncpg://${var.db_user}:$(DB_PASSWORD)@/${var.db_name}?host=/cloudsql/${var.cloudsql_instance_connection_name}"
          }
        }
        dynamic "env" {
          for_each = var.use_sql ? [1] : []
          content {
            name = "DB_PASSWORD"
            value_source {
              secret_key_ref { secret = var.db_password_secret_id; version = "latest" }
            }
          }
        }
        # ... (Include other necessary env vars) ...
      }
    }
  }
}

# --- Build Trigger (Preserved) ---
resource "google_cloudbuild_trigger" "this" {
  name            = "${var.service_name}-trigger"
  location        = var.gcp_region
  service_account = google_service_account.trigger_sa.id
  filename        = var.cloudbuild_yaml_path
  
  substitutions = merge(var.build_substitutions, {
    _REPO_NAME = google_artifact_registry_repository.repo.name
    _SERVICE_NAME = google_cloud_run_v2_service.this.name
    _REGION       = var.gcp_region
  })

  repository_event_config {
    repository = var.source_repository_id
    push {
      branch = "^${var.github_branch_name}$"
    }
  }
  included_files = var.included_files_glob
}

# --- IAM Bindings (Preserved & Cleaned) ---
resource "google_project_iam_member" "logging" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.trigger_sa.email}"
}

resource "google_artifact_registry_repository_iam_member" "writer" {
  location   = var.gcp_region
  repository = google_artifact_registry_repository.repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.trigger_sa.email}"
}

resource "google_cloud_run_v2_service_iam_member" "developer" {
  name     = google_cloud_run_v2_service.this.name
  location = google_cloud_run_v2_service.this.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.trigger_sa.email}"
}

resource "google_project_iam_member" "sa_user" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.trigger_sa.email}"
}

resource "google_project_iam_member" "aiplatform_user_binding" {
  project = var.gcp_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

resource "google_project_iam_member" "storage_object_admin_binding" {
  project = var.gcp_project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

resource "google_project_iam_member" "firestore_developer_binding" {
  count   = var.use_sql ? 0 : 1
  project = var.gcp_project_id
  role    = "roles/firebase.developAdmin"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}


# Conditional IAM for Firestore (Only needed if use_sql = false)
resource "google_project_iam_member" "firestore_admin" {
  count   = var.use_sql ? 0 : 1
  project = var.gcp_project_id
  role    = "roles/datastore.user" # Modern role for Firestore
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

resource "google_project_iam_member" "sa_token_creator_binding" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

# IAM for Secret Manager (Critical for pulling passwords)
resource "google_project_iam_member" "secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}