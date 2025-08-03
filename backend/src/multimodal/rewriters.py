# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

RANDOM_PROMPT_TEMPLATE = "Generate a single, random, creative, and visually descriptive prompt suitable for an AI image generator. The prompt should be concise and evocative. {}"


MUSIC_REWRITER = """You're a music producer and critic with a keen ear for describing musical qualities and soundscapes. If you're given audio, describe it. If you're given an idea or a scenario, describe the music that would represent that. Aim for a single paragraph description of musical direction and optionally any explanation of your direction. As a rule, don't refer to any particular artist, but instead describe their style.

"""

VIDEO_REWRITER = """Please follow this style of text prompt: ‘This close-up shot of a Victoria crowned pigeon showcases its striking blue plumage and red chest. Its crest is made of delicate, lacy feathers, while its eye is a striking red color. The bird’s head is tilted slightly to the side, giving the impression of it looking regal and majestic. The background is blurred, drawing attention to the bird’s striking appearance’ ‘Animated scene features a close-up of a short fluffy monster kneeling beside a melting red candle. The art style is 3D and realistic, with a focus on lighting and texture. The mood of the painting is one of wonder and curiosity, as the monster gazes at the flame with wide eyes and open mouth. Its pose and expression convey a sense of innocence and playfulness, as if it is exploring the world around it for the first time. The use of warm colors and dramatic lighting further enhances the cozy atmosphere of the image.’ ‘Drone view of waves crashing against the rugged cliffs along Big Sur’s gray point beach. The crashing blue waters create white-tipped waves, while the golden light of the setting sun illuminates the rocky shore. A small island with a lighthouse sits in the distance, and green shrubbery covers the cliff’s edge. The steep drop from the road down to the beach is a dramatic feat, with the cliff’s edges jutting out over the sea. This is a view that captures the raw beauty of the coast and the rugged landscape of the Pacific Coast Highway.’ ‘Several giant wooly mammoths approach treading through a snowy meadow, their long wooly fur lightly blows in the wind as they walk, snow covered trees and dramatic snow capped mountains in the distance, mid afternoon light with wispy clouds and a sun high in the distance creates a warm glow, the low camera view is stunning capturing the large furry mammal with beautiful photography, depth of field.’‘A candid shot captures a blond 6-year-old girl strolling down a bustling city street. The warm glow of the summer sunset bathes her in golden light, casting long shadows that stretch across the pavement. The girl's hair shimmers like spun gold, her eyes sparkle with wonder as she takes in the sights and sounds around her. The blurred background of vibrant shop windows and hurrying pedestrians emphasizes her innocence and carefree spirit. The low angle of the shot adds a sense of grandeur, elevating the ordinary moment into an award-winning photograph.’ ‘A close-up shot of a man made entirely of glass riding the New York City subway. Sunlight refracts through his translucent form, casting a rainbow of colors on the nearby seats. His expression is serene, his eyes fixed on the passing cityscape reflected in the subway window. The other passengers, a mix of ages and ethnicities, sit perfectly still, their eyes wide with a mixture of fascination and fear. The carriage is silent, the only sound the rhythmic clickety-clack of the train on the tracks.’ ‘Close-up cinematic shot of a man in a crisp white suit, bathed in the warm glow of an orange neon sign. He sits at a dimly lit bar, swirling a glass of amber liquid, his face a mask of quiet contemplation and hidden sorrow. The shallow depth of field draws attention to the weariness in his eyes and the lines etched around his mouth, while the bar's interior fades into a soft bokeh of orange neon and polished wood.’ ‘This close-up shot follows a queen as she ascends the steps of a candlelit throne room. The warm glow of the candlelight illuminates her regal bearing and the intricate details of her jeweled crown, the light dancing on the jewels as she moves. She turns her head, the wisdom in her eyes and the strength in her jawline becoming more prominent. The background blurs as she continues her ascent, the tapestries and gilded furniture a testament to her power and authority.’ ‘Cinematic shot of a man dressed in a weathered green trench coat, bathed in the eerie glow of a green neon sign. He leans against a gritty brick wall with a payphone, clutching a black rotary phone to his ear, his face etched with a mixture of urgency and desperation. The shallow depth of field focuses sharply on his furrowed brow and the tension in his jaw, while the background street scene blurs into a sea of neon colors and indistinct shadows.’
but write a new prompt with this topic, based on the above style:
{}
Don't generate images, just write text.

"""


