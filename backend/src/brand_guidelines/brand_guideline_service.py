import logging
import uuid
from typing import Optional

from fastapi import UploadFile

from src.brand_guidelines.repository.brand_guideline_repository import \
    BrandGuidelineRepository
from src.brand_guidelines.schema.brand_guideline_model import \
    BrandGuidelineModel
from src.common.storage_service import GcsService
from src.multimodal.gemini_service import GeminiService

logger = logging.getLogger(__name__)


class BrandGuidelineService:
    """
    Handles the business logic for creating and managing brand guidelines,
    including PDF processing via background tasks.
    """

    def __init__(self):
        self.repo = BrandGuidelineRepository()
        self.gcs_service = GcsService()
        self.gemini_service = GeminiService()

    async def create_and_process_guideline(
        self, name: str, file: UploadFile, workspace_id: Optional[str]
    ) -> BrandGuidelineModel:
        """
        Handles the end-to-end process of creating a brand guideline synchronously.
        1. Uploads a PDF to GCS.
        2. Calls the Gemini service to extract structured data from the PDF.
        3. Creates a complete BrandGuideline document in Firestore with all data.
        4. Returns the fully populated model.
        """
        # 1. Upload the file to GCS
        file_contents = await file.read()
        destination_blob_name = (
            f"brand-guidelines/{workspace_id or 'global'}/{uuid.uuid4()}-{file.filename}"
        )
        gcs_uri = self.gcs_service.upload_bytes_to_gcs(
            bytes=file_contents,
            destination_blob_name=destination_blob_name,
            mime_type=file.content_type or "application/pdf",
        )

        if not gcs_uri:
            raise Exception("Failed to upload PDF to Google Cloud Storage.")

        logger.info(f"PDF uploaded to {gcs_uri}. Starting AI extraction.")

        # 2. Call Gemini synchronously to extract structured data from the PDF
        extracted_data = self.gemini_service.extract_brand_info_from_pdf(gcs_uri)

        if not extracted_data:
            logger.error(f"Failed to extract data from PDF at {gcs_uri}.")
            # Depending on requirements, you might want to raise an exception here
            # to signal a failure to the user.
            raise Exception("AI processing failed to extract data from the PDF.")

        # 3. Create the final, fully-populated Firestore document
        new_guideline = BrandGuidelineModel(
            name=name,
            workspace_id=workspace_id,
            source_pdf_gcs_uri=gcs_uri,
            **extracted_data,  # Unpack AI-extracted data into the model
        )
        self.repo.save(new_guideline)
        logger.info(f"Successfully created and processed brand guideline: {new_guideline.id}")

        return new_guideline
