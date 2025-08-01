import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Location} from '@angular/common';
import {Subscription} from 'rxjs';
import {LightGallery} from 'lightgallery/lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import {InitDetail} from 'lightgallery/lg-events';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgShare from 'lightgallery/plugins/share';
import lgVideo from 'lightgallery/plugins/video';
import {VideoSource} from 'lightgallery/plugins/video/types';
import {additionalShareOptions} from '../../utils/lightgallery-share-options';
import {MediaItem} from '../../common/models/media-item.model';
import {GalleryService} from '../gallery.service';
import {LoadingService} from '../../common/services/loading.service';
import lightGallery from 'lightgallery';
import {GalleryItem} from 'lightgallery/lg-utils';

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

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private galleryService: GalleryService,
    private loadingService: LoadingService,
  ) {
    // Get the media item from the router state
    this.mediaItem =
      this.router.getCurrentNavigation()?.extras.state?.['mediaItem'];

    console.log('mediaItem', this.mediaItem);

    if (this.mediaItem) {
      // If we have the media item, we don't need to load it
      this.loadingService.hide();
      this.isLoading = false;
    } else {
      // If not, fetch the media item using the ID from the route params
      this.fetchMediaItem();
    }
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.gallerySubscription = this.lightGalleryCarousels?.changes.subscribe(
      (list: QueryList<ElementRef>) => {
        console.log('ngAfterViewInit called list', list);

        if (list.first) {
          console.log('ngAfterViewInit called list.first');
          this.initLightGallery();
        }
      },
    );

    // The `changes` subscription only fires when the list of elements changes.
    // If the carousel element is already in the DOM when this component initializes
    // (because `mediaItem` was passed in the route state), `changes` will not fire.
    // We need to check for this case and initialize the gallery manually.
    // We use a microtask to wait for the view to be stable before initialization.
    Promise.resolve().then(() => {
      if (this.lightGalleryCarousels?.length) {
        console.log(
          'ngAfterViewInit: Element already present, initializing gallery.',
        );
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
    this.lightGalleryInstance?.destroy();
    this.gallerySubscription?.unsubscribe();
  }

  fetchMediaDetails(id: string): void {
    this.mediaSub = this.galleryService.getMedia(id).subscribe({
      next: data => {
        this.mediaItem = data;
        this.isLoading = false;
        this.loadingService.hide();
      },
      error: err => {
        console.error('Failed to fetch media details', err);
        this.isLoading = false;
        this.loadingService.hide();
      },
    });
  }

  private initLightGallery(): void {
    console.log('initLightGallery');

    const galleryElement = this.lightGalleryCarousels?.first.nativeElement;

    console.log('initLightGallery galleryElement', galleryElement);

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

    console.log('dynamicElements', dynamicElements);

    this.lightGalleryInstance = lightGallery(galleryElement, {
      container: galleryElement,
      dynamic: true,
      dynamicEl: dynamicElements,
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
  }

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
