from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from typing_extensions import Annotated

# Define the nested structures first
class Metadata(BaseModel):
    prompt_name: Annotated[str, Field(description="A descriptive name for your video project.")]
    version: float = Field(default=1.0, description="Version of the prompt structure.")
    target_model: str = Field(default="Imagen", description="The target video generation model.")
    core_concept: Annotated[str, Field(description="A one or two-sentence summary of the entire video.")]

class SceneSetup(BaseModel):
    environment: Annotated[str, Field(description="Describe the overall setting, e.g., 'A futuristic cityscape at night'.")]
    mood: Annotated[str, Field(description="Comma-separated list of keywords describing the feeling, e.g., 'Cyberpunk, noir, tense'.")]
    key_objects: List[str] = Field(default_factory=list, description="Crucial objects present in the scene.")

class VisualStyle(BaseModel):
    aesthetic: Annotated[str, Field(description="Comma-separated list of visual keywords, e.g., 'Cinematic, hyper-realistic'.")]
    color_palette: Annotated[str, Field(description="Describe the dominant colors or lighting, e.g., 'Neon blues and deep blacks'.")]
    resolution_and_format: str = Field(default="4K, 16:9 widescreen", description="Target resolution and aspect ratio.")

class CameraDirectives(BaseModel):
    overall_movement: Annotated[str, Field(description="General camera behavior, e.g., 'Slow pans and dolly zooms'.")]
    shot_types: Annotated[str, Field(description="Desired shots, e.g., 'Wide shots, close-ups, slow motion'.")]

class TimelineEvent(BaseModel):
    sequence_id: Annotated[int, Field(description="The order of this event in the timeline.")]
    timestamp: Annotated[str, Field(description="Time range for this event, e.g., '00:00-00:02'.")]
    action: Annotated[str, Field(description="A clear description of the visual action happening.")]
    camera_instruction: str = Field(default="", description="Specific camera movement for this sequence.")
    audio_description: str = Field(default="", description="Describe the corresponding sounds for this sequence.")

class Constraints(BaseModel):
    negative_prompts: List[str] = Field(default_factory=list, description="List of elements to explicitly avoid.")

# This is the main DTO that your API endpoint will receive
class CreatePromptMediaDto(BaseModel):
    """
    The structured request model for generating a video with Imagen.
    """
    metadata: Metadata
    scene_setup: SceneSetup
    visual_style: VisualStyle
    camera_directives: CameraDirectives
    timeline: Annotated[List[TimelineEvent], Field(min_length=1)]
    constraints: Constraints
    final_summary_prompt: Annotated[str, Field(description="A condensed paragraph combining all key elements. Serves as a summary for the AI.")]

    @field_validator("timeline")
    def timeline_must_be_ordered(cls, value: List[TimelineEvent]) -> List[TimelineEvent]:
        ids = [event.sequence_id for event in value]
        if sorted(ids) != list(range(1, len(ids) + 1)):
            raise ValueError("Timeline sequence_id values must be unique and sequential, starting from 1.")
        return value
