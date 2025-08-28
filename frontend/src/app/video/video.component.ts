import {Component, OnDestroy} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {finalize, Observable, Subscription, switchMap, timer} from 'rxjs';
import {SearchService} from '../services/search/search.service';
import {Router} from '@angular/router';
import {VeoRequest} from '../common/models/search.model';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ToastMessageComponent} from '../common/components/toast-message/toast-message.component';
import {GenerationParameters} from '../fun-templates/media-template.model';
import {handleErrorSnackbar} from '../utils/handleErrorSnackbar';
import {JobStatus, MediaItem} from '../common/models/media-item.model';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrl: './video.component.scss',
})
export class VideoComponent {
  // This observable will always reflect the current job's state
  activeVideoJob$: Observable<MediaItem | null>;
  public readonly JobStatus = JobStatus; // Expose enum to the template

  templateParams: GenerationParameters | undefined;

  // --- Component State ---
  videoDocuments: MediaItem | null = null;
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
    style: 'Modern',
    numberOfMedia: 4,
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

  constructor(
    private sanitizer: DomSanitizer,
    public matIconRegistry: MatIconRegistry,
    private service: SearchService,
    public router: Router,
    private _snackBar: MatSnackBar,
  ) {
    this.activeVideoJob$ = this.service.activeVideoJob$;

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

    this.templateParams =
      this.router.getCurrentNavigation()?.extras.state?.['templateParams'];
    this.applyTemplateParameters();
  }

  private path = '../../assets/images';

  private setPath(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
    this.searchRequest.style = style;
  }

  selectLighting(lighting: string): void {
    this.searchRequest.lighting = lighting;
  }

  selectColor(color: string): void {
    this.searchRequest.colorAndTone = color;
  }

  selectNumberOfVideos(num: number): void {
    this.searchRequest.numberOfMedia = num;
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
    this.videoDocuments = null;

    this.service
      .startVeoGeneration(this.searchRequest)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (initialResponse: MediaItem) => {
          // This logic is now handled by the 'tap' operator in the service,
          // but it's fine to also have it here. The key is the 'error' block.
          console.log('Job started successfully:', initialResponse);
          // The component's main display will be driven by the service's observable
        },
        error: error => {
          // This block will now execute correctly if the POST request fails.
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
          handleErrorSnackbar(this._snackBar, error, 'Rewrite prompt');
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
          handleErrorSnackbar(this._snackBar, error, 'Get random prompt');
        },
      });
  }

  resetAllFilters() {
    this.searchRequest = {
      prompt: '',
      generationModel: 'veo-3.0-generate-preview',
      aspectRatio: '16:9',
      style: 'Modern',
      numberOfMedia: 4,
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

  private applyTemplateParameters(): void {
    console.log('Applying template parameters:', this.templateParams);

    if (!this.templateParams) {
      return;
    }

    if (this.templateParams.prompt) {
      this.searchRequest.prompt = this.templateParams.prompt;
    }

    if (this.templateParams.numMedia) {
      console.log('Setting number of images:', this.templateParams.numMedia);
      this.searchRequest.numberOfMedia = this.templateParams.numMedia;
    }

    if (this.templateParams.model) {
      const templateModel = this.templateParams.model;
      const modelOption = this.generationModels.find(m =>
        m.value.toLowerCase().includes(templateModel.toLowerCase()),
      );
      if (modelOption) {
        this.searchRequest.generationModel = modelOption.value;
        this.selectedGenerationModel = modelOption.viewValue;
      }
    }

    if (this.templateParams.aspectRatio) {
      const templateAspectRatio = this.templateParams.aspectRatio;
      const aspectRatioOption = this.aspectRatioOptions.find(
        r => r.value === templateAspectRatio,
      );
      if (aspectRatioOption) {
        this.searchRequest.aspectRatio = aspectRatioOption.value;
        this.selectedAspectRatio = aspectRatioOption.viewValue;
      }
    }

    if (this.templateParams.durationSeconds)
      this.searchRequest.durationSeconds = this.templateParams.durationSeconds;

    if (this.templateParams.style) {
      this.searchRequest.style = this.templateParams.style;
    }

    if (this.templateParams.lighting) {
      this.searchRequest.lighting = this.templateParams.lighting;
    }

    if (this.templateParams.colorAndTone) {
      this.searchRequest.colorAndTone = this.templateParams.colorAndTone;
    }

    if (this.templateParams.composition) {
      this.searchRequest.composition = this.templateParams.composition;
    }

    if (this.templateParams.negativePrompt) {
      this.negativePhrases = this.templateParams.negativePrompt
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean);
      this.searchRequest.negativePrompt = this.negativePhrases.join(', ');
    }
  }
}
