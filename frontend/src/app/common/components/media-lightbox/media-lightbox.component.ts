import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {MediaItem} from '../../models/media-item.model';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import {Clipboard} from '@angular/cdk/clipboard';
import {MatSnackBar} from '@angular/material/snack-bar';
import 'photoswipe/style.css';

@Component({
  selector: 'app-media-lightbox',
  templateUrl: './media-lightbox.component.html',
  styleUrls: ['./media-lightbox.component.scss'],
})
export class MediaLightboxComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @Input() mediaItem: MediaItem | undefined;
  @Input() initialIndex = 0;

  selectedIndex = 0;
  selectedUrl: string | undefined;

  // Properties for NgOptimizedImage
  imageWidth = 1920; // A sensible default max width
  imageHeight = 1920;

  public isShareMenuOpen = false;
  public isDownloading = false;
  private lightbox: PhotoSwipeLightbox | undefined;

  constructor(
    private clipboard: Clipboard,
    private snackBar: MatSnackBar,
  ) {}

  ngAfterViewInit(): void {
    this.initializePhotoSwipe();
  }

  ngOnDestroy(): void {
    this.lightbox?.destroy();
    this.lightbox = undefined;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mediaItem'] || changes['initialIndex']) {
      this.initialize();
      if (this.lightbox) {
        this.lightbox.destroy();
        this.initializePhotoSwipe();
      }
    }
  }

  private initialize(): void {
    if (this.mediaItem?.presignedUrls?.length) {
      this.selectedIndex =
        this.initialIndex < this.mediaItem.presignedUrls.length
          ? this.initialIndex
          : 0;
      this.selectedUrl = this.mediaItem.presignedUrls[this.selectedIndex];
      this.updateImageDimensions();
    } else {
      this.selectedIndex = 0;
      this.selectedUrl = undefined;
    }
  }

  private initializePhotoSwipe(): void {
    if (this.mediaItem?.presignedUrls && !this.isVideo) {
      this.lightbox = new PhotoSwipeLightbox({
        dataSource: this.mediaItem.presignedUrls.map(url => ({
          src: url,
          width: this.imageWidth,
          height: this.imageHeight,
          alt: this.mediaItem?.originalPrompt,
        })),
        pswpModule: () => import('photoswipe'),
      });

      this.lightbox.on('close', () => {
        this.isShareMenuOpen = false;
      });

      this.lightbox.init();
    } else {
      this.lightbox?.destroy();
      this.lightbox = undefined;
    }
  }

  private updateImageDimensions(): void {
    if (this.mediaItem) {
      const aspectRatioStr = this.mediaItem.aspectRatio || '1:1';
      const [w, h] = aspectRatioStr.split(':').map(Number);
      this.imageHeight = (h / w) * this.imageWidth;
    }
  }

  toggleShareMenu(): void {
    this.isShareMenuOpen = !this.isShareMenuOpen;
  }

  get currentImageUrl(): string {
    return this.selectedUrl || '';
  }

  openInNewTab(): void {
    if (!this.selectedUrl || this.isDownloading) {
      return;
    }

    this.isDownloading = true;

    const link = document.createElement('a');
    link.href = this.selectedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      this.isDownloading = false;
    }, 200);
  }

  getShareUrl(platform: 'facebook' | 'twitter' | 'pinterest'): string {
    const url = encodeURIComponent(this.currentImageUrl);
    const text = encodeURIComponent(
      this.mediaItem?.originalPrompt || 'Check out this image!',
    );
    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
      case 'pinterest':
        return `https://pinterest.com/pin/create/button/?url=${window.location.href}&media=${url}&description=${text}`;
    }
  }

  copyLink(): void {
    this.clipboard.copy(window.location.href);
    this.snackBar.open('Link copied to clipboard!', 'OK', {duration: 3000});
    this.isShareMenuOpen = false;
  }

  openPhotoSwipe(index: number): void {
    if (this.lightbox) {
      this.lightbox.loadAndOpen(index);
    }
  }

  selectMedia(index: number): void {
    if (this.mediaItem?.presignedUrls) {
      this.selectedIndex = index;
      this.selectedUrl = this.mediaItem.presignedUrls[index];
    }
  }

  get isVideo(): boolean {
    return this.mediaItem?.mimeType?.startsWith('video/') ?? false;
  }

  get posterUrl(): string | undefined {
    if (this.isVideo && this.mediaItem?.presignedThumbnailUrls?.length) {
      return this.mediaItem.presignedThumbnailUrls[this.selectedIndex];
    }
    return undefined;
  }

  get aspectRatioClass(): string {
    const ratio = this.mediaItem?.aspectRatio || this.mediaItem?.aspect;
    switch (ratio) {
      case '1:1':
        return 'aspect-square';
      case '16:9':
        return 'aspect-video';
      case null:
      case undefined:
        return 'aspect-square'; // Default to 1:1
      default:
        // For arbitrary values like '4:3', '3:4', etc.
        return `aspect-[${ratio.replace(':', '/')}]`;
    }
  }
}
