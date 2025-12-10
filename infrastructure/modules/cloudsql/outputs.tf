# infra/modules/cloudsql/outputs.tf

output "instance_connection_name" {
  description = "The Cloud SQL Instance Connection Name (project:region:instance)"
  value       = google_sql_database_instance.main.connection_name
}

output "db_password_secret_id" {
  description = "The Secret Manager Secret ID containing the generated password"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "db_name" {
  description = "The database name"
  value       = google_sql_database.app_db.name
}

output "db_user" {
  description = "The database username"
  value       = google_sql_user.app_user.name
}

# Helper output if you need to debug connection issues
output "public_ip_address" {
  description = "The public IP address of the instance"
  value       = google_sql_database_instance.main.public_ip_address
}
