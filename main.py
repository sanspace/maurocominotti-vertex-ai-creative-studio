# Copyright 2024 Google LLC
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
""" Main Mesop App """
import json
import os
import random
from dataclasses import dataclass, field
import datetime
import mesop as me
from google.cloud import storage
from google.genai import Client
from google.genai import types
from google.genai.types import HarmCategory
from models.image_models import ImageModel
from config.default import Config
from google.auth import credentials
from google.cloud import iam_credentials_v1
from prompts.critics import (
    MAGAZINE_EDITOR_PROMPT,
    REWRITER_PROMPT,
)
from svg_icon.svg_icon_component import svg_icon_component

# Initialize Configuration
cfg = Config()
client = Client(
    vertexai=True,
    project=cfg.PROJECT_ID,
    location=cfg.LOCATION
)


class IamSignerCredentials(credentials.Signing):
    """
    A custom credentials class that uses the IAM Credentials API to sign bytes.

    This class implements the `google.auth.credentials.Signing` interface.
    The Storage client library will automatically call the `sign_bytes` method when it
    needs a signature.
    """

    def __init__(self, service_account_email: str):
        self.service_account_email = service_account_email
        self.iam_client = iam_credentials_v1.IAMCredentialsClient()
        self._sa_path = f"projects/-/serviceAccounts/{self.service_account_email}"

    @property
    def signer_email(self) -> str:
        """The email of the service account used for signing."""
        return self.service_account_email

    def sign_bytes(self, message: bytes) -> bytes:
        """Signs a bytestring using the IAM Credentials API."""
        print(
            f"--> Custom signer: Requesting signature from IAM for SA '{self.service_account_email}'...")
        try:
            response = self.iam_client.sign_blob(
                name=self._sa_path,
                payload=message,
            )
            print("--> Custom signer: Signature received.")
            return response.signed_blob
        except Exception as e:
            print(f"IAM PERMISSION DENIED: The principal running this code does not have "
                  f"'roles/iam.serviceAccountTokenCreator' on the service account '{self.service_account_email}'.")
            raise e  # Re-raise the exception to be caught by the caller

    # Alias sign_bytes to sign to satisfy the Signer interface, which is
    # required by the `signer` property.
    sign = sign_bytes

    @property
    def signer(self):
        """The object that can sign bytes."""
        return self

    def refresh(self, request):
        """Refresh is not used by this credentials type."""
        pass

@dataclass
@me.stateclass
class State:
    """Mesop App State"""

    # Image generation model selection and output
    image_models: list[ImageModel] = field(default_factory=lambda: cfg.display_image_models.copy())
    image_output: list[str] = field(default_factory=list)
    image_commentary: str = ""
    image_model_name: str = cfg.MODEL_IMAGEN4

    # General UI state
    is_loading: bool = False
    show_advanced: bool = False

    # Image prompt and related settings
    image_prompt_input: str = ""
    image_prompt_placeholder: str = ""
    image_textarea_key: int = 0

    image_negative_prompt_input: str = ""
    image_negative_prompt_placeholder: str = ""
    image_negative_prompt_key: int = 0  # Or handle None later

    # Image generation parameters
    imagen_watermark: bool = True
    imagen_seed: int = 0
    imagen_image_count: int = 3

    # Image style modifiers
    image_content_type: str = "Photo"
    image_color_tone: str = "Cool tone"
    image_lighting: str = "Golden hour"
    image_composition: str = "Wide angle"
    image_aspect_ratio: str = "1:1"


def on_image_input(e: me.InputEvent):
    """Image Input Event"""
    state = me.state(State)
    state.image_prompt_input = e.value


def on_blur_image_prompt(e: me.InputBlurEvent):
    """Image Blur Event"""
    me.state(State).image_prompt_input = e.value


def on_blur_image_negative_prompt(e: me.InputBlurEvent):
    """Image Blur Event"""
    me.state(State).image_negative_prompt_input = e.value


def on_click_generate_images(e: me.ClickEvent):
    """Click Event to generate images."""
    state = me.state(State)
    state.is_loading = True
    state.image_output.clear()
    yield
    generate_images(state.image_prompt_input)
    generate_compliment(state.image_prompt_input)
    state.is_loading = False
    yield


def on_select_image_count(e: me.SelectSelectionChangeEvent):
    """Change Event For Selecting an Image Model."""
    state = me.state(State)
    setattr(state, e.key, e.value)


