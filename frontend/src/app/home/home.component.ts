/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  ViewChild,
} from '@angular/core';
import {Router} from '@angular/router';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {MatIconRegistry} from '@angular/material/icon';
import {finalize} from 'rxjs/operators';
import {SearchService} from '../services/search/search.service';
import {
  CombinedImageResults,
  GeneratedImage,
} from '../common/models/generated-image.model';
import {SearchRequest} from '../common/models/search.model';
import lightGallery from 'lightgallery';
import {LightGallery} from 'lightgallery/lightgallery';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import lgShare from 'lightgallery/plugins/share';
import {Subscription} from 'rxjs';
import {additionalShareOptions} from '../utils/lightgallery-share-options';

export interface TemplateCard {
  id: string;
  title: string;
  description: string;
  media: {type: 'image' | 'video'; src: string; alt: string};
  isComingSoon?: boolean;
  getCodeAction: () => void;
  customAction?: {
    label: string;
    action: () => void;
  };
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  templateCards: TemplateCard[] = [];
  imagenDocuments: GeneratedImage[] = [];
  isLoading = false;
  showDefaultDocuments = false;
  searchRequest: SearchRequest = {
    prompt: 'This cyberpunk cityscape is electrifying! The neon signs piercing through the rainy dusk create a stunning atmosphere, and the level of detail is impressive.  The reflections on the wet streets add a touch of realism, and the overall composition draws the eye deep into the scene. The play of light and shadow is particularly striking. It might benefit from a bit more variation in the neon colors to further enhance the vibrant, futuristic feel.',
    generationModel: 'imagen-4.0-ultra-generate-preview-06-06',
    aspectRatio: '1:1',
    imageStyle: 'Modern',
    numberOfImages: 1,
  };
  private curX = 0;
  private curY = 0;
  private tgX = 0;
  private tgY = 0;
  private animationFrameId: number | undefined;

  @ViewChildren('lightGallery') lightGalleryElements?: QueryList<ElementRef>;
  private lightGalleryInstance?: LightGallery;
  private galleryElementsSub?: Subscription;
  @ViewChild('interactiveBubble') interBubble!: ElementRef<HTMLDivElement>;

