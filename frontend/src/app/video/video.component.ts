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

import {Component, ElementRef, QueryList, ViewChildren} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {LightGallery} from 'lightgallery/lightgallery';
import {finalize, Subscription} from 'rxjs';
import {SearchService} from '../services/search/search.service';
import {Router} from '@angular/router';
import {GeneratedVideo} from '../common/models/generated-image.model';
import {VeoRequest} from '../common/models/search.model';
import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgShare from 'lightgallery/plugins/share';
import {additionalShareOptions} from '../utils/lightgallery-share-options';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ToastMessageComponent} from '../common/components/toast-message/toast-message.component';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrl: './video.component.scss',
})
export class VideoComponent {
  // --- Component State ---
  videoDocuments: GeneratedVideo[] = [];
  isLoading = false;
  showDefaultDocuments = false;

  // --- Search Request Object ---
  // This object holds the current state of all user selections.
  searchRequest: VeoRequest = {
    prompt:
      'A hiker during a late spring day in California’s Big Sur overlooking the ocean',
    generationModel: 'veo-3.0-fast-generate-preview',
    aspectRatio: '16:9',
    videoStyle: 'Modern',
    numberOfVideos: 1,
    lighting: 'Cinematic',
    colorAndTone: 'Vibrant',
    composition: 'Closeup',
    addWatermark: false,
    negativePrompt: '',
  };

  // --- Negative Prompt Chips ---
  negativePhrases: string[] = [];

  // --- Dropdown Options ---
  generationModels = [
    {
      value: 'veo-3.0-fast-generate-preview',
      viewValue: 'Veo 3 Fast \n (Beta Audio)',
    },
    {
      value: 'veo-3.0-generate-preview',
      viewValue: 'Veo 3 Quality \n (Beta Audio)',
    },
    {value: 'veo-2.0-generate-001', viewValue: 'Veo 2 Quality \n (No Audio)'},
    {value: 'veo-2.0-fast-generate-001', viewValue: 'Veo 2 Fast \n (No Audio)'},
  ];
  selectedGenerationModel = this.generationModels[0].viewValue;
  aspectRatioOptions: {value: string; viewValue: string; disabled: boolean}[] =
    [
      {value: '16:9', viewValue: '1200x628 \n Landscape', disabled: false},
      {value: '9:16', viewValue: '1080x1920 \n Story', disabled: false},
    ];
  selectedAspectRatio = this.aspectRatioOptions[0].viewValue;
  videoStyles = [
    'Photorealistic',
    'Cinematic',
    'Modern',
    'Realistic',
    'Vintage',
    'Monochrome',
    'Fantasy',
    'Sketch',
  ];
  lightings = [
    'Cinematic',
    'Studio',
    'Natural',
    'Dramatic',
    'Ambient',
    'Backlighting',
    'Dramatic Light',
    'Golden Hour',
    'Exposure',
    'Low Lighting',
    'Multiexposure',
    'Studio Light',
  ];
  colorsAndTones = [
    'Vibrant',
    'Muted',
    'Warm',
    'Cool',
    'Monochrome',
    'Black & White',
    'Golden',
    'Pastel',
    'Toned',
  ];
  numberOfVideosOptions = [1, 2, 3, 4];
  compositions = [
    'Closeup',
    'Knolling',
    'Landscape photography',
    'Photographed through window',
    'Shallow depth of field',
    'Shot from above',
    'Shot from below',
    'Surface detail',
    'Wide angle',
  ];
  watermarkOptions = [
    {value: true, viewValue: 'Yes'},
    {value: false, viewValue: 'No'},
  ];
  selectedWatermark = this.watermarkOptions.find(
    o => o.value === this.searchRequest.addWatermark,
  )!.viewValue;

  @ViewChildren('lightGalleryVideos')
  lightGalleryElements?: QueryList<ElementRef>;
  private lightGalleryInstance?: LightGallery;
  private galleryElementsSub?: Subscription;