def generate_presigned_url(gcs_uri: str, expiration_hours: int = 1) -> str:
    """Generates a v4 presigned URL for a GCS object.

    The user or service account running this code needs 'roles/storage.objectViewer'
    permission on the bucket, or a custom role with 'storage.objects.get'.

    Args:
        gcs_uri: The GCS URI of the object (e.g., 'gs://bucket/object').
        expiration_hours: The number of hours the URL will be valid for.

    Returns:
        A presigned URL, or the original GCS URI if an error occurs.
    """
    if not gcs_uri.startswith("gs://"):
        return gcs_uri

    # Get the service account email from an environment variable.
    # This is the account that will be used to sign the URL. It must have 'roles/storage.objectViewer' on the bucket.
    # The principal running this code (e.g., your user account) needs 'roles/iam.serviceAccountTokenCreator' on this SA.
    SIGNING_SERVICE_ACCOUNT_EMAIL = os.environ.get("SIGNING_SA_EMAIL")
    if not SIGNING_SERVICE_ACCOUNT_EMAIL:
        return gcs_uri

    try:
        # 1. Create the custom credentials object for signing.
        signing_credentials = IamSignerCredentials(
            service_account_email=SIGNING_SERVICE_ACCOUNT_EMAIL)

        # 2. Parse the GCS URI and create a blob object.
        storage_client = storage.Client()
        bucket_name, blob_name = gcs_uri.replace("gs://", "").split("/", 1)
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)

        # 3. Generate the signed URL, passing the custom credentials.
        # The storage library will call our signing_credentials.sign_bytes() method.
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=expiration_hours),
            method="GET",
            credentials=signing_credentials,
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL for {gcs_uri}: {e}")
        return gcs_uri

def generate_images(input_txt: str):
    """Generate Images"""
    state = me.state(State)

    # TODO: handle condition where someone hits "random" but doens't modify
    if not input_txt and state.image_prompt_placeholder:
        input_txt = state.image_prompt_placeholder
    state.image_output.clear()
    modifiers = []
    for mod in cfg.image_modifiers:
        if mod != "aspect_ratio":
            if getattr(state, f"image_{mod}") != "None":
                modifiers.append(getattr(state, f"image_{mod}"))
    prompt_modifiers = ", ".join(modifiers)
    prompt = f"{input_txt} {prompt_modifiers}"
    print(f"prompt: {prompt}")
    if state.image_negative_prompt_input:
        print(f"negative prompt: {state.image_negative_prompt_input}")
    print(f"model: {state.image_model_name}")

    response = client.models.generate_images(
        model=state.image_model_name,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            add_watermark=True,
            aspect_ratio=getattr(state, "image_aspect_ratio"),
            number_of_images=int(state.imagen_image_count),
            output_gcs_uri=f"gs://{cfg.IMAGE_CREATION_BUCKET}",
            language=types.ImagePromptLanguage.auto,
            include_rai_reason=True,
            output_mime_type='image/jpeg',
        ),
    )

    if not response.generated_images:
      raise Exception("Could not generate any Image.")

    for idx, generated_image in enumerate(response.generated_images):
      if generated_image.image and generated_image.image.gcs_uri:
        image_gcs_uri = generated_image.image.gcs_uri
        print(f"Generated image: {idx} at {image_gcs_uri}")
        presigned_url = generate_presigned_url(image_gcs_uri)
        print(f"Generated presigned url: {presigned_url}")
        state.image_output.append(presigned_url)

      elif generated_image.rai_filtered_reason:
        # This handles cases where an image was filtered for safety reasons.
        reason = generated_image.rai_filtered_reason
        print(f"Image {idx} was filtered. Reason: {reason}")
        # TODO: Shall we append a placeholder or a message to the UI?
        state.image_output.append(f"Image filtered due to: {reason}")


def random_prompt_generator(e: me.ClickEvent):
    """Click Event to generate a random prompt from a list of predefined prompts."""
    state = me.state(State)
    with open(cfg.IMAGEN_PROMPTS_JSON, "r", encoding="utf-8") as file:
        data = file.read()
    prompts = json.loads(data)
    random_prompt = random.choice(prompts["imagen"])
    state.image_prompt_placeholder = random_prompt
    on_image_input(
        me.InputEvent(key=str(state.image_textarea_key), value=random_prompt)
    )
    print(f"preset chosen: {random_prompt}")
    yield


# advanced controls
def on_click_advanced_controls(e: me.ClickEvent):
    """Click Event to toggle advanced controls."""
    me.state(State).show_advanced = not me.state(State).show_advanced


