
from pydantic import Field
from google.genai import types

from src.images.dto.create_imagen_dto import CreateImagenDto

class EditImagenDto(CreateImagenDto):
    """
    The refactored request model. Defaults are defined here to make the API
    contract explicit and self-documenting.
    """

    user_image: bytes
    edit_mode: types.EditMode = Field(
        default=types.EditMode.EDIT_MODE_DEFAULT,
        description="Edit Mode used for image editing.",
    )
    mask_mode: types.MaskReferenceMode = Field(
        default=types.MaskReferenceMode.MASK_MODE_DEFAULT,
        description="""Prompts the model to generate a mask instead of you needing to
      provide one (unless MASK_MODE_USER_PROVIDED is used).""",
    )
    include_rai_reason: bool = Field(
        default=True,
        description="""Whether to include the Responsible AI filter reason if the image
      is filtered out of the response.""",
    )
    mask_distilation: float = Field(
        default=0.005,
        description="Dilation percentage of the mask provided. Float between 0 and 1.",
    )
