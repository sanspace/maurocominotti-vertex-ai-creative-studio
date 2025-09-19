from src.brand_guidelines.schema.brand_guideline_model import \
    BrandGuidelineModel
from src.common.base_repository import BaseRepository


class BrandGuidelineRepository(BaseRepository[BrandGuidelineModel]):
    """
    Repository for all database operations related to the 'brand_guidelines' collection.
    """

    def __init__(self):
        """Initializes the repository with the 'brand_guidelines' collection."""
        super().__init__(collection_name="brand_guidelines", model=BrandGuidelineModel)