def on_click_clear_images(e: me.ClickEvent):
    """Click Event to clear images."""
    state = me.state(State)
    state.image_prompt_input = ""
    state.image_prompt_placeholder = ""
    state.image_output.clear()
    state.image_negative_prompt_input = ""
    state.image_textarea_key += 1
    state.image_negative_prompt_key += 1


def on_selection_change_image(e: me.SelectSelectionChangeEvent):
    """Change Event For Selecting an Image Model."""
    state = me.state(State)
    print(f"changed: {e.key}={e.value}")
    setattr(state, f"image_{e.key}", e.value)


def on_click_rewrite_prompt(e: me.ClickEvent):
    """Click Event to rewrite prompt."""
    state = me.state(State)
    if state.image_prompt_input:
        rewritten = rewrite_prompt(state.image_prompt_input)
        state.image_prompt_input = rewritten
        state.image_prompt_placeholder = rewritten


def rewrite_prompt(original_prompt: str):
    """
    Outputs a rewritten prompt

    Args:
        original_prompt (str): artists's original prompt
    """
    model_config = cfg.gemini_settings
    safety_filters = [
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_HARASSMENT,
        ),
    ]
    generation_cfg = types.GenerateContentConfig(
        temperature=model_config.generation["temperature"],
        max_output_tokens=model_config.generation["max_output_tokens"],
        system_instruction=REWRITER_PROMPT.format(""),
        response_logprobs=True,
        logprobs=3,
        safety_settings=safety_filters
    )
    response = client.models.generate_content(
        model=cfg.MODEL_GEMINI_MULTIMODAL,
        contents=REWRITER_PROMPT.format(original_prompt),
        config=generation_cfg,
    )
    print(f"asked to rewrite: '{original_prompt}")
    print(f"rewritten as: {response.text}")
    return response.text or ""


def generate_compliment(generation_instruction: str):
    """
    Outputs a Gemini generated comment about images
    """
    state = me.state(State)
    prompt_parts = []
    for idx, img in enumerate(state.image_output):
        prompt_parts.append(f"""image {idx+1}""")
        prompt_parts.append(types.Part.from_uri(
            file_uri=img, mime_type="image/png"))
    prompt_parts.append(MAGAZINE_EDITOR_PROMPT.format(generation_instruction))

    model_config = cfg.gemini_settings
    safety_filters = [
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        ),
        types.SafetySetting(
            category=HarmCategory.HARM_CATEGORY_HARASSMENT,
        ),
    ]
    generation_cfg = types.GenerateContentConfig(
        temperature=model_config.generation["temperature"],
        max_output_tokens=model_config.generation["max_output_tokens"],
        system_instruction=MAGAZINE_EDITOR_PROMPT.format(""),
        response_logprobs=True,
        logprobs=3,
        safety_settings=safety_filters
    )
    response = client.models.generate_content(
        model=cfg.MODEL_GEMINI_MULTIMODAL,
        contents=prompt_parts,
        config=generation_cfg,
    )

    state.image_commentary = response.text or ""


