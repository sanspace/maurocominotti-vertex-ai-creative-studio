import {Template, MediaType} from './template.model';

// A hardcoded list of templates for demonstration purposes
export const TEMPLATES: Template[] = [
  {
    id: 'ikea-1',
    name: 'IKEA Room Assembly',
    description: 'A magical time-lapse of an empty room building itself.',
    media_type: MediaType.VIDEO,
    industry: 'Home Goods',
    brand: 'IKEA',
    tags: ['assembly', 'furniture', 'stop-motion', 'minimalist'],
    thumbnail_uri: 'https://placehold.co/600x400/E5E4E2/000000?text=IKEA',
    gcs_uri: 'gs://your-bucket/ikea-video.mp4',
    generation_parameters: {
      prompt:
        'Cinematic shot of a sunlit Scandinavian bedroom. A sealed IKEA box trembles, opens, and flat pack furniture assembles rapidly into a serene, styled room.',
      style: 'Cinematic',
      aspect_ratio: '16:9',
      model: 'Veo',
    },
  },
  {
    id: 'rolex-1',
    name: 'Rolex: Precision in Motion',
    description: 'The iconic Rolex logo deconstructs and reassembles into a watch.',
    media_type: MediaType.VIDEO,
    industry: 'Luxury Goods',
    brand: 'Rolex',
    tags: ['luxury', 'watch', 'mechanical', 'elegant', '3D animation'],
    thumbnail_uri: 'https://placehold.co/600x400/004225/FFFFFF?text=Rolex',
    gcs_uri: 'gs://your-bucket/rolex-video.mp4',
    generation_parameters: {
      prompt:
        'In a sleek black studio, the golden Rolex crown logo deconstructs into mechanical parts that elegantly reassemble into a finished timepiece.',
      style: 'Photorealistic',
      aspect_ratio: '16:9',
      model: 'Veo',
    },
  },
  {
    id: 'jeep-1',
    name: 'Jeep Adventure Unboxed',
    description:
      'A rugged crate unfolds in the desert to reveal a Jeep at a basecamp.',
    media_type: MediaType.VIDEO,
    industry: 'Automotive',
    brand: 'Jeep',
    tags: ['adventure', 'off-road', 'desert', 'rugged', 'reveal'],
    thumbnail_uri: 'https://placehold.co/600x400/4F5D2F/FFFFFF?text=Jeep',
    gcs_uri: 'gs://your-bucket/jeep-video.mp4',
    generation_parameters: {
      prompt:
        'Golden hour in a Moab desert canyon, a mechanical crate unfolds to reveal a mud-splattered Jeep Wrangler Rubicon at an adventure-ready basecamp.',
      style: 'Cinematic',
      lighting: 'Golden Hour',
      aspect_ratio: '16:9',
      model: 'Veo',
    },
  },
  {
    id: 'snickers-1',
    name: 'Snickers: Desk Chaos',
    description: 'A perfectly neat desk is thrown into chaos by hunger.',
    media_type: MediaType.IMAGE,
    industry: 'Food & Beverage',
    brand: 'Snickers',
    tags: ['funny', 'office', 'hunger', 'satisfying'],
    thumbnail_uri:
      'https://placehold.co/600x400/4E3629/FFFFFF?text=Snickers',
    gcs_uri: 'gs://your-bucket/snickers-image.png',
    generation_parameters: {
      prompt:
        'Top-down flat-lay view of an organized desk. A hand struggles to open a Snickers, causing chaos. After a bite, the desk magically becomes neat again.',
      style: 'Photorealistic',
      composition: 'Flat Lay',
      aspect_ratio: '1:1',
      model: 'Imagen 3',
    },
  },
  {
    id: 'mandms-1',
    name: "M&M's Color Weavers",
    description: 'The M&M’s characters bring color to a black and white world.',
    media_type: MediaType.IMAGE,
    industry: 'Food & Beverage',
    brand: "M&M's",
    tags: ['colorful', 'magical', 'fun', 'transformation'],
    thumbnail_uri: 'https://placehold.co/600x400/367E46/FFFFFF?text=M%26M\'s',
    gcs_uri: 'gs://your-bucket/mandms-image.png',
    generation_parameters: {
      prompt:
        'In a black and white world, the Red M&M character bites into a grey flower, causing an explosion of red that colors the entire scene.',
      style: 'Fantasy Art',
      color_and_tone: 'Vibrant and Contrasting',
      aspect_ratio: '16:9',
      model: 'Imagen 3',
    },
  },
];

// Automatically derive the list of unique industries from the templates
export const INDUSTRIES = [
  ...new Set(TEMPLATES.map(template => template.industry)),
].sort();
