from typing import List, Optional

from pydantic import Field

from src.common.base_repository import BaseDocument


class BrandGuidelineModel(BaseDocument):
    """
    COLLECTION: brand_guidelines
    Stores structured brand kits, either linked to a workspace or as a global default.
    Data is populated by an admin OR via AI-powered extraction from an uploaded PDF.
    """
    name: str

    workspace_id: Optional[str] = Field(
        default=None,
        description="If set, this guideline is linked to a single workspace. If null, it's global."
    )

    # --- Source File (The user's input) ---
    source_pdf_gcs_uri: Optional[str] = Field(
        default=None,
        description="The GCS path to the original uploaded brand guidelines PDF."
    )

    # --- AI-Extracted & Manually-Entered Fields ---
    color_palette: List[str] = Field(
        default_factory=list,
        description="List of hex color codes (e.g., '#FFFFFF') extracted from the PDF or entered manually."
    )

    logo_asset_id: Optional[str] = Field(
        default=None,
        description="The ID of a document in the 'user_assets' collection to be used as the logo."
    )

    guideline_text: Optional[str] = Field(
        default=None,
        description="This is the full raw text extracted from the PDF, for reference."
    )

    # --- THESE ARE THE NEW, "SMART" FIELDS ---
    tone_of_voice_summary: Optional[str] = Field(
        default=None,
        description="An AI-generated summary of brand voice, used to prefix text-generation prompts."
    )

    visual_style_summary: Optional[str] = Field(
        default=None,
        description="An AI-generated summary of visual style, used to prefix image-generation prompts."
    )
