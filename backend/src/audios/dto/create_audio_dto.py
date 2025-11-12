from typing import Annotated, Optional

from fastapi import Query
from pydantic import Field, field_validator, model_validator

from src.audios.audio_constants import GeminiVoiceEnum, LanguageEnum
from src.common.base_dto import BaseDto, GenerationModelEnum


class CreateAudioDto(BaseDto):
    """
    Generic Audio Generation DTO.
    Supports:
    1. Music Generation (Lyria) -> Uses negative_prompt, sample_count, seed
    2. Text-to-Speech (Chirp, Gemini TTS) -> Uses language_code, voice_name
    """

    model: GenerationModelEnum = Field(
        default=GenerationModelEnum.LYRIA_002,
        description="The model to use for generation (Lyria, Chirp, Gemini TTS)."
    )

    prompt: Annotated[str, Query(max_length=10000)] = Field(
        description="The text input. For Lyria, this is the music description. For TTS, this is the text to speak."
    )

    workspace_id: str = Field(
        min_length=1,
        description="The ID of the workspace for this generation."
    )

    # --- Lyria Specific Fields ---
    negative_prompt: Optional[str] = Field(
        default=None,
        description="[Lyria Only] What to avoid in the music generation."
    )

    sample_count: int = Field(
        default=1,
        ge=1,
        le=4,
        description="[Lyria Only] Number of audio samples to generate."
    )

    seed: Optional[int] = Field(
        default=None,
        description="[Lyria Only] A seed for deterministic generation."
    )

    # --- TTS / Chirp Specific Fields ---
    language_code: Optional[LanguageEnum] = Field(
        default=LanguageEnum.EN_US,
        description="The BCP-47 language code."
    )

    # 2. FLEXIBLE TYPING (Validated conditionally below):
    voice_name: Optional[str] = Field(
        default=None,
        description="The specific voice ID. For Gemini, must be a valid GeminiVoiceEnum value."
    )

    @field_validator("model")
    def validate_audio_model(cls, value: GenerationModelEnum) -> GenerationModelEnum:
        allowed_audio_models = {
            GenerationModelEnum.LYRIA_002,
            GenerationModelEnum.CHIRP_3,
            GenerationModelEnum.GEMINI_2_5_FLASH_TTS,
            GenerationModelEnum.GEMINI_2_5_FLASH_LITE_PREVIEW_TTS,
            GenerationModelEnum.GEMINI_2_5_PRO_TTS,
        }

        if value not in allowed_audio_models:
            raise ValueError(
                f"Model '{value}' is not a valid audio model. "
                f"Allowed models: {[m.value for m in allowed_audio_models]}"
            )
        return value

    @model_validator(mode='after')
    def validate_model_requirements(self) -> 'CreateAudioDto':
        model_str = str(self.model).lower()

        is_music_model = "lyria" in model_str
        is_gemini_tts = "gemini" in model_str and "tts" in model_str

        if not is_music_model:
            # TTS Check
            if not self.language_code:
                raise ValueError("language_code is required for Text-to-Speech models.")

            # Strict Validator for Gemini Voices
            if is_gemini_tts and self.voice_name:
                # Check if the string provided exists in our Gemini Voice Enum values
                # We create a set of allowed values for fast lookup
                allowed_gemini_voices = set(item.value for item in GeminiVoiceEnum)

                if self.voice_name not in allowed_gemini_voices:
                    raise ValueError(
                        f"Invalid Voice for Gemini Model: '{self.voice_name}'. "
                        f"Must be one of: {', '.join(allowed_gemini_voices)}"
                    )

        return self
