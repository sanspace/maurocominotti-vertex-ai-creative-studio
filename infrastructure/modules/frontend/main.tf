terraform {
  required_providers {
    google      = { source = "hashicorp/google", version = ">= 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = ">= 6.0" }
  }
}

# 1. Create the Firebase Web App
resource "google_firebase_web_app" "frontend" {
  provider     = google-beta
  project      = var.project_id
  display_name = "cstudio-fe-${var.env_name}"
}

# 2. Get the standard Firebase Config (API Keys, etc.)
data "google_firebase_web_app_config" "frontend_config" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.frontend.app_id
}

# 3. Construct the Runtime Configuration JSON
locals {
  app_config_json = jsonencode({
    firebase = {
      apiKey            = data.google_firebase_web_app_config.frontend_config.api_key
      authDomain        = data.google_firebase_web_app_config.frontend_config.auth_domain
      projectId         = var.project_id
      storageBucket     = data.google_firebase_web_app_config.frontend_config.storage_bucket
      messagingSenderId = data.google_firebase_web_app_config.frontend_config.messaging_sender_id
      appId             = google_firebase_web_app.frontend.app_id
    }
    api = {
      baseUrl = var.api_url # Injected from Backend Module
    }
  })
}

# 4. Upload config.json to Firebase Hosting
# Note: This assumes the default bucket exists.
resource "google_storage_bucket_object" "runtime_config" {
  name          = "assets/config.json"
  bucket        = "${var.project_id}.appspot.com" # Default Firebase bucket
  content       = local.app_config_json
  content_type  = "application/json"
  cache_control = "no-cache" # Important: Don't cache config!
}

# Export config for Secret Manager
output "firebase_client_config" {
  value = {
    apiKey    = data.google_firebase_web_app_config.frontend_config.api_key
    appId     = google_firebase_web_app.frontend.app_id
    projectId = var.project_id
  }
}