@me.page(
    path="/",
    security_policy=me.SecurityPolicy(
        allowed_script_srcs=["https://cdn.jsdelivr.net"],
        allowed_connect_srcs=["https://cdn.jsdelivr.net"],
        dangerously_disable_trusted_types=True,
    ),
    title="Imagen Creative Studio | Vertex AI",
)
def app():
    """Mesop App"""
    state = me.state(State)
    with me.box(
        style=me.Style(
            display="flex",
            flex_direction="column",
            height="100%",
        ),
    ):
        with me.box(
            style=me.Style(
                background="#f0f4f8",
                height="100%",
                overflow_y="scroll",
                margin=me.Margin(bottom=20),
            )
        ):
            with me.box(
                style=me.Style(
                    background="#f0f4f8",
                    padding=me.Padding(top=24, left=24, right=24, bottom=24),
                    display="flex",
                    flex_direction="column",
                )
            ):
                with me.box(
                    style=me.Style(
                        display="flex",
                        justify_content="space-between",
                    )
                ):
                    with me.box(
                        style=me.Style(display="flex", flex_direction="row", gap=5)
                    ):
                        me.icon(icon="auto_fix_high")
                        me.text(
                            cfg.TITLE,
                            type="headline-5",
                            style=me.Style(font_family="Google Sans"),
                        )
                    image_model_options = []
                    for c in state.image_models:
                        image_model_options.append(
                            me.SelectOption(
                                label=c.get("display"), value=c.get("model_name")
                            )
                        )
                    me.select(
                        label="Imagen version",
                        options=image_model_options,
                        key="model_name",
                        on_selection_change=on_selection_change_image,
                        value=state.image_model_name,
                    )

                # Prompt
                with me.box(
                    style=me.Style(
                        margin=me.Margin(left="auto", right="auto"),
                        width="min(1024px, 100%)",
                        gap="24px",
                        flex_grow=1,
                        display="flex",
                        flex_wrap="wrap",
                        flex_direction="column",
                    )
                ):
                    with me.box(style=_BOX_STYLE):
                        me.text(
                            "Prompt for image generation",
                            style=me.Style(font_weight=500),
                        )
                        me.box(style=me.Style(height=16))
                        me.textarea(
                            key=str(state.image_textarea_key),
                            # on_input=on_image_input,
                            on_blur=on_blur_image_prompt,
                            rows=3,
                            autosize=True,
                            max_rows=10,
                            style=me.Style(width="100%"),
                            value=state.image_prompt_placeholder,
                        )
                        # Prompt buttons
                        me.box(style=me.Style(height=12))
                        with me.box(
                            style=me.Style(
                                display="flex", justify_content="space-between"
                            )
                        ):
                            me.button(
                                "Clear",
                                color="primary",
                                type="stroked",
                                on_click=on_click_clear_images,
                            )

                            me.button(
                                "Random",
                                color="primary",
                                type="stroked",
                                on_click=random_prompt_generator,
                                style=me.Style(color="#1A73E8"),
                            )
                            # prompt rewriter
                            # disabled = not state.image_prompt_input if not state.image_prompt_input else False
                            with me.content_button(
                                on_click=on_click_rewrite_prompt,
                                type="stroked",
                                # disabled=disabled,
                            ):
                                with me.tooltip(message="rewrite prompt with Gemini"):
                                    with me.box(
                                        style=me.Style(
                                            display="flex",
                                            gap=3,
                                            align_items="center",
                                        )
                                    ):
                                        me.icon("auto_awesome")
                                        me.text("Rewriter")
                            # generate
                            me.button(
                                "Generate",
                                color="primary",
                                type="flat",
                                on_click=on_click_generate_images,
                            )

                    # Modifiers
                    with me.box(style=_BOX_STYLE):
                        with me.box(
                            style=me.Style(
                                display="flex",
                                justify_content="space-between",
                                gap=2,
                                width="100%",
                            )
                        ):
                            if state.show_advanced:
                                with me.content_button(
                                    on_click=on_click_advanced_controls
                                ):
                                    with me.tooltip(message="hide advanced controls"):
                                        with me.box(style=me.Style(display="flex")):
                                            me.icon("expand_less")
                            else:
                                with me.content_button(
                                    on_click=on_click_advanced_controls
                                ):
                                    with me.tooltip(message="show advanced controls"):
                                        with me.box(style=me.Style(display="flex")):
                                            me.icon("expand_more")

                            # Default Modifiers
                            me.select(
                                label="Aspect Ratio",
                                options=[
                                    me.SelectOption(label="1:1", value="1:1"),
                                    me.SelectOption(label="3:4", value="3:4"),
                                    me.SelectOption(label="4:3", value="4:3"),
                                    me.SelectOption(label="16:9", value="16:9"),
                                    me.SelectOption(label="9:16", value="9:16"),
                                ],
                                key="aspect_ratio",
                                on_selection_change=on_selection_change_image,
                                style=me.Style(width="160px"),
                                value=state.image_aspect_ratio,
                            )
                            me.select(
                                label="Content Type",
                                options=[
                                    me.SelectOption(label="None", value="None"),
                                    me.SelectOption(label="Photo", value="Photo"),
                                    me.SelectOption(label="Art", value="Art"),
                                ],
                                key="content_type",
                                on_selection_change=on_selection_change_image,
                                style=me.Style(width="160px"),
                                value=state.image_content_type,
                            )

                            color_and_tone_options = []
                            for c in [
                                "None",
                                "Black and white",
                                "Cool tone",
                                "Golden",
                                "Monochromatic",
                                "Muted color",
                                "Pastel color",
                                "Toned image",
                            ]:
                                color_and_tone_options.append(
                                    me.SelectOption(label=c, value=c)
                                )
                            me.select(
                                label="Color & Tone",
                                options=color_and_tone_options,
                                key="color_tone",
                                on_selection_change=on_selection_change_image,
                                style=me.Style(width="160px"),
                                value=state.image_color_tone,
                            )

                            lighting_options = []
                            for l in [
                                "None",
                                "Backlighting",
                                "Dramatic light",
                                "Golden hour",
                                "Long-time exposure",
                                "Low lighting",
                                "Multiexposure",
                                "Studio light",
                                "Surreal lighting",
                            ]:
                                lighting_options.append(
                                    me.SelectOption(label=l, value=l)
                                )
                            me.select(
                                label="Lighting",
                                options=lighting_options,
                                key="lighting",
                                on_selection_change=on_selection_change_image,
                                value=state.image_lighting,
                            )

                            composition_options = []
                            for c in [
                                "None",
                                "Closeup",
                                "Knolling",
                                "Landscape photography",
                                "Photographed through window",
                                "Shallow depth of field",
                                "Shot from above",
                                "Shot from below",
                                "Surface detail",
                                "Wide angle",
                            ]:
                                composition_options.append(
                                    me.SelectOption(label=c, value=c)
                                )
                            me.select(
                                label="Composition",
                                options=composition_options,
                                key="composition",
                                on_selection_change=on_selection_change_image,
                                value=state.image_composition,
                            )

                        # Advanced controls
                        # negative prompt
                        with me.box(
                            style=me.Style(
                                display="flex",
                                flex_direction="row",
                                gap=5,
                            )
                        ):
                            if state.show_advanced:
                                me.box(style=me.Style(width=67))
                                me.input(
                                    label="negative phrases",
                                    on_blur=on_blur_image_negative_prompt,
                                    value=state.image_negative_prompt_placeholder,
                                    key=str(state.image_negative_prompt_key),
                                    style=me.Style(
                                        width="350px",
                                    ),
                                )
                                me.select(
                                    label="number of images",
                                    value="3",
                                    options=[
                                        me.SelectOption(label="1", value="1"),
                                        me.SelectOption(label="2", value="2"),
                                        me.SelectOption(label="3", value="3"),
                                        me.SelectOption(label="4", value="4"),
                                    ],
                                    on_selection_change=on_select_image_count,
                                    key="imagen_image_count",
                                    style=me.Style(width="155px"),
                                )
                                me.checkbox(
                                    label="watermark",
                                    checked=True,
                                    disabled=True,
                                    key="imagen_watermark",
                                )
                                me.input(
                                    label="seed",
                                    disabled=True,
                                    key="imagen_seed",
                                )

                    # Image output
                    with me.box(style=_BOX_STYLE):
                        me.text("Output", style=me.Style(font_weight=500))
                        if state.is_loading:
                            with me.box(
                                style=me.Style(
                                    display="grid",
                                    justify_content="center",
                                    justify_items="center",
                                )
                            ):
                                me.progress_spinner()
                        if len(state.image_output) != 0:
                            with me.box(
                                style=me.Style(
                                    display="grid",
                                    justify_content="center",
                                    justify_items="center",
                                )
                            ):
                                # Generated images row
                                with me.box(
                                    style=me.Style(
                                        flex_wrap="wrap", display="flex", gap="15px"
                                    )
                                ):
                                    for _, img in enumerate(state.image_output):
                                        # print(f"{idx}: {len(img)}")
                                        img_url = img.replace(
                                            "gs://",
                                            "https://storage.mtls.cloud.google.com/",
                                        )
                                        me.image(
                                            # src=f"data:image/png;base64,{img}",
                                            src=f"{img_url}",
                                            style=me.Style(
                                                width="300px",
                                                margin=me.Margin(top=10),
                                                border_radius="35px",
                                            ),
                                        )

                                # SynthID notice
                                with me.box(
                                    style=me.Style(
                                        display="flex",
                                        flex_direction="row",
                                        align_items="center",
                                    )
                                ):
                                    svg_icon_component(
                                        svg="""<svg data-icon-name="digitalWatermarkIcon" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" sandboxuid="2"><path fill="#3367D6" d="M12 22c-.117 0-.233-.008-.35-.025-.1-.033-.2-.075-.3-.125-2.467-1.267-4.308-2.833-5.525-4.7C4.608 15.267 4 12.983 4 10.3V6.2c0-.433.117-.825.35-1.175.25-.35.575-.592.975-.725l6-2.15a7.7 7.7 0 00.325-.1c.117-.033.233-.05.35-.05.15 0 .375.05.675.15l6 2.15c.4.133.717.375.95.725.25.333.375.717.375 1.15V10.3c0 2.683-.625 4.967-1.875 6.85-1.233 1.883-3.067 3.45-5.5 4.7-.1.05-.2.092-.3.125-.1.017-.208.025-.325.025zm0-2.075c2.017-1.1 3.517-2.417 4.5-3.95 1-1.55 1.5-3.442 1.5-5.675V6.175l-6-2.15-6 2.15V10.3c0 2.233.492 4.125 1.475 5.675 1 1.55 2.508 2.867 4.525 3.95z" sandboxuid="2"></path><path fill="#3367D6" d="M12 16.275c0-.68-.127-1.314-.383-1.901a4.815 4.815 0 00-1.059-1.557 4.813 4.813 0 00-1.557-1.06 4.716 4.716 0 00-1.9-.382c.68 0 1.313-.128 1.9-.383a4.916 4.916 0 002.616-2.616A4.776 4.776 0 0012 6.475c0 .672.128 1.306.383 1.901a5.07 5.07 0 001.046 1.57 5.07 5.07 0 001.57 1.046 4.776 4.776 0 001.901.383c-.672 0-1.306.128-1.901.383a4.916 4.916 0 00-2.616 2.616A4.716 4.716 0 0012 16.275z" sandboxuid="2"></path></svg>"""
                                    )

                                    me.text(
                                        text="images watermarked by SynthID",
                                        style=me.Style(
                                            padding=me.Padding.all(10),
                                            font_size="0.95em",
                                        ),
                                    )
                        else:
                            if state.is_loading:
                                me.text(
                                    text="Generating images! 🚀",
                                    style=me.Style(
                                        display="grid",
                                        justify_content="center",
                                        padding=me.Padding.all(20),
                                    ),
                                )
                            else:
                                me.text(
                                    text="generate some images!",
                                    style=me.Style(
                                        display="grid",
                                        justify_content="center",
                                        padding=me.Padding.all(20),
                                    ),
                                )

                    # Image commentary
                    if len(state.image_output) != 0:
                        with me.box(style=_BOX_STYLE):
                            with me.box(
                                style=me.Style(
                                    display="flex",
                                    justify_content="space-between",
                                    gap=2,
                                    width="100%",
                                )
                            ):
                                with me.box(
                                    style=me.Style(
                                        flex_wrap="wrap",
                                        display="flex",
                                        flex_direction="row",
                                        # width="85%",
                                        padding=me.Padding.all(10),
                                    )
                                ):
                                    me.icon("assistant")
                                    me.text(
                                        "magazine editor",
                                        style=me.Style(font_weight=500),
                                    )
                                    me.markdown(
                                        text=state.image_commentary,
                                        style=me.Style(padding=me.Padding.all(15)),
                                    )

        footer()


