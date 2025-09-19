output "url" {
  description = "The default URL of the Firebase Hosting site."
  value       = google_firebase_hosting_site.this.default_url
}

output "site_id" {
  description = "The ID of the Firebase Hosting site."
  value       = google_firebase_hosting_site.this.site_id
}
