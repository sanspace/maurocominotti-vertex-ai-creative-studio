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

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from enum import Enum

class GenerationModelEnum(str, Enum):
    """Enum representing the available image generation models."""
    IMAGEN_4_ULTRA = "imagen-4.0-ultra-generate-preview-06-06"
    IMAGEN_3_001 = "imagen-3.0-generate-001"
    IMAGEN_3_FAST = "imagen-3.0-fast-generate-001"
    IMAGEN_3_002 = "imagen-3.0-generate-002"
    IMAGEGEN_006 = "imagegeneration@006"
    IMAGEGEN_005 = "imagegeneration@005"
    IMAGEGEN_002 = "imagegeneration@002"

class AspectRatioEnum(str, Enum):
    """Enum representing the supported aspect ratios."""
    RATIO_1_1 = "1:1"
    RATIO_9_16 = "9:16"
    RATIO_16_9 = "16:9"
    RATIO_3_4 = "3:4"
    RATIO_4_3 = "4:3"

class ImageStyleEnum(str, Enum):
    """Enum representing the supported image styles."""
    MODERN = "Modern"
    REALISTIC = "Realistic"
    VINTAGE = "Vintage"
    MONOCHROME = "Monochrome"
    FANTASY = "Fantasy"
    SKETCH = "Sketch"
    PHOTOREALISTIC = "Photorealistic"
    CINEMATIC = "Cinematic"

class ColorAndTone(str, Enum):
    """Enum for color and tone styles."""
    BLACK_AND_WHITE = "Black & White"
    GOLDEN = "Golden"
    MONOCHROMATIC = "Monochromatic"
    MUTED = "Muted"
    PASTEL = "Pastel"
    TONED = "Toned"
    VIBRANT = "Vibrant"
    WARM = "Warm"
    COOL = "Cool"
    MONOCHROME = "Monochrome"

class Lighting(str, Enum):
    """Enum for lighting styles."""
    BACKLIGHTING = "Backlighting"
    DRAMATIC_LIGHT = "Dramatic Light"
    GOLDEN_HOUR = "Golden Hour"
    EXPOSURE = "Exposure"
    LOW_LIGHTING = "Low Lighting"
    MULTIEXPOSURE = "Multiexposure"
    STUDIO_LIGHT = "Studio Light"
    CINEMATIC = "Cinematic"
    STUDIO = "Studio"
    NATURAL = "Natural"
    DRAMATIC = "Dramatic"
    AMBIENT = "Ambient"

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
