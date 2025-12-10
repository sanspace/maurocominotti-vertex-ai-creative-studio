output "service_url" {
  value = google_cloud_run_v2_service.this.uri
}

output "repo_url" {
  value = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.repo.name}"
}

output "trigger_sa_email" {
  description = "The email of the service account used by the build trigger."
  value       = google_service_account.trigger_sa.email
}

output "service_name" {
  description = "The name of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.name
}

output "location" {
  description = "The location of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.location
}