def footer():
    """Creates the footer of the application"""
    with me.box(
        style=me.Style(
            # height="18px",
            padding=me.Padding(left=20, right=20, top=10, bottom=14),
            border=me.Border(
                top=me.BorderSide(width=1, style="solid", color="$ececf1")
            ),
            display="flex",
            justify_content="space-between",
            flex_direction="row",
            color="rgb(68, 71, 70)",
            letter_spacing="0.1px",
            line_height="14px",
            font_size=14,
            font_family="Google Sans",
        )
    ):
        me.html(
            "<a href='https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview' target='_blank'>Imagen</a>",
        )
        me.html(
            "<a href='https://cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide' target='_blank'>Imagen Prompting Guide</a>"
        )
        me.html(
            "<a href='https://cloud.google.com/vertex-ai/generative-ai/docs/image/responsible-ai-imagen' target='_blank'>Imagen Responsible AI</a>"
        )


_BOX_STYLE = me.Style(
    flex_basis="max(480px, calc(50% - 48px))",
    background="#fff",
    border_radius=12,
    box_shadow=("0 3px 1px -2px #0003, 0 2px 2px #00000024, 0 1px 5px #0000001f"),
    padding=me.Padding(top=16, left=16, right=16, bottom=16),
    display="flex",
    flex_direction="column",
)

_BOX_STYLE_ROW = me.Style(
    flex_basis="max(480px, calc(50% - 48px))",
    background="#fff",
    border_radius=12,
    box_shadow=("0 3px 1px -2px #0003, 0 2px 2px #00000024, 0 1px 5px #0000001f"),
    padding=me.Padding(top=12, left=12, right=12, bottom=12),
    display="flex",
    flex_direction="row",
)