MAGAZINE_EDITOR_PROMPT = """

You're a friendly visual magazine editor who loves AI generated images with Imagen, Google's latest image generation model whose quality exceeds all leading external competitors in aesthetics, defect-free, and text image alignment. You are always friendly and positive and not shy to provide critiques with delightfully cheeky, clever streak. You've been presented with these images for your thoughts.

The prompt used by the author to create these images was: "{}"

Create a few sentence critique and commentary (3-4 sentences) complimenting each these images individually and together, paying special attention to quality of each image such calling out anything you notice in these following areas:
* Alignment with prompt - how well each image mached the given text prompt
* Photorealism - how closely the image resembles the type of image requested to be generated
* Detail - the level of detail and overall clarity
* Defects - any visible artifacts, distortions, or errors

Include aesthetic qualities (come up with a score). Include commentary on color, tone, subject, lighting, and composition. You may address the author as "you."

For each image, provide a critique in the following format:

**Image <image number>:**
<critique>

"""


REWRITER_PROMPT = """Write a prompt for a text-to-image model following the style of the examples of prompts, and then I will give you a prompt that I want you to rewrite.

Examples of prompts:

A close-up of a sleek Siamese cat perched regally, in front of a deep purple background, in a high-resolution photograph with fine details and color grading.
Flat vector illustration of "Breathe deep" hand-lettering with floral and leaf decorations. Bright colors, simple lines, and a cute, minimalist design on a white background.
Long exposure photograph of rocks and sea, long shot of cloudy skies, golden hour at the rocky shore with reflections in the water. High resolution.
Three women stand together laughing, with one woman slightly out of focus in the foreground. The sun is setting behind the women, creating a lens flare and a warm glow that highlights their hair and creates a bokeh effect in the background. The photography style is candid and captures a genuine moment of connection and happiness between friends. The warm light of golden hour lends a nostalgic and intimate feel to the image.
A group of five friends are standing together outdoors with tall gray mountains in the background. One woman is wearing a black and white striped top and is laughing with her hand on her mouth. The man next to her is wearing a blue and green plaid shirt, khaki shorts, and a camera around his neck, he is laughing and has his arm around another man who is bent over laughing wearing a gray shirt and black pants with a camera around his neck. Behind them, a blonde woman with sunglasses on her head and wearing a beige top and red backpack is laughing and pushing the man in the gray shirt.
An elderly woman with gray hair is sitting on a park bench next to a medium-sized brown and white dog, with the sun setting behind them, creating a warm orange glow and lens flare. She is wearing a straw sun hat and a pink patterned jacket and has a peaceful expression as she looks off into the distance.
A woman with blonde hair wearing sunglasses stands amidst a dazzling display of golden bokeh lights. Strands of lights and crystals partially obscure her face, and her sunglasses reflect the lights. The light is low and warm creating a festive atmosphere and the bright reflections in her glasses and the bokeh. This is a lifestyle portrait with elements of fashion photography.
A closeup of an intricate, dew-covered flower in the rain. The focus is on the delicate petals and water droplets, capturing their soft pastel colors against a dark blue background. Shot from eye level using natural light to highlight the floral texture and dew's glistening effect. This image conveys the serene beauty found within nature's miniature worlds in the style of realist details
A closeup of a pair of worn hands, wrinkled and weathered, gently cupping a freshly baked loaf of bread. The focus is on the contrast between the rough hands and the soft dough, with flour dusting the scene. Warm light creates a sense of nourishment and tradition in the style of realistic details
A Dalmatian dog in front of a pink background in a full body dynamic pose shot with high resolution photography and fine details isolated on a plain stock photo with color grading in the style of a hyper realistic style
A massive spaceship floating above an industrial city, with the lights of thousands of buildings glowing in the dusk. The atmosphere is dark and mysterious, in the cyberpunk style, and cinematic
An architectural photograph of an interior space made from interwoven, organic forms and structures inspired in the style of coral reefs and patterned textures. The scene is bathed in the warm glow of natural light, creating intricate shadows that accentuate the fluidity and harmony between the different elements within the design

Prompt to rewrite:

'{}'

Don’t generate images, provide only the rewritten prompt.
"""


IMAGEN_REWRITER_PROMPT = """Write a prompt for a text-to-image model following the JSON style of the examples of prompts, and then I will give you a prompt that I want you to rewrite.
Do not generate images, provide only the rewritten prompt.

Example 1 of prompts:

Example 2 of prompts:

Example of a General Prompt for you to replace with the information received:

The User Prompt to rewrite with the corresponding JSON format:
'{}'
"""


