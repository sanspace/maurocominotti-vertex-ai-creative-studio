/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Represents a single media item, mirroring the Pydantic model from the backend.
 */
export interface MediaItem {
  id: string;
  user_email?: string;
  created_at?: string; // ISO 8601 date string
  updated_at?: string; // ISO 8601 date string

  // Common fields across media types
  prompt?: string;
  original_prompt?: string;
  rewritten_prompt?: string;
  num_media?: number;
  model?: string;
  mime_type?: string;
  generation_time?: number;
  error_message?: string;

  // URI and URL fields
  gcsuri?: string;
  gcs_uris: string[];
  source_images_gcs: string[];
  presigned_urls?: string[];
  presigned_thumbnail_urls?: string[];

  // Video specific
  aspect?: string; // Note: 'aspect' is used for video, 'aspect_ratio' for image
  duration?: number;
  reference_image?: string;
  last_reference_image?: string;
  enhanced_prompt_used?: boolean;
  comment?: string;

  // Image specific
  modifiers: string[];
  aspect_ratio?: string;
  style?: string;
  lighting?: string;
  color_and_tone?: string;
  composition?: string;
  negative_prompt?: string;
  seed?: number;
  critique?: string;
  add_watermark?: boolean;

  // Music specific
  audio_analysis?: Record<string, any>;

  // Debugging field
  raw_data?: Record<string, any>;
}

/**
 * Defines the response structure for a paginated gallery query,
 * mirroring the Pydantic model from the backend.
 */
export interface PaginatedGalleryResponse {
  items: MediaItem[];
  nextPageCursor: string | null;
}
