from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from src.media_templates.media_templates_service import MediaTemplateService
from src.auth.auth_guard import RoleChecker

from src.media_templates.schema.media_template_model import MediaTemplateModel
from src.media_templates.dto.template_search_dto import TemplateSearchDto
from src.media_templates.dto.update_template_dto import UpdateTemplateDto

# Define role checkers for convenience
admin_only = Depends(RoleChecker(allowed_roles=["admin"]))
any_user = Depends(RoleChecker(allowed_roles=["user", "creator", "admin"]))

router = APIRouter(
    prefix="/api/media-templates",
    tags=["Media Templates"],
    responses={404: {"description": "Not found"}},
)


@router.post(
    "/from-media-item/{media_item_id}",
    response_model=MediaTemplateModel,
    summary="Create a New Template from a MediaItem",
    status_code=status.HTTP_201_CREATED,
    dependencies=[admin_only],
)
def create_template(
    media_item_id: str,
    service: MediaTemplateService = Depends(),
):
    """
    Creates a new template by copying and enhancing data from an existing MediaItem.
    (Admin role required)
    """
    template = service.create_template_from_media_item(media_item_id)
    if not template:
        raise HTTPException(
            status_code=404, detail="Source MediaItem not found."
        )
    return template


@router.get(
    "/",
    response_model=List[MediaTemplateModel],
    summary="Find All Templates",
    dependencies=[any_user],
)
def find_templates(
    search_params: TemplateSearchDto = Depends(),
    service: MediaTemplateService = Depends(),
):
    """
    Finds and retrieves a paginated list of media templates based on search criteria.
    (Any authenticated user)
    """
    return service.find_all_templates(search_params)


@router.get(
    "/{template_id}",
    response_model=MediaTemplateModel,
    summary="Get Template by ID",
    dependencies=[any_user],
)
def get_template(
    template_id: str,
    service: MediaTemplateService = Depends(),
):
    """
    h    Retrieves a single media template by its unique ID.
        (Any authenticated user)
    """
    template = service.get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    return template


@router.patch(
    "/{template_id}",
    response_model=MediaTemplateModel,
    summary="Update a Template",
    dependencies=[admin_only],
)
def update_template(
    template_id: str,
    update_data: UpdateTemplateDto,
    service: MediaTemplateService = Depends(),
):
    """
    Updates the fields of an existing media template.
    (Admin role required)
    """
    updated_template = service.update_template(template_id, update_data)
    if not updated_template:
        raise HTTPException(status_code=404, detail="Template not found.")
    return updated_template


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Template",
    dependencies=[admin_only],
)
def delete_template(
    template_id: str,
    service: MediaTemplateService = Depends(),
):
    """

    Permanently deletes a media template.
    (Admin role required)
    """
    if not service.delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found.")
    return
