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

export enum MimeType {
  IMAGE = 'image/png',
  VIDEO = 'video/mp4',
}

// These would likely be enums in a real app, but using strings for simplicity
export type Style = string;
export type AspectRatio = string;
export type Lighting = string;

// The parameters that can be passed to the generator
export interface GenerationParameters {
  prompt?: string;
  original_prompt?: string;
  model?: string;
  aspect_ratio?: AspectRatio;
  style?: Style;
  lighting?: Lighting;
  color_and_tone?: string;
  composition?: string;
  negative_prompt?: string;
}

export interface Template {
  id: string; // Unique identifier for the template
  name: string;
  description: string;
  mime_type: MimeType;
  industry: string;
  brand?: string;
  tags: string[];
  thumbnail_uris: string[];
  presigned_urls: string[]; // The full video/image GCS URI
  generation_parameters: GenerationParameters; // All generator settings bundled
}

export interface TemplateFilter {
  industry: string | null;
  mediaType: MimeType | null;
  tags: string | null;
  model: string | null;
  name: string | null;
}