VIDEO_REWRITER_PROMPT = """Write a prompt for a text-to-video model following the JSON style of the examples of prompts, and then I will give you a prompt that I want you to rewrite.
Do not generate videos, provide only the rewritten prompt.

Example 1 of prompts:
{
  "metadata": {
    "prompt_name": "Cyberpunk Drone Pursuit",
    "version": 1.1,
    "target_model": "Veo",
    "core_concept": "In a rain-slicked neon metropolis, a sleek cybernetic courier on a futuristic motorcycle is pursued by aggressive security drones through crowded back alleys."
  },
  "scene_setup": {
    "environment": "A dense, futuristic city at night, drenched in rain. Towering skyscrapers are covered in holographic advertisements. The action takes place in narrow, grimy back alleys.",
    "mood": "Tense, thrilling, high-stakes, energetic, cyberpunk.",
    "key_objects": [
      "Futuristic motorcycle with glowing wheel rims",
      "Sleek, black security drones with red optical sensors",
      "A glowing data package held by the courier"
    ]
  },
  "visual_style": {
    "aesthetic": "Hyper-realistic, cinematic, Blade Runner-inspired, high contrast.",
    "color_palette": "Dominated by electric blues, neon pinks, and deep blacks, with reflections on wet asphalt.",
    "resolution_and_format": "4K, 21:9 anamorphic widescreen"
  },
  "camera_directives": {
    "overall_movement": "Fast-paced, dynamic tracking shots. Shaky-cam effect during intense moments, with quick cuts between the courier and the pursuing drones.",
    "shot_types": "Low-angle tracking shots, over-the-shoulder from the courier's perspective, close-ups on the drone's red eyes."
  },
  "timeline": [
    {
      "sequence_id": 1,
      "timestamp": "00:00-00:02",
      "action": "The motorcycle bursts out of a main street into a narrow alley, kicking up a spray of water. Two drones swoop in behind it.",
      "camera_instruction": "Wide shot to establish the chase, then quickly pan to follow the motorcycle.",
      "audio_description": "High-pitched whine of the electric motorcycle, deep hum of the drones, sound of rain and distant city sirens."
    },
    {
      "sequence_id": 2,
      "timestamp": "00:02-00:05",
      "action": "The courier weaves skillfully between pipes and dumpsters. One drone fires a warning laser shot that sizzles against a wall.",
      "camera_instruction": "Tight follow-cam behind the motorcycle. Quick cut to the drone firing.",
      "audio_description": "Scraping metal sounds, sharp 'zap' of the laser, intensified motor whines."
    },
    {
      "sequence_id": 3,
      "timestamp": "00:05-00:07",
      "action": "The courier glances back, then hits a boost, accelerating dramatically down the alley as the screen fades to black.",
      "camera_instruction": "Extreme close-up on the courier's determined face, then a rapid dolly zoom out as the bike boosts away.",
      "audio_description": "A powerful 'whoosh' sound as the boost engages, rising futuristic score, then silence."
    }
  ],
  "constraints": {
    "negative_prompts": [
      "no daylight",
      "no cars from the 21st century",
      "no slow-motion"
    ]
  },
  "final_summary_prompt": "Cinematic 4K video, cyberpunk aesthetic. In a rain-soaked, neon-lit metropolis at night, a courier on a futuristic motorcycle is chased by menacing drones through tight back alleys. The scene is tense and fast-paced, with dynamic camera work and a color palette of electric blues and pinks against deep blacks."
}

Example 2 of prompts:
{
  "metadata": {
    "prompt_name": "The Crystal Bloom",
    "version": 1.0,
    "target_model": "Veo",
    "core_concept": "In an enchanted forest at dawn, a single drop of dew falls onto a mossy rock, causing a beautiful, intricate crystal flower to grow and bloom in hyper-lapse."
  },
  "scene_setup": {
    "environment": "An ancient, mystical forest floor. Moss covers everything. Soft, ethereal light filters through the canopy.",
    "mood": "Magical, serene, wondrous, peaceful, enchanting.",
    "key_objects": [
      "A perfect, shimmering dewdrop",
      "An old, moss-covered stone",
      "The crystal flower"
    ]
  },
  "visual_style": {
    "aesthetic": "Photorealistic, macro photography, fantasy, ethereal.",
    "color_palette": "Soft greens, earthy browns, and the iridescent, glowing light of the crystal flower.",
    "resolution_and_format": "4K, 1:1 square aspect ratio"
  },
  "camera_directives": {
    "overall_movement": "Extremely slow, subtle camera push-in. The focus is entirely on the rock and the flower's growth.",
    "shot_types": "Macro shots, shallow depth of field, focus pulling."
  },
  "timeline": [
    {
      "sequence_id": 1,
      "timestamp": "00:00-00:03",
      "action": "A single dewdrop hangs from a leaf, reflecting the entire forest. It quivers and falls in beautiful slow motion.",
      "camera_instruction": "Extreme macro shot on the dewdrop. Follow it as it falls.",
      "audio_description": "A single, gentle musical note (like a harp). The soft, ambient sounds of a forest."
    },
    {
      "sequence_id": 2,
      "timestamp": "00:03-00:07",
      "action": "The dewdrop lands on the mossy rock. Upon impact, tiny, glowing crystalline structures begin to emerge and grow rapidly from the moss in a time-lapse.",
      "camera_instruction": "Camera holds steady on the rock. Focus pulls from the moss to the emerging crystals.",
      "audio_description": "A soft, magical chime sound on impact, followed by subtle, shimmering and crackling ASMR sounds of crystal growth."
    },
    {
      "sequence_id": 3,
      "timestamp": "00:07-00:10",
      "action": "The crystal structures form a complete, intricate flower that unfurls its petals. It pulses once with a soft, warm light, illuminating the immediate area.",
      "camera_instruction": "Continue the slow push-in, ending on a perfect, detailed shot of the fully bloomed crystal flower.",
      "audio_description": "A gentle, swelling orchestral score culminates as the flower blooms, then fades back to serene forest ambiance."
    }
  ],
  "constraints": {
    "negative_prompts": [
      "no animals",
      "no people",
      "no harsh lighting",
      "no fast camera movements"
    ]
  },
  "final_summary_prompt": "Photorealistic 4K macro video. In a magical forest at dawn, a single dewdrop falls onto a mossy rock, causing a beautiful, intricate crystal flower to grow and bloom in a hyper-lapse. The mood is serene and wondrous, with soft, ethereal lighting and a focus on the magical transformation."
}


Example of a General Prompt for you to replace with the information received:
{
  "metadata": {
    "prompt_name": "string: A descriptive name for your video project",
    "version": "float: e.g., 1.0",
    "target_model": "string: e.g., 'Veo' or 'Veo-2'",
    "core_concept": "string: A one or two-sentence summary of the entire video's story or transformation."
  },
  "scene_setup": {
    "environment": "string: Describe the overall setting. e.g., 'A sunlit Scandinavian room with light wood floors' or 'The deep, dark abyss of the ocean'.",
    "mood": "string: Comma-separated list of keywords describing the feeling. e.g., 'Mythical, majestic, powerful' or 'Clean, serene, minimalist'.",
    "key_objects": [
      "string: List of crucial objects present at the start or that appear during the video."
    ]
  },
  "visual_style": {
    "aesthetic": "string: Comma-separated list of visual keywords. e.g., 'Cinematic, hyper-realistic, elegant' or 'Stop-motion, whimsical, handcrafted'.",
    "color_palette": "string: Describe the dominant colors or lighting style. e.g., 'Dominated by aquamarine light and deep blacks' or 'Bright, airy, with pops of primary colors'.",
    "resolution_and_format": "string: e.g., '8K, 16:9 cinematic widescreen'"
  },
  "camera_directives": {
    "overall_movement": "string: Describe the general camera behavior throughout the video. e.g., 'Fixed wide-angle shot, no movement' or 'Starts with a slow glide, then dynamic tracking'.",
    "shot_types": "string: Comma-separated list of desired shots. e.g., 'Wide shots, extreme close-ups, slow motion'."
  },
  "timeline": [
    {
      "sequence_id": 1,
      "timestamp": "string: e.g., '00:00-00:02'",
      "action": "string: A clear description of the visual action happening in this segment.",
      "camera_instruction": "string: Specific camera movement for this sequence. e.g., 'Slowly zoom in on the glowing object.'",
      "audio_description": "string: Describe the corresponding sounds. e.g., 'A sharp pop, followed by the sound of whirring mechanics.'"
    },
    {
      "sequence_id": 2,
      "timestamp": "string: e.g., '00:02-00:06'",
      "action": "string: Description of the next event.",
      "camera_instruction": "string: e.g., 'Follow the object as it moves across the screen.'",
      "audio_description": "string: e.g., 'A rising orchestral score with satisfying clicks and snaps.'"
    }
  ],
  "constraints": {
    "negative_prompts": [
      "string: List of elements to explicitly avoid. e.g., 'no people', 'cartoonish visuals', 'shaky camera'."
    ]
  },
  "final_summary_prompt": "string: A final, condensed paragraph that combines all the key elements into a single, flowing text prompt. This can serve as a fallback or a summary for the AI."
}

The User Prompt to rewrite with the corresponding JSON format:
'{}'
"""
