export enum MimeTypeEnum {
  IMAGE_PNG = 'image/png',
  VIDEO_MP4 = 'video/mp4',
  AUDIO_MPEG = 'audio/mpeg',
}

export enum IndustryEnum {
  AUTOMOTIVE = 'Automotive',
  CONSUMER_GOODS = 'Consumer Goods',
  ART_AND_DESIGN = 'Art & Design',
  ENTERTAINMENT = 'Entertainment',
  HOME_APPLIANCES = 'Home Appliances',
  FASHION_AND_APPAREL = 'Fashion & Apparel',
  FOOD_AND_BEVERAGE = 'Food & Beverage',
  HEALTH_AND_WELLNESS = 'Health & Wellness',
  LUXURY_GOODS = 'Luxury Goods',
  TECHNOLOGY = 'Technology',
  TRAVEL_AND_HOSPITALITY = 'Travel & Hospitality',
  PET_SUPPLIES = 'Pet Supplies',
  OTHER = 'Other',
}

export interface GenerationParameters {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  style?: string;
  lighting?: string;
  colorAndTone?: string;
  composition?: string;
  negativePrompt?: string;
}

export interface MediaTemplate {
  id: string;
  name: string;
  description: string;
  mimeType: MimeTypeEnum;
  industry?: IndustryEnum;
  brand?: string;
  tags?: string[];
  gcsUris: string[];
  thumbnailUris?: string[];
  generationParameters: GenerationParameters;
}
