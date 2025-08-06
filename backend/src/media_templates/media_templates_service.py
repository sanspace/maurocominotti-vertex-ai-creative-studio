from typing import List, Optional
import re

from src.images.repository.media_item_repository import MediaRepository
from src.media_templates.repository.media_template_repository import (
    MediaTemplateRepository,
)
from src.media_templates.schema.media_template_model import (
    MediaTemplateModel,
    GenerationParameters,
)
from src.media_templates.dto.template_search_dto import TemplateSearchDto
from src.media_templates.dto.update_template_dto import UpdateTemplateDto

# We need Gemini to auto-generate names and descriptions
from src.multimodal.gemini_service import GeminiService


class MediaTemplateService:
    """Handles the business logic for managing media templates."""

    def __init__(self):
        # Dependency Injection for repositories and other services
        self.template_repo = MediaTemplateRepository()
        self.media_item_repo = MediaRepository()
        self.gemini_service = GeminiService()

    def get_template_by_id(
        self, template_id: str
    ) -> Optional[MediaTemplateModel]:
        """Fetches a single template by its ID."""
        return self.template_repo.get_by_id(template_id)

    def find_all_templates(
        self, search_dto: TemplateSearchDto
    ) -> List[MediaTemplateModel]:
        """Finds all templates with optional filtering and pagination."""
        return self.template_repo.query(search_dto)

    def delete_template(self, template_id: str) -> bool:
        """Deletes a template by its ID. (Admin only)"""
        return self.template_repo.delete(template_id)

    def update_template(
        self, template_id: str, update_dto: UpdateTemplateDto
    ) -> Optional[MediaTemplateModel]:
        """Updates a template's information. (Admin only)"""
        # model_dump with exclude_unset=True creates a dict with only the provided fields
        update_data = update_dto.model_dump(exclude_unset=True)
        if not update_data:
            return self.template_repo.get_by_id(
                template_id
            )  # Nothing to update

        return self.template_repo.update(template_id, update_data)

    def create_template_from_media_item(
        self, media_item_id: str
    ) -> Optional[MediaTemplateModel]:
        """
        Creates a new MediaTemplate by copying properties from an existing MediaItem
        and using Gemini to generate a creative name and description. (Admin only)
        """
        media_item = self.media_item_repo.get_by_id(media_item_id)
        if not media_item:
            return None  # MediaItem not found

        # --- Use Gemini to generate a name and description ---
        prompt_for_gemini = (
            f"Based on the following creative prompt, generate a short, catchy 'Name' and a one-sentence 'Description' "
            f"for a new template. The original prompt is: '{media_item.prompt}'.\n\n"
            f"Format your response exactly like this:\n"
            f"Name: [Your Generated Name]\n"
            f"Description: [Your Generated Description]"
        )
        generated_text = self.gemini_service.generate_text(prompt_for_gemini)

        # Parse the generated text
        name_match = re.search(r"Name: (.*)", generated_text)
        desc_match = re.search(r"Description: (.*)", generated_text)

        generated_name = (
            name_match.group(1).strip()
            if name_match
            else f"Template based on {media_item.id}"
        )
        generated_desc = (
            desc_match.group(1).strip()
            if desc_match
            else f"A creative template derived from prompt: {media_item.prompt}"
        )
        # --- End of Gemini logic ---

        # Create the new template by mapping fields
        new_template = MediaTemplateModel(
            name=generated_name,
            description=generated_desc,
            mime_type=media_item.mime_type,
            # industry=media_item.industry or "Other",  # Default if not present
            # brand=media_item.brand,
            # tags=media_item.tags or [],
            gcs_uris=media_item.gcs_uris,
            thumbnail_uris=media_item.thumbnail_uris,
            generation_parameters=GenerationParameters(
                prompt=media_item.prompt,
                model=media_item.model,
                aspect_ratio=media_item.aspect_ratio,
                style=media_item.style,
                lighting=media_item.lighting,
                color_and_tone=media_item.color_and_tone,
                composition=media_item.composition,
                negative_prompt=media_item.negative_prompt,
            ),
        )

        return self.template_repo.create(new_template)
