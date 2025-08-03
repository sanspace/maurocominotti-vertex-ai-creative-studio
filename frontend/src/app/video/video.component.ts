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
import {GalleryItem} from 'lightgallery/lg-utils';
import lgVideo from 'lightgallery/plugins/video';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrl: './video.component.scss',
})
export class VideoComponent {
  // --- Component State ---
  videoDocuments: GeneratedVideo[] = [];
  isLoading = false;
  isAudioGenerationDisabled = false;
  showDefaultDocuments = false;

  // --- Search Request Object ---
  // This object holds the current state of all user selections.
  searchRequest: VeoRequest = {
    prompt:
      'Create an ad for Cymball consisting in the following: In a sunlit Scandinavian bedroom, a single, sealed Cymball box sits in the center of the otherwise empty room. From a fixed, wide-angle cinematic shot, the box trembles and opens. In a rapid, hyper-lapse sequence, furniture pieces assemble themselves precisely, quickly filling the space with a bed, wardrobe, shelves, and other decor! The action concludes as a yellow Cymball throw blanket lands perfectly on the bed, leaving a calm, fully furnished, and serene modern room. you can see the box placed in the front of the bed, with the Cymball logo at the end',
    generationModel: 'veo-3.0-generate-preview',
    aspectRatio: '16:9',
    videoStyle: 'Modern',
    numberOfVideos: 4,
    lighting: 'Cinematic',
    colorAndTone: 'Vibrant',
    composition: 'Closeup',
    negativePrompt: '',
    generateAudio: true,
    durationSeconds: 8,
  };

  // --- Negative Prompt Chips ---
  negativePhrases: string[] = [];

  // --- Dropdown Options ---
  generationModels = [
    {
      value: 'veo-3.0-generate-preview',
      viewValue: 'Veo 3 Quality \n (Beta Audio)',
    },
    {
      value: 'veo-3.0-fast-generate-preview',
      viewValue: 'Veo 3 Fast \n (Beta Audio)',
    },
    {value: 'veo-2.0-generate-001', viewValue: 'Veo 2 Quality \n (No Audio)'},
    {value: 'veo-2.0-fast-generate-001', viewValue: 'Veo 2 Fast \n (No Audio)'},
  ];
  selectedGenerationModel = this.generationModels[0].viewValue;
  aspectRatioOptions: {value: string; viewValue: string; disabled: boolean}[] =
    [
      {value: '16:9', viewValue: '1200x628 \n Landscape', disabled: false},
      {value: '9:16', viewValue: '1080x1920 \n Story', disabled: true},
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
  durationOptions = [1, 2, 3, 4, 5, 6, 7, 8];
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

    if (galleryElement) {
      const dynamicElements = this.videoDocuments.map((mediaItem, index) => {
        const dynamicVideo: GalleryItem = {
          src: '',
          thumb: mediaItem?.video?.presignedThumbnailUrl || '',
          subHtml: `<div class="lightGallery-captions"><h4>Video ${index + 1} of ${this.videoDocuments?.length}</h4><p>${mediaItem?.originalPrompt || ''}</p></div>`,
          downloadUrl: mediaItem?.video?.presignedUrl,
          video: {
            source: [
              {
                src: mediaItem?.video?.presignedUrl || '',
                type: mediaItem?.video?.mimeType || 'video/mp4',
              },
            ],
            tracks: [],
            // The type definition for 'attributes' is incorrectly expecting a full
            // HTMLVideoElement object. We cast to 'any' to provide a plain object
            // of attributes, which is what the library actually uses.
            attributes: {preload: 'metadata', controls: true} as any,
          },
        };
        return dynamicVideo;
      });

      this.lightGalleryInstance = lightGallery(galleryElement, {
        container: galleryElement,
        dynamic: true,
        plugins: [lgZoom, lgShare, lgThumbnail, lgVideo],
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

    const isVeo2 = model.value.includes('veo-2.0');

    if (isVeo2) {
      // Veo 2 models do not support audio.
      this.isAudioGenerationDisabled = true;
      this.searchRequest.generateAudio = false;

      // Re-enable all aspect ratios for Veo 2.
      this.aspectRatioOptions.forEach(opt => (opt.disabled = false));
    } else {
      // Veo 3 models support audio.
      this.isAudioGenerationDisabled = false;

      // Veo 3 only supports 16:9 aspect ratio.
      this.searchRequest.aspectRatio = '16:9';
      const landscapeOption = this.aspectRatioOptions.find(
        opt => opt.value === '16:9',
      )!;
      this.selectedAspectRatio = landscapeOption.viewValue;

      this.aspectRatioOptions.forEach(opt => {
        opt.disabled = opt.value !== '16:9';
      });
    }
  }

  selectAspectRatio(ratio: string): void {
    this.searchRequest.aspectRatio = ratio;
    const selectedOption = this.aspectRatioOptions.find(
      opt => opt.value === ratio,
    );
    if (selectedOption) {
      this.selectedAspectRatio = selectedOption.viewValue;
    }
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

  selectDuration(seconds: number): void {
    this.searchRequest.durationSeconds = seconds;
  }

  selectComposition(composition: string): void {
    this.searchRequest.composition = composition;
  }

  toggleAudio(): void {
    if (!this.isAudioGenerationDisabled) {
      this.searchRequest.generateAudio = !this.searchRequest.generateAudio;
    }
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

  rewritePrompt() {
    if (!this.searchRequest.prompt) return;

    this.isLoading = true;
    const promptToSend = this.searchRequest.prompt;
    this.searchRequest.prompt = '';
    this.service
      .rewritePrompt({
        targetType: 'video',
        userPrompt: promptToSend,
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response: {prompt: string}) => {
          this.searchRequest.prompt = response.prompt;
        },
        error: error => {
          this.handleError(error, 'Rewrite prompt');
        },
      });
  }

  getRandomPrompt() {
    this.isLoading = true;
    this.searchRequest.prompt = '';
    this.service
      .getRandomPrompt({target_type: 'video'})
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response: {prompt: string}) => {
          this.searchRequest.prompt = response.prompt;
        },
        error: error => {
          this.handleError(error, 'Get random prompt');
        },
      });
  }

  resetAllFilters() {
    this.searchRequest = {
      prompt: '',
      generationModel: 'veo-3.0-generate-preview',
      aspectRatio: '16:9',
      videoStyle: 'Modern',
      numberOfVideos: 4,
      lighting: 'Cinematic',
      colorAndTone: 'Vibrant',
      composition: 'Closeup',
      negativePrompt: '',
      generateAudio: true,
      durationSeconds: 8,
    };
  }

  private handleError(error: any, context: string) {
    console.error(`${context} error:`, error);
    const errorMessage =
      error?.error?.detail?.[0]?.msg ||
      error?.message ||
      'Something went wrong';
    this._snackBar.openFromComponent(ToastMessageComponent, {
      panelClass: ['red-toast'],
      verticalPosition: 'top',
      horizontalPosition: 'right',
      duration: 6000,
      data: {
        text: errorMessage,
        icon: 'cross-in-circle-white',
      },
    });
  }
}