  constructor(
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
    private service: SearchService,
    public router: Router,
    private _snackBar: MatSnackBar,
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
      );
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngAfterViewInit(): void {
    // The gallery will be initialized when videos are loaded for the first time.
    // We subscribe to changes in the QueryList to know when the #lightGallery element is rendered.
    this.galleryElementsSub = this.lightGalleryElements?.changes.subscribe(
      (list: QueryList<ElementRef>) => {
        if (list.first) {
          // The element is now in the DOM, we can initialize the gallery.
          this.initLightGallery();
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.lightGalleryInstance?.destroy();
    this.galleryElementsSub?.unsubscribe();
  }

  private initLightGallery(): void {
    const galleryElement = this.lightGalleryElements?.first?.nativeElement;
    console.log('initLightGallery galleryElement', galleryElement);

    if (galleryElement) {
      console.log('ISIDE galleryElement');
      const dynamicElements = this.videoDocuments.map((doc, index) => ({
        src: doc?.video?.presignedUrl || '',
        thumb: doc?.video?.presignedUrl || '',
        subHtml: `<div class="lightGallery-captions"><h4>Video ${index + 1}</h4><p>Generated with ${doc?.source || 'Videon 4 Model'}</p></div>`,
        // Add data-src attribute for sharing video url
        // TODO: We should create a creative studio url for that particular video
        'data-src': doc?.video?.presignedUrl || '',
        facebookShareUrl: doc?.video?.presignedUrl || '',
        twitterShareUrl: doc?.video?.presignedUrl || '',
        tweetText: 'Try Google Creative Studio now!!',
        pinterestText: 'Try Google Creative Studio now!!',
      }));

      console.log('dynamicElements', dynamicElements);

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

  private processSearchResults(searchResponse: GeneratedVideo[]) {
    this.videoDocuments = (searchResponse || []).map(img => ({
      ...img,
      source: 'Video 3 Model',
    }));

    console.log(this.videoDocuments);

    const hasVideonResults = this.videoDocuments.length > 0;

    if (hasVideonResults) {
      this.showDefaultDocuments = false;
      // The QueryList subscription in ngAfterViewInit will handle the gallery initialization.
    } else {
      this.showDefaultDocuments = true;
    }
  }

  selectModel(model: {value: string; viewValue: string}): void {
    this.searchRequest.generationModel = model.value;
    this.selectedGenerationModel = model.viewValue;
  }

  selectAspectRatio(ratio: string): void {
    this.searchRequest.aspectRatio = ratio;
  }

  selectVideoStyle(style: string): void {
    this.searchRequest.videoStyle = style;
  }

  selectLighting(lighting: string): void {
    this.searchRequest.lighting = lighting;
  }

  selectColor(color: string): void {
    this.searchRequest.colorAndTone = color;
  }

  selectNumberOfVideos(num: number): void {
    this.searchRequest.numberOfVideos = num;
  }

  selectComposition(composition: string): void {
    this.searchRequest.composition = composition;
  }

  selectWatermark(option: {value: boolean; viewValue: string}): void {
    this.searchRequest.addWatermark = option.value;
    this.selectedWatermark = option.viewValue;
  }

  addNegativePhrase(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) this.negativePhrases.push(value);

    // Clear the input value
    event.chipInput!.clear();
  }

  removeNegativePhrase(phrase: string): void {
    const index = this.negativePhrases.indexOf(phrase);
    if (index >= 0) this.negativePhrases.splice(index, 1);
  }

  searchTerm() {
    if (!this.searchRequest.prompt) return;

    this.isLoading = true;
    this.videoDocuments = [];
    this.lightGalleryInstance?.destroy();

    this.service
      .searchVeo(this.searchRequest)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (searchResponse: GeneratedVideo[]) => {
          this.processSearchResults(searchResponse);
        },
        error: error => {
          console.error('Search error:', error);
          const errorMessage =
            error?.error?.detail?.[0]?.msg ||
            error?.message ||
            'Something went wrong';
          this._snackBar.openFromComponent(ToastMessageComponent, {
            panelClass: ['red-toast'],
            verticalPosition: 'top',
            horizontalPosition: 'right',
            duration: 6000,
            data: {text: errorMessage, icon: 'cross-in-circle-white'},
          });
        },
      });
  }
}
