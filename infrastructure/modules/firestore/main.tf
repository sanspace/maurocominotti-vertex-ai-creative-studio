terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0" }
  }
}

resource "google_project_service" "firestore" {
  project            = var.project_id
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_firestore_database" "default" {
  project       = var.gcp_project_id
  name          = "${var.firebase_db_name}-${var.environment}"
  location_id   = var.gcp_region

  # IMPORTANT: This choice is permanent for the project.
  # Choose FIRESTORE_NATIVE for modern applications.
  type          = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}

# --- Firestore Indexes ---

# Index for: media_library by user_email, created_at
resource "google_firestore_index" "media_library_user_email" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "user_email"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by mime_type, created_at
resource "google_firestore_index" "media_library_mime_type" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "mime_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by model, created_at
resource "google_firestore_index" "media_library_model" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "model"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by status, created_at
resource "google_firestore_index" "media_library_status" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by workspace_id, user_email, created_at
resource "google_firestore_index" "media_library_workspace_email_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "user_email"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by workspace_id, mime_type, created_at
resource "google_firestore_index" "media_library_workspace_mime_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "mime_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by workspace_id, model, created_at
resource "google_firestore_index" "media_library_workspace_model_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "model"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by workspace_id, status, created_at
resource "google_firestore_index" "media_library_workspace_status_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: media_library by workspace_id, created_at, __name__
resource "google_firestore_index" "media_library_workspace_created___name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "media_library"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# For Users

# Index for: users by role, created_at
resource "google_firestore_index" "users_role" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "users"

  fields {
    field_path = "role"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: users by email, created_at
resource "google_firestore_index" "users_email" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "users"

  fields {
    field_path = "email"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}


# --- NEW INDEXES FOR source_assets ---

# Index for: source_assets by user_id, file_hash
resource "google_firestore_index" "source_assets_user_hash" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "file_hash"
    order      = "ASCENDING"
  }
}

# Index for: source_assets by user_id, created_at
resource "google_firestore_index" "source_assets_user_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by user_id, mime_type, created_at
resource "google_firestore_index" "source_assets_user_mime_created" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "mime_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by mime_type, created_at
resource "google_firestore_index" "source_assets_mime_type" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "mime_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by scope, asset_type
resource "google_firestore_index" "source_assets_scope_type" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "scope"
    order      = "ASCENDING"
  }
  fields {
    field_path = "asset_type"
    order      = "ASCENDING"
  }
}


# Index for: source_assets by created_at, original_filename
resource "google_firestore_index" "source_assets_created_ogfilename" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "original_filename"
    order      = "DESCENDING"
  }
}


# Index for: source_assets by user_id, scope, asset_type
resource "google_firestore_index" "source_assets_user_scope_type" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "scope"
    order      = "ASCENDING"
  }
  fields {
    field_path = "asset_type"
    order      = "ASCENDING"
  }
}

# Index for: source_assets by workspace_id, created_at, __name__
resource "google_firestore_index" "source_assets_ws_crtd_nme" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by asset_type, user_id, created_at, __name__
resource "google_firestore_index" "source_assets_asset_usrid_crtd_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "asset_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by workspace_id, created_at, __name__
resource "google_firestore_index" "source_assets_user_mime_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "mime_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}

# Index for: source_assets by workspace_id, created_at, __name__
resource "google_firestore_index" "source_assets_user_crtd_mime_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "mime_type"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by scope, created_at, __name__
resource "google_firestore_index" "source_assets_scope_crtd_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "scope"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# Index for: source_assets by asset_type, created_at, __name__
resource "google_firestore_index" "source_assets_assettype_crtd_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "source_assets"

  fields {
    field_path = "asset_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# --- END OF NEW source_assets INDEXES ---

# BRAND GUIDELINES INDEXES
# Index for: source_assets by workspace_id, created_at, __name__
resource "google_firestore_index" "brand_guidelines_wrkid_created_name" {
  project    = var.gcp_project_id
  database   = google_firestore_database.default.name
  collection = "brand_guidelines"

  fields {
    field_path = "workspace_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

# Output the database name for the backend to use
output "database_name" {
  value = google_firestore_database.database.name
}
