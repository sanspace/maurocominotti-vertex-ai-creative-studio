import {Template, MimeType} from './template.model';

const localPath = 'assets/media_templates/';

// A hardcoded list of templates for demonstration purposes
export const TEMPLATES: Template[] = [
  {
    id: 'rolex-local',
    name: 'Rolex Showcase',
    description: 'A showcase of Rolex video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Luxury Goods',
    brand: 'Rolex',
    tags: ['luxury', 'watch', 'elegant'],
    thumbnail_uris: [
      'https://placehold.co/600x400/004225/FFFFFF?text=Rolex+1',
      'https://placehold.co/600x400/004225/FFFFFF?text=Rolex+2',
    ],
    presigned_urls: [
      `${localPath}rolex_1_template.mp4`,
      `${localPath}rolex_2_template.mp4`,
    ],
    generation_parameters: {
      prompt: 'A generated video for Rolex.',
      model: 'Veo',
    },
  },
  {
    id: 'dyson-local',
    name: 'Dyson Technology',
    description: 'A showcase of Dyson video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Home Appliances',
    brand: 'Dyson',
    tags: ['technology', 'vacuum', 'innovative'],
    thumbnail_uris: ['https://placehold.co/600x400/5A5AAA/FFFFFF?text=Dyson'],
    presigned_urls: [`${localPath}dyson_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Dyson.',
      model: 'Veo',
    },
  },
  {
    id: 'apple-local',
    name: 'Apple Products',
    description: 'A showcase of Apple video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Technology',
    brand: 'Apple',
    tags: ['tech', 'iphone', 'macbook'],
    thumbnail_uris: ['https://placehold.co/600x400/A3AAAE/000000?text=Apple'],
    presigned_urls: [`${localPath}apple_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Apple.',
      model: 'Veo',
    },
  },
  {
    id: 'ikea-local',
    name: 'IKEA Home',
    description: 'A showcase of IKEA video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Home Goods',
    brand: 'IKEA',
    tags: ['furniture', 'home', 'scandinavian'],
    thumbnail_uris: [
      'https://placehold.co/600x400/FFDB00/0051BA?text=IKEA+1',
      'https://placehold.co/600x400/FFDB00/0051BA?text=IKEA+2',
    ],
    presigned_urls: [
      `${localPath}ikea_1_template.mp4`,
      `${localPath}cymball_ikea_1_template.mp4`,
    ],
    generation_parameters: {
      prompt: 'A generated video for IKEA.',
      model: 'Veo',
    },
  },
  {
    id: 'maserati-local',
    name: 'Maserati Drive',
    description: 'A showcase of Maserati video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Automotive',
    brand: 'Maserati',
    tags: ['luxury car', 'sports car', 'italian'],
    thumbnail_uris: [
      'https://placehold.co/600x400/0C2340/FFFFFF?text=Maserati',
    ],
    presigned_urls: [`${localPath}maserati_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Maserati.',
      model: 'Veo',
    },
  },
  {
    id: 'jeep-local',
    name: 'Jeep Adventure',
    description: 'A showcase of Jeep video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Automotive',
    brand: 'Jeep',
    tags: ['off-road', 'adventure', '4x4'],
    thumbnail_uris: ['https://placehold.co/600x400/000000/FFFFFF?text=Jeep'],
    presigned_urls: [`${localPath}jeep_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Jeep.',
      model: 'Veo',
    },
  },
  {
    id: 'tesla-local',
    name: 'Tesla Electric',
    description: 'A showcase of Tesla video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Automotive',
    brand: 'Tesla',
    tags: ['electric car', 'ev', 'sustainable'],
    thumbnail_uris: ['https://placehold.co/600x400/CC0000/FFFFFF?text=Tesla'],
    presigned_urls: [`${localPath}tesla_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Tesla.',
      model: 'Veo',
    },
  },
  {
    id: 'chewy-local',
    name: 'Chewy Pets',
    description: 'A showcase of Chewy video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Pet Supplies',
    brand: 'Chewy',
    tags: ['pets', 'dogs', 'cats'],
    thumbnail_uris: ['https://placehold.co/600x400/00A9E0/FFFFFF?text=Chewy'],
    presigned_urls: [`${localPath}chewy_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Chewy.',
      model: 'Veo',
    },
  },
  {
    id: 'lv-local',
    name: 'Louis Vuitton Style',
    description: 'A showcase of Louis Vuitton video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Luxury Goods',
    brand: 'Louis Vuitton',
    tags: ['fashion', 'luxury', 'handbag'],
    thumbnail_uris: ['https://placehold.co/600x400/7B5B4D/FFFFFF?text=LV'],
    presigned_urls: [`${localPath}lv_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Louis Vuitton.',
      model: 'Veo',
    },
  },
  {
    id: 'corona-local',
    name: 'Corona Beach',
    description: 'A showcase of Corona video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Food & Beverage',
    brand: 'Corona',
    tags: ['beer', 'beach', 'summer'],
    thumbnail_uris: ['https://placehold.co/600x400/00529B/FFFFFF?text=Corona'],
    presigned_urls: [`${localPath}corona_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Corona.',
      model: 'Veo',
    },
  },
  {
    id: 'snickers-local',
    name: 'Snickers Break',
    description: 'A showcase of Snickers video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Food & Beverage',
    brand: 'Snickers',
    tags: ['chocolate', 'snack', 'hungry'],
    thumbnail_uris: [
      'https://placehold.co/600x400/4E3629/FFFFFF?text=Snickers',
    ],
    presigned_urls: [`${localPath}snickers_1_template.mp4`],
    generation_parameters: {
      prompt: 'A generated video for Snickers.',
      model: 'Veo',
    },
  },
  {
    id: 'mandms-local',
    name: "M&M's Fun",
    description: "A showcase of M&M's video templates.",
    mime_type: MimeType.VIDEO,
    industry: 'Food & Beverage',
    brand: "M&M's",
    tags: ['candy', 'colorful', 'fun'],
    thumbnail_uris: [
      'https://placehold.co/600x400/367E46/FFFFFF?text=M%26M+1',
      'https://placehold.co/600x400/367E46/FFFFFF?text=M%26M+2',
    ],
    presigned_urls: [
      `${localPath}mym_1_template.mp4`,
      `${localPath}mym_2_template.mp4`,
    ],
    generation_parameters: {
      prompt: "A generated video for M&M's.",
      model: 'Veo',
    },
  },
  {
    id: 'whiskas-local',
    name: 'Whiskas Cats',
    description: 'A showcase of Whiskas video templates.',
    mime_type: MimeType.VIDEO,
    industry: 'Pet Supplies',
    brand: 'Whiskas',
    tags: ['cat food', 'pets', 'feline'],
    thumbnail_uris: [
      'https://placehold.co/600x400/4D2C7A/FFFFFF?text=Whiskas+1',
      'https://placehold.co/600x400/4D2C7A/FFFFFF?text=Whiskas+2',
    ],
    presigned_urls: [
      `${localPath}whiskas_1_template.mp4`,
      `${localPath}whiskas_2_template.mp4`,
    ],
    generation_parameters: {
      prompt: 'A generated video for Whiskas.',
      model: 'Veo',
    },
  },
];

// Automatically derive the list of unique industries from the templates
export const INDUSTRIES = [
  ...new Set(TEMPLATES.map(template => template.industry)),
].sort();
