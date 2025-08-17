import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MediaItem } from '../../models/media-item.model';

@Component({
  selector: 'app-media-lightbox',
  templateUrl: './media-lightbox.component.html',
  styleUrls: ['./media-lightbox.component.scss'],
})
export class MediaLightboxComponent implements OnChanges {
  @Input() mediaItem: MediaItem | undefined;
  @Input() initialIndex = 0;

  selectedIndex = 0;
  selectedUrl: string | undefined;

  // Properties for NgOptimizedImage
  imageWidth = 1920; // A sensible default max width
  imageHeight = 1920;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mediaItem'] || changes['initialIndex']) {
      this.initialize();
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

  private updateImageDimensions(): void {
    if (this.mediaItem) {
      const aspectRatioStr = this.mediaItem.aspectRatio || '1:1';
      const [w, h] = aspectRatioStr.split(':').map(Number);
      this.imageHeight = (h / w) * this.imageWidth;
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
