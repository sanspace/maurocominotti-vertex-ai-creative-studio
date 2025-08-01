import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Location} from '@angular/common';
import {Subscription} from 'rxjs';
import {LightGallery} from 'lightgallery/lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgShare from 'lightgallery/plugins/share';
import lgVideo from 'lightgallery/plugins/video';
import {additionalShareOptions} from '../../utils/lightgallery-share-options';
import {MediaItem} from '../../common/models/media-item.model';
import {GalleryService} from '../gallery.service';
import {LoadingService} from '../../common/services/loading.service';
import lightGallery from 'lightgallery';
import {GalleryItem} from 'lightgallery/lg-utils';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ToastMessageComponent} from '../../common/components/toast-message/toast-message.component';

@Component({
  selector: 'app-media-detail',
  templateUrl: './media-detail.component.html',
  styleUrls: ['./media-detail.component.scss'],
})
export class MediaDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  private routeSub?: Subscription;
  private mediaSub?: Subscription;

  @ViewChildren('lightGalleryCarousel')
  lightGalleryCarousels?: QueryList<ElementRef>;

  private gallerySubscription?: Subscription;
  private lightGalleryInstance?: LightGallery;
  public isLoading = true;
  public mediaItem: MediaItem | undefined;
  private initialSlideIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private galleryService: GalleryService,
    private loadingService: LoadingService,
    private _snackBar: MatSnackBar,
  ) {
    // Get the media item from the router state
    this.mediaItem =
      this.router.getCurrentNavigation()?.extras.state?.['mediaItem'];

    if (this.mediaItem) {
      // If we have the media item, we don't need to load it
      this.loadingService.hide();
      this.isLoading = false;
      this.readInitialIndexFromUrl();
    } else {
      // If not, fetch the media item using the ID from the route params
      this.fetchMediaItem();
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.gallerySubscription = this.lightGalleryCarousels?.changes.subscribe(
      (list: QueryList<ElementRef>) => {
        if (list.first) {
          this.initLightGallery();
        }
      },
    );

    // The `changes` subscription only fires when the list of elements changes. If the
    // carousel element is already in the DOM (e.g. mediaItem was passed in state),
    // `changes` won't fire. We need to check for this case and initialize manually.
    Promise.resolve().then(() => {
      if (this.lightGalleryCarousels?.length) {
        this.initLightGallery();
      }
    });
  }

  fetchMediaItem() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchMediaDetails(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.mediaSub?.unsubscribe();
    this.gallerySubscription?.unsubscribe();

    // Clean up lightgallery
    if (this.lightGalleryInstance) {
      const galleryElement = this.lightGalleryCarousels?.first?.nativeElement;
      if (galleryElement) {
        galleryElement.removeEventListener('lgAfterSlide', this.onAfterSlide);
      }
      this.lightGalleryInstance.destroy();
    }
  }

  fetchMediaDetails(id: string): void {
    this.mediaSub = this.galleryService.getMedia(id).subscribe({
      next: data => {
        this.mediaItem = data;
        this.isLoading = false;
        this.loadingService.hide();
        this.readInitialIndexFromUrl();
      },
      error: err => {
        console.error('Failed to fetch media details', err);
        this.isLoading = false;
        this.loadingService.hide();
      },
    });
  }

  private readInitialIndexFromUrl(): void {
    const indexStr = this.route.snapshot.queryParamMap.get('img_index');
    if (indexStr) {
      const index = parseInt(indexStr, 10);
      if (
        !isNaN(index) &&
        index >= 0 &&
        index < (this.mediaItem?.presigned_urls?.length || 0)
      ) {
        this.initialSlideIndex = index;
      }
    }
  }

  private initLightGallery(): void {
    const galleryElement = this.lightGalleryCarousels?.first.nativeElement;

    // Add a listener to update the URL when the slide changes.
    galleryElement.addEventListener('lgAfterSlide', this.onAfterSlide);

    if (!galleryElement || !this.mediaItem?.presigned_urls) return;

    // Prevent re-initialization
    this.lightGalleryInstance?.destroy();

    const dynamicElements = this.mediaItem.presigned_urls.map((url, index) => {
      const isVideo = this.mediaItem?.mime_type?.startsWith('video/');

      if (isVideo) {
        // For videos, we need to build a specific object structure for lightGallery.
        // The 'src' property on the top-level item should be empty.
        const dynamicVideo: GalleryItem = {
          src: '',
          thumb: this.mediaItem?.presigned_thumbnail_urls?.[index] || '',
          subHtml: `<div class="lightGallery-captions"><h4>Video ${index + 1} of ${this.mediaItem?.presigned_urls?.length}</h4><p>${this.mediaItem?.original_prompt || ''}</p></div>`,
          video: {
            source: [
              {src: url, type: this.mediaItem?.mime_type || 'video/mp4'},
            ],
            tracks: [],
            // The type definition for 'attributes' is incorrectly expecting a full
            // HTMLVideoElement object. We cast to 'any' to provide a plain object
            // of attributes, which is what the library actually uses.
            attributes: {preload: 'metadata', controls: true} as any,
          },
        };
        return dynamicVideo;
      } else {
        return {
          src: url,
          thumb: url,
          subHtml: `<div class="lightGallery-captions"><h4>Image ${index + 1} of ${this.mediaItem?.presigned_urls?.length}</h4><p>${this.mediaItem?.original_prompt || ''}</p></div>`,
          'data-src': url, // for sharing
        };
      }
    });

    this.lightGalleryInstance = lightGallery(galleryElement, {
      container: galleryElement,
      dynamic: true,
      dynamicEl: dynamicElements,
      index: this.initialSlideIndex,
      plugins: [lgZoom, lgShare, lgVideo, lgThumbnail],
      speed: 500,
      download: true,
      share: true,
      additionalShareOptions: additionalShareOptions,
      hash: false,
      closable: false,
      showMaximizeIcon: true,
      appendSubHtmlTo: '.lg-item',
      slideDelay: 200,
    });

    // Programmatically open the gallery since we are in dynamic mode
    this.lightGalleryInstance.openGallery();

    // Add a custom click handler for our "Copy Link" button.
    // We do this because the share plugin doesn't support custom actions, only setting hrefs.
    const copyLinkButton = galleryElement.querySelector('.lg-share-copy-link');
    if (copyLinkButton) {
      copyLinkButton.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const urlToCopy = (e.currentTarget as HTMLAnchorElement).href;
        navigator.clipboard.writeText(urlToCopy).then(
          () => {
            this._snackBar.openFromComponent(ToastMessageComponent, {
              panelClass: ['green-toast'],
              verticalPosition: 'top',
              horizontalPosition: 'right',
              duration: 6000,
              data: {
                text: 'Url copied!',
                matIcon: 'check_small',
              },
            });
          },
          err => {
            console.error('Failed to copy link: ', err);
          },
        );
      });
    }
  }

  /**
   * Handles the afterSlide event from lightGallery to update the URL.
   * This is an arrow function to preserve the `this` context.
   */
  private onAfterSlide = (event: CustomEvent): void => {
    const newIndex = event.detail.index;
    const url = this.router
      .createUrlTree([], {
        relativeTo: this.route,
        queryParams: {img_index: newIndex},
        queryParamsHandling: 'merge', // Keeps other query params if any
      })
      .toString();

    this.location.replaceState(url);
  };

  goBack(): void {
    this.location.back();
  }

  /**
   * Gets the prompt, formatted as a beautified JSON string if it's a
   * valid JSON object or stringified JSON. Otherwise, returns the original prompt.
   */
  get formattedPrompt(): string {
    if (!this.mediaItem?.prompt) {
      return 'N/A';
    }

    // The prompt could already be an object.
    if (typeof this.mediaItem.prompt === 'object') {
      return JSON.stringify(this.mediaItem.prompt, null, 2);
    }

    // Or it could be a string, which might be stringified JSON.
    try {
      const parsed = JSON.parse(this.mediaItem.prompt);
      // We only want to format it if the parsed content is an object or array.
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // It's not a valid JSON string, so we'll fall through and return the original string.
    }

    // Return the original string if it's not an object or valid stringified JSON.
    return this.mediaItem.prompt;
  }

  /**
   * Converts a GCS URI (gs://...) to a clickable console URL.
   * @param uri The GCS URI.
   * @returns A URL to the GCS object in the Google Cloud Console.
   */
  public getGcsLink(uri: string): string {
    if (!uri || !uri.startsWith('gs://')) {
      return '#';
    }
    return `https://console.cloud.google.com/storage/browser/${uri.substring(5)}`;
  }
}
