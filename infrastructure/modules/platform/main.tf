variable "use_sql" {
  description = "If true, deploys Cloud SQL. If false, deploys Firestore."
  type        = bool
  default     = true
}

# -------------------------------------------------------------
# 1. DATA TIER (Mutually Exclusive)
# -------------------------------------------------------------

module "cloudsql" {
  source   = "../cloudsql"
  count    = var.use_sql ? 1 : 0 # Only create if use_sql is true

  project_id = var.project_id
  region     = var.region
  env_name   = var.env_name
}

module "firestore" {
  source   = "../firestore"
  count    = var.use_sql ? 0 : 1 # Only create if use_sql is false

  project_id = var.project_id
  region     = var.region
  env_name   = var.env_name
}

# -------------------------------------------------------------
# 2. SECRETS (Shared)
# -------------------------------------------------------------
module "secrets" {
  source     = "../secrets"
  project_id = var.project_id
  app_config = module.frontend.firebase_client_config
}

# -------------------------------------------------------------
# 3. BACKEND (Conditional Wiring)
# -------------------------------------------------------------
module "backend" {
  source     = "../backend"
  project_id = var.project_id
  region     = var.region
  use_sql    = var.use_sql

  # Pass SQL outputs safely (using splat syntax because module might have count=0)
  cloudsql_instance_connection_name = var.use_sql ? module.cloudsql[0].instance_connection_name : ""
  db_password_secret_id             = var.use_sql ? module.cloudsql[0].db_password_secret_id : ""
  db_name                           = var.use_sql ? module.cloudsql[0].db_name : ""
  db_user                           = var.use_sql ? module.cloudsql[0].db_user : ""

  cors_allowed_origins    = local.frontend_origins
  client_config_secret_id = module.secrets.client_config_secret_id
}

# -------------------------------------------------------------
# 4. FRONTEND
# -------------------------------------------------------------
locals {
  frontend_origins = ["https://${var.project_id}.web.app", "https://${var.project_id}.firebaseapp.com"]
}

module "frontend" {
  source     = "../frontend"
  project_id = var.project_id
  env_name   = var.env_name
  
  # Handshake: Pass the backend URL to the frontend
  api_url = module.backend.service_url
}
