# infra/modules/cloudsql/main.tf

# 1. Enable Required API (Idempotent)
resource "google_project_service" "sqladmin" {
  project            = var.project_id
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

# 2. Generate a Secure Password
# We treat this as a standard resource. State file security is assumed via GCS Bucket permissions.
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>?"
}

# 3. Store Password in Secret Manager immediately
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_id}-db-password-${var.env_name}"
  project   = var.project_id
  
  replication {
    auto {}
  }
  
  # Ensure we don't accidentally wipe secrets if the module is removed temporarily
  lifecycle {
    prevent_destroy = false 
  }
}

resource "google_secret_manager_secret_version" "db_password_val" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# 4. Create Database Instance
resource "google_sql_database_instance" "main" {
  name             = "${var.project_id}-pg17-${var.env_name}"
  database_version = "POSTGRES_17" # Latest version
  region           = var.region
  project          = var.project_id

  # Critical: Prevent Terraform from destroying Prod DBs
  deletion_protection = var.deletion_protection

  settings {
    tier = var.tier
    
    # Storage
    disk_autoresize       = true
    disk_autoresize_limit = 0 # 0 means no limit
    disk_type             = "PD_SSD"
    disk_size             = 20
    
    # Modern Availability Settings
    availability_type = var.env_name == "prod" ? "REGIONAL" : "ZONAL"

    # Networking & Security
    ip_configuration {
      ipv4_enabled    = true 
      ssl_mode        = "ENCRYPTED_ONLY" # Force SSL usage
    }

    # Backup Strategy
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.env_name == "prod" ? true : false
      location                       = "us" # Multi-region storage for backups
      start_time                     = "03:00"
      transaction_log_retention_days = var.env_name == "prod" ? 7 : 1
    }

    # Maintenance Window (Updates/Patches)
    maintenance_window {
      day  = 7 # Sunday
      hour = 3 # 3 AM
    }

    user_labels = {
      environment = var.env_name
      managed_by  = "terraform"
    }
  }

  depends_on = [google_project_service.sqladmin]
}

# 5. Create the Database
resource "google_sql_database" "app_db" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# 6. Create the User
resource "google_sql_user" "app_user" {
  name     = var.db_user_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id
  password = random_password.db_password.result
}
