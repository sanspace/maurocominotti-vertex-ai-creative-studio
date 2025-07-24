import { Component, HostListener, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {MatIconRegistry} from '@angular/material/icon';
import {MediaItem} from '../../common/models/media-item.model';
import { GalleryService } from '../gallery.service';
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {LoadingService} from '../../common/services/loading.service';

@Component({
  selector: 'app-media-gallery',
  templateUrl: './media-gallery.component.html',
  styleUrl: './media-gallery.component.scss',
})
export class MediaGalleryComponent implements OnDestroy {
  public images: MediaItem[] = [];
  allImagesLoaded = false;
  public isLoading = true;
  private imagesSubscription: Subscription | undefined;
  private allImagesLoadedSubscription: Subscription | undefined;
  private loadingSubscription: Subscription | undefined;
  private scrollSubscription: Subscription | undefined;
  private readonly NUM_COLUMNS = 4;

  constructor(
    private galleryService: GalleryService,
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry
  ) {
    this.matIconRegistry
      .addSvgIcon(
        'mobile-white-gemini-spark-icon',
        this.setPath(`${this.path}/mobile-white-gemini-spark-icon.svg`),
      );
  }

  private path = '../../assets/images';

    private setPath(url: string): SafeResourceUrl {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

  ngOnInit(): void {
    this.loadingSubscription = this.galleryService.isLoading$.subscribe(loading => {
      this.isLoading = loading;
    });

    this.imagesSubscription = this.galleryService.images$.subscribe(images => {
      console.log("[ngOnInit - imagesSubscription] this.images.length", images.length === 0)
      if (images)
        this.images = images;

      if (!images || images.length === 0)
        this.galleryService.loadGallery(true);
    });

    this.allImagesLoadedSubscription = this.galleryService.allImagesLoaded.subscribe(loaded => {
      this.allImagesLoaded = loaded;
    });

    // Reset and load the initial set of images
    console.log("[ngOnInit] this.images.length", this.images.length === 0)
    // this.galleryService.loadGallery(this.images.length === 0);
  }

  ngOnDestroy(): void {
    this.imagesSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    this.allImagesLoadedSubscription?.unsubscribe();
  }

  onScrollIndexChange(index: number): void {
    if (this.isLoading || this.allImagesLoaded) {
      return;
    }
    // Load more items when the user is 5 items away from the end.
    const end = this.images.length - 5;
    if (index >= end) {
      this.galleryService.loadGallery();
    }
  }

  public trackByImage(index: number, image: MediaItem): string {
    return image.id;
  }

  /**
   * Listens for the main window's scroll event to trigger infinite loading.
   */
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Check if we are already loading or if all images have been loaded to prevent multiple calls
    if (this.galleryService.isLoading$.value) {
      return;
    }

    // Check if the user has scrolled to near the bottom of the page
    // We add a buffer (e.g., 200px) so the new content starts loading
    // just before the user hits the absolute bottom.
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 200) {
      console.log('Scrolled to bottom, loading more images...');
      this.galleryService.loadGallery();
    }
  }
}
