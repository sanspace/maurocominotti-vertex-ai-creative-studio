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

export enum IndustryEnum {
  TECHNOLOGY = 'Technology',
  ART_AND_DESIGN = 'Art & Design',
  FASHION_AND_APPAREL = 'Fashion & Apparel',
  LUXURY_GOODS = 'Luxury Goods',
  ENTERTAINMENT = 'Entertainment',
  FOOD_AND_BEVERAGE = 'Food & Beverage',
  HOME_APPLIANCES = 'Home Appliances',
  AUTOMOTIVE = 'Automotive',
  PET_SUPPLIES = 'Pet Supplies',
  OTHER = 'Other',
}

// These would likely be enums in a real app, but using strings for simplicity
export type Style = string;
export type AspectRatio = string;
export type Lighting = string;

// The parameters that can be passed to the generator
export interface GenerationParameters {
  prompt?: string;
  originalPrompt?: string;
  model?: string;
  aspectRatio?: AspectRatio;
  style?: Style;
  lighting?: Lighting;
  colorAndTone?: string;
  composition?: string;
  negativePrompt?: string;
  numMedia?: number;
  durationSeconds?: number;
}

export interface Template {
  id: string; // Unique identifier for the template
  name: string;
  description: string;
  mimeType: MimeType;
  industry: IndustryEnum;
  brand?: string;
  tags: string[];
  thumbnailUris?: string[];
  presignedUrls: string[]; // The full video/image GCS URI
  generationParameters: GenerationParameters; // All generator settings bundled
}

export interface TemplateFilter {
  industry: string | null;
  mediaType: MimeType | null;
  tags: string | null;
  model: string | null;
  name: string | null;
}
