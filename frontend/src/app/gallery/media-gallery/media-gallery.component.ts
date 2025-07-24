import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {Subscription, fromEvent} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
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
export class MediaGalleryComponent implements OnInit, OnDestroy {
  public images: MediaItem[] = [];
  public columns: MediaItem[][] = [];
  allImagesLoaded = false;
  public isLoading = true;
  private imagesSubscription: Subscription | undefined;
  private allImagesLoadedSubscription: Subscription | undefined;
  private loadingSubscription: Subscription | undefined;
  private resizeSubscription: Subscription | undefined;
  private numColumns = 4;
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
      if (images) {
        this.images = images;
        this.updateColumns();
      }

      if (!images || images.length === 0) {
        this.galleryService.loadGallery(true);
      }
    });

    this.allImagesLoadedSubscription = this.galleryService.allImagesLoaded.subscribe(loaded => {
      this.allImagesLoaded = loaded;
    });

    this.handleResize();
    this.resizeSubscription = fromEvent(window, 'resize').pipe(debounceTime(200)).subscribe(() => this.handleResize());
  }

  ngOnDestroy(): void {
    this.imagesSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    this.allImagesLoadedSubscription?.unsubscribe();
    this.resizeSubscription?.unsubscribe();
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

  private handleResize(): void {
    const width = window.innerWidth;
    let newNumColumns;
    if (width < 768) { // md breakpoint
      newNumColumns = 2;
    } else if (width < 1024) { // lg breakpoint
      newNumColumns = 3;
    } else {
      newNumColumns = 4;
    }

    if (newNumColumns !== this.numColumns) {
      this.numColumns = newNumColumns;
      this.updateColumns();
    }
  }

  private updateColumns(): void {
    this.columns = Array.from({length: this.numColumns}, () => []);
    this.images.forEach((image, index) => {
      this.columns[index % this.numColumns].push(image);
    });
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