  constructor(
    public router: Router,
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
    private service: SearchService,
  ) {
    this.matIconRegistry
      .addSvgIcon(
        'content-type-icon',
        this.setPath(`${this.path}/content-type-icon.svg`),
      )
      .addSvgIcon(
        'lighting-icon',
        this.setPath(`${this.path}/lighting-icon.svg`),
      )
      .addSvgIcon(
        'number-of-images-icon',
        this.setPath(`${this.path}/number-of-images-icon.svg`),
      )
      .addSvgIcon(
        'gemini-spark-icon',
        this.setPath(`${this.path}/gemini-spark-icon.svg`),
      )
      .addSvgIcon(
        'white-gemini-spark-icon',
        this.setPath(`${this.path}/white-gemini-spark-icon.svg`),
      )
      .addSvgIcon(
        'mobile-white-gemini-spark-icon',
        this.setPath(`${this.path}/mobile-white-gemini-spark-icon.svg`),
      );
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngAfterViewInit(): void {
    // The gallery will be initialized when images are loaded for the first time.
    // We subscribe to changes in the QueryList to know when the #lightGallery element is rendered.
    this.galleryElementsSub = this.lightGalleryElements?.changes.subscribe(
      (list: QueryList<ElementRef>) => {
        if (list.first) {
          // The element is now in the DOM, we can initialize the gallery.
          this.initLightGallery();
        }
      },
    );

    // This hook is called after the component's view has been initialized.
    // Now we can be sure that 'interBubble' is available.
    if (this.interBubble && this.interBubble.nativeElement) {
      this.move();
    } else {
      console.warn(
        'Interactive bubble element not found. Animation may not start.',
      );
    }
  }

  ngOnDestroy(): void {
    this.lightGalleryInstance?.destroy();
    this.galleryElementsSub?.unsubscribe();

    if (typeof window !== 'undefined')
      window.removeEventListener('mousemove', this.onMouseMove);

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  ngOnInit(): void {
    // Set up event listener here, but don't start animation yet
    // As this should be browser code we check first if window exists
    if (typeof window !== 'undefined')
      window.addEventListener('mousemove', this.onMouseMove);
  }

  openLink(url: string | undefined) {
    if (!url) return;
    window.open(url, '_blank');
  }

  private initLightGallery(): void {
    const galleryElement = this.lightGalleryElements?.first?.nativeElement;

    if (galleryElement) {
      const dynamicElements = this.imagenDocuments.map((doc, index) => ({
        src: doc?.image?.gcsUri || '',
        thumb: doc?.image?.gcsUri || '',
        subHtml: `<div class="lightGallery-captions"><h4>Image ${index + 1}</h4><p>Generated with ${doc.source || 'Imagen 4 Model'}</p></div>`,
        // Add data-src attribute for sharing image url
        // TODO: We should create a creative studio url for that particular image
        'data-src': doc?.image?.gcsUri || '',
        facebookShareUrl: doc?.image?.gcsUri || '',
        twitterShareUrl: doc?.image?.gcsUri || '',
        tweetText: 'Try Google Creative Studio now!!',
        pinterestText: 'Try Google Creative Studio now!!',
      }));

      this.lightGalleryInstance = lightGallery(galleryElement, {
        container: galleryElement,
        dynamic: true,
        plugins: [lgZoom, lgThumbnail, lgShare],
        speed: 200,
        download: true,
        share: true,
        additionalShareOptions: additionalShareOptions,
        hash: false,
        // Do not allow users to close the gallery
        closable: false,
        // Add maximize icon to enlarge the gallery
        showMaximizeIcon: true,
        // Append caption inside the slide item
        // to apply some animation for the captions (Optional)
        appendSubHtmlTo: '.lg-item',
        // Delay slide transition to complete captions animations
        // before navigating to different slides (Optional)
        // You can find caption animation demo on the captions demo page
        slideDelay: 200,
        dynamicEl: dynamicElements,
      });

      // Since we are using dynamic mode, we need to programmatically open lightGallery
      this.lightGalleryInstance.openGallery();
    }
  }

  private processSearchResults(searchResponse: GeneratedImage[]) {
    this.imagenDocuments = (searchResponse || []).map(img => ({
      ...img,
      source: 'Imagen 4 Model',
    }));

    const hasImagenResults = this.imagenDocuments.length > 0;

    if (hasImagenResults) {
      this.showDefaultDocuments = false;
      // The QueryList subscription in ngAfterViewInit will handle the gallery initialization.
    } else {
      this.showDefaultDocuments = true;
    }
  }

  searchTerm({
    prompt,
    aspectRatio,
    model,
    imageStyle,
    numberOfImages,
  }: {
      prompt?: string | undefined;
    aspectRatio?: string | undefined;
    model?: string | undefined;
    imageStyle?: string | undefined;
    numberOfImages?: number | undefined;
  }) {
    if (!prompt) return;

    this.isLoading = true;
    this.imagenDocuments = [];
    this.lightGalleryInstance?.destroy();

    // this.showDefaultDocuments = false;
    // this.userService.showLoading();
    // this.searchResult = [];
    // this.summary = '';
    // this.imagenDocuments = [];
    // this.geminiDocuments = [];
    // this.images = [];

    this.searchRequest.prompt = prompt || this.searchRequest.prompt;
    // this.searchRequest.aspectRatio =
    //   aspectRatio || this.selectedAspectRatio.value;
    // this.searchRequest.generationModel = model || this.selectedModel;
    // this.searchRequest.imageStyle = imageStyle || this.selectedImageStyle;
    // this.searchRequest.numberOfImages = numberOfImages || this.numberOfResults;

    // const newSearchRequest = this.searchRequest;
    // console.log('Search request:', newSearchRequest);
    // this.currentSearchTerm = newSearchRequest.term;

    this.service
      .search(this.searchRequest)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (searchResponse: GeneratedImage[]) => {
          this.processSearchResults(searchResponse);
        },
        error: error => {
          console.error('Search error:', error);
        },
      });
  }

  private onMouseMove = (event: MouseEvent) => {
    this.tgX = event.clientX;
    this.tgY = event.clientY;
  };

  private move = () => {
    this.curX += (this.tgX - this.curX) / 20;
    this.curY += (this.tgY - this.curY) / 20;

    if (this.interBubble && this.interBubble.nativeElement) {
      this.interBubble.nativeElement.style.transform = `translate(${Math.round(this.curX)}px, ${Math.round(this.curY)}px)`;
    }

    this.animationFrameId = requestAnimationFrame(this.move);
  };
}
