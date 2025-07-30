import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {Subscription, fromEvent} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {MatIconRegistry} from '@angular/material/icon';
import {MediaItem} from '../../common/models/media-item.model';
import {MatCheckboxChange} from '@angular/material/checkbox';
import {GalleryService} from '../gallery.service';
import {UserService} from '../../common/services/user.service';

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
  public userEmailFilter = '';
  public mediaTypeFilter = '';
  public generationModelFilter = '';
  public showOnlyMyMedia = false;
  public generationModels = [
    {
      value: 'imagen-4.0-ultra-generate-preview-06-06',
      viewValue: 'Imagen 4 Ultra',
    },
    {value: 'imagen-3.0-generate-002', viewValue: 'Imagen 3'},
    {value: 'imagen-3.0-fast-generate-001', viewValue: 'Imagen 3 Fast'},
    {value: 'imagen-3.0-generate-001', viewValue: 'Imagen 3 (001)'},
    {value: 'imagegeneration@006', viewValue: 'ImageGen (006)'},
    {value: 'imagegeneration@005', viewValue: 'ImageGen (005)'},
    {value: 'imagegeneration@002', viewValue: 'ImageGen (002)'},
  ];
  private autoSlideIntervals: {[id: string]: any} = {};
  public currentImageIndices: {[id: string]: number} = {};
  constructor(
    private galleryService: GalleryService,
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
    private userService: UserService,
  ) {
    this.matIconRegistry
      .addSvgIcon(
        'mobile-white-gemini-spark-icon',
        this.setPath(`${this.path}/mobile-white-gemini-spark-icon.svg`),
      )
      .addSvgIcon(
        'gemini-spark-icon',
        this.setPath(`${this.path}/gemini-spark-icon.svg`),
      );
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit(): void {
    this.loadingSubscription = this.galleryService.isLoading$.subscribe(
      loading => {
        this.isLoading = loading;
      },
    );

    this.imagesSubscription = this.galleryService.images$.subscribe(images => {
      if (images) {
        this.images = images;
        this.images.forEach(image => {
          if (this.currentImageIndices[image.id] === undefined) {
            this.currentImageIndices[image.id] = 0;
          }
          if (!this.autoSlideIntervals[image.id]) {
            this.startAutoSlide(image);
          }
        });
        this.updateColumns();
      }

      if (!images || images.length === 0) {
        this.galleryService.loadGallery(true);
      }
    });

    this.allImagesLoadedSubscription =
      this.galleryService.allImagesLoaded.subscribe(loaded => {
        this.allImagesLoaded = loaded;
      });

    this.handleResize();
    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => this.handleResize());
  }

  ngOnDestroy(): void {
    this.imagesSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    this.allImagesLoadedSubscription?.unsubscribe();
    this.resizeSubscription?.unsubscribe();
    Object.values(this.autoSlideIntervals).forEach(clearInterval);
  }

  public trackByImage(index: number, image: MediaItem): string {
    return image.id;
  }

  public getCurrentImageUrl(image: MediaItem): string {
    const index = this.currentImageIndices[image.id] || 0;
    return image.presigned_urls?.[index] || '';
  }

  public nextImage(
    imageId: string,
    urlsLength: number,
    event?: MouseEvent,
  ): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      this.stopAutoSlide(imageId);
    }
    const currentIndex = this.currentImageIndices[imageId] || 0;
    this.currentImageIndices[imageId] = (currentIndex + 1) % urlsLength;
  }

  public prevImage(
    imageId: string,
    urlsLength: number,
    event?: MouseEvent,
  ): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      this.stopAutoSlide(imageId);
    }
    const currentIndex = this.currentImageIndices[imageId] || 0;
    this.currentImageIndices[imageId] =
      (currentIndex - 1 + urlsLength) % urlsLength;
  }

  public onShowOnlyMyMediaChange(event: MatCheckboxChange): void {
    if (event.checked) {
      const userDetails = this.userService.getUserDetails();
      if (userDetails?.email) this.userEmailFilter = userDetails.email;
    } else this.userEmailFilter = '';
  }

  public startAutoSlide(image: MediaItem): void {
    if (image.presigned_urls && image.presigned_urls.length > 1) {
      if (this.autoSlideIntervals[image.id]) {
        return;
      }
      this.autoSlideIntervals[image.id] = setInterval(() => {
        this.nextImage(image.id, image.presigned_urls!.length);
      }, 3000);
    }
  }

  public stopAutoSlide(imageId: string): void {
    if (this.autoSlideIntervals[imageId]) {
      clearInterval(this.autoSlideIntervals[imageId]);
      delete this.autoSlideIntervals[imageId];
    }
  }

  private handleResize(): void {
    const width = window.innerWidth;
    let newNumColumns;
    if (width < 768) {
      // md breakpoint
      newNumColumns = 2;
    } else if (width < 1024) {
      // lg breakpoint
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

  public searchTerm(): void {
    const filters: {[key: string]: string} = {};
    if (this.userEmailFilter) {
      filters['user_email'] = this.userEmailFilter;
    }
    if (this.mediaTypeFilter) {
      filters['mime_type'] = this.mediaTypeFilter;
    }
    if (this.generationModelFilter) {
      filters['model'] = this.generationModelFilter;
    }
    this.galleryService.setFilters(filters);
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
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 200
    ) {
      this.galleryService.loadGallery();
    }
  }
}
