import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import {MediaItem} from '../common/models/media-item.model';
import {HttpClient} from '@angular/common/http';
import {VtoRequest} from './vto.model';
import {environment} from '../../environments/environment';
import {MatDialog} from '@angular/material/dialog';
import {ImageSelectorComponent} from '../common/components/image-selector/image-selector.component';
import {SourceAssetResponseDto} from '../common/services/source-asset.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {finalize, Observable} from 'rxjs';
import {handleErrorSnackbar} from '../utils/handleErrorSnackbar';

interface Garment {
  id: string;
  name: string;
  imageUrl: string;
  type: 'top' | 'bottom' | 'dress' | 'shoes';
}

interface Model {
  id: string;
  name: string;
  imageUrl: string;
  gcsUri?: string;
  size: string;
}

@Component({
  selector: 'app-vto',
  templateUrl: './vto.component.html',
  styleUrls: ['./vto.component.scss'],
})
export class VtoComponent {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;

  isLoading = false;
  imagenDocuments: MediaItem | null = null;

  selectedTop: Garment | null = null;
  selectedBottom: Garment | null = null;
  selectedDress: Garment | null = null;
  selectedShoes: Garment | null = null;

  uploadExamples: {imageUrl: string; alt: string}[] = [
    {
      imageUrl: 'assets/images/vto/upload-photo-1.png',
      alt: 'Well-lit, full body example 1',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-2.png',
      alt: 'Well-lit, full body example 2',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-3.png',
      alt: 'Well-lit, full body example 3',
    },
    {
      imageUrl: 'assets/images/vto/upload-photo-4.png',
      alt: 'Well-lit, full body example 4',
    },
  ];

  // Mock data
  femaleModels: Model[] = [
    {
      id: 'f0',
      name: 'Female Model 1',
      imageUrl: 'assets/images/vto/arml_Model-0.png',
      size: 'XS',
    },
    {
      id: 'f1',
      name: 'Female Model 2',
      imageUrl: 'assets/images/vto/arml_Model-1.png',
      size: 'S',
    },
    {
      id: 'f2',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-2.png',
      size: 'S',
    },
    {
      id: 'f3',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-3.png',
      size: 'M',
    },
    {
      id: 'f6',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-6.png',
      size: 'L',
    },
    {
      id: 'f7',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-7.png',
      size: 'L',
    },
    {
      id: 'f8',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-8.png',
      size: 'L',
    },
    {
      id: 'f9',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-9.png',
      size: 'L',
    },
    {
      id: 'f10',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-10.png',
      size: 'XL',
    },
    {
      id: 'f11',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-11.png',
      size: 'XL',
    },
    {
      id: 'f12',
      name: 'Female Model 3',
      imageUrl: 'assets/images/vto/arml_Model-12.png',
      size: 'XL',
    },
  ];

  maleModels: Model[] = [
    {
      id: 'm1',
      name: 'Male Model 1',
      imageUrl: 'assets/images/vto/arml_Model-0.png',
      size: 'M',
    },
    {
      id: 'm2',
      name: 'Male Model 2',
      imageUrl: 'assets/images/vto/arml_Model-1.png',
      size: 'L',
    },
    {
      id: 'm3',
      name: 'Male Model 3',
      imageUrl: 'assets/images/vto/arml_Model-2.png',
      size: 'XL',
    },
  ];

  tops: Garment[] = [
    {
      id: 't0',
      name: 'White T-Shirt',
      imageUrl: 'assets/images/vto/top-0.png',
      type: 'top',
    },
    {
      id: 't1',
      name: 'White T-Shirt',
      imageUrl: 'assets/images/vto/top-1.png',
      type: 'top',
    },
    {
      id: 't2',
      name: 'Black Blouse',
      imageUrl: 'assets/images/vto/top-2.png',
      type: 'top',
    },
    {
      id: 't3',
      name: 'Striped Shirt',
      imageUrl: 'assets/images/vto/top-3.png',
      type: 'top',
    },
    {
      id: 't4',
      name: 'Striped Shirt',
      imageUrl: 'assets/images/vto/top-4.png',
      type: 'top',
    },
    {
      id: 't5',
      name: 'Striped Shirt',
      imageUrl: 'assets/images/vto/top-5.png',
      type: 'top',
    },
    {
      id: 't6',
      name: 'Striped Shirt',
      imageUrl: 'assets/images/vto/top-6.png',
      type: 'top',
    },
  ];

  bottoms: Garment[] = [
    {
      id: 'b0',
      name: 'Blue Jeans',
      imageUrl: 'assets/images/vto/bottom-0.png',
      type: 'bottom',
    },
    {
      id: 'b1',
      name: 'Blue Jeans',
      imageUrl: 'assets/images/vto/bottom-1.png',
      type: 'bottom',
    },
    {
      id: 'b2',
      name: 'Black Trousers',
      imageUrl: 'assets/images/vto/bottom-2.png',
      type: 'bottom',
    },
    {
      id: 'b3',
      name: 'Khaki Shorts',
      imageUrl: 'assets/images/vto/bottom-3.png',
      type: 'bottom',
    },
    {
      id: 'b4',
      name: 'Khaki Shorts',
      imageUrl: 'assets/images/vto/bottom-4.png',
      type: 'bottom',
    },
    {
      id: 'b5',
      name: 'Khaki Shorts',
      imageUrl: 'assets/images/vto/bottom-5.png',
      type: 'bottom',
    },
    {
      id: 'b6',
      name: 'Khaki Shorts',
      imageUrl: 'assets/images/vto/bottom-6.png',
      type: 'bottom',
    },
  ];

  dresses: Garment[] = [
    {
      id: 'd0',
      name: 'Summer Dress',
      imageUrl: 'assets/images/vto/dress-0.png',
      type: 'dress',
    },
    {
      id: 'd1',
      name: 'Summer Dress',
      imageUrl: 'assets/images/vto/dress-1.png',
      type: 'dress',
    },
    {
      id: 'd2',
      name: 'Evening Gown',
      imageUrl: 'assets/images/vto/dress-2.png',
      type: 'dress',
    },
    {
      id: 'd3',
      name: 'Casual Dress',
      imageUrl: 'assets/images/vto/dress-3.png',
      type: 'dress',
    },
    {
      id: 'd4',
      name: 'Casual Dress',
      imageUrl: 'assets/images/vto/dress-4.png',
      type: 'dress',
    },
    {
      id: 'd5',
      name: 'Casual Dress',
      imageUrl: 'assets/images/vto/dress-5.png',
      type: 'dress',
    },
    {
      id: 'd6',
      name: 'Casual Dress',
      imageUrl: 'assets/images/vto/dress-6.png',
      type: 'dress',
    },
  ];

  shoes: Garment[] = [
    {
      id: 's0',
      name: 'White Sneakers',
      imageUrl: 'assets/images/vto/shoes-0.png',
      type: 'shoes',
    },
    {
      id: 's2',
      name: 'Brown Boots',
      imageUrl: 'assets/images/vto/shoes-2.png',
      type: 'shoes',
    },
    {
      id: 's3',
      name: 'Black Heels',
      imageUrl: 'assets/images/vto/shoes-3.png',
      type: 'shoes',
    },
    {
      id: 's4',
      name: 'Black Heels',
      imageUrl: 'assets/images/vto/shoes-4.png',
      type: 'shoes',
    },
    {
      id: 's5',
      name: 'Black Heels',
      imageUrl: 'assets/images/vto/shoes-5.png',
      type: 'shoes',
    },
    {
      id: 's6',
      name: 'Black Heels',
      imageUrl: 'assets/images/vto/shoes-6.png',
      type: 'shoes',
    },
  ];

  modelsToShow: Model[] = this.femaleModels;

  constructor(
    private readonly _formBuilder: FormBuilder,
    private readonly http: HttpClient,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
  ) {
    this.firstFormGroup = this._formBuilder.group({
      modelType: ['female', Validators.required],
      model: [null, Validators.required],
    });

    this.secondFormGroup = this._formBuilder.group({
      top: [null],
      bottom: [null],
      dress: [null],
      shoes: [null],
    });

    this.firstFormGroup.get('modelType')?.valueChanges.subscribe(val => {
      this.modelsToShow =
        val === 'female' ? this.femaleModels : this.maleModels;
      this.firstFormGroup.get('model')?.reset(); // Also clear uploaded model
      this.imagenDocuments = null;
    });

    this.firstFormGroup.get('model')?.valueChanges.subscribe(() => {
      this.imagenDocuments = null;
    });

    this.secondFormGroup.get('top')?.valueChanges.subscribe(top => {
      this.selectedTop = top;
      if (top) {
        this.selectedDress = null;
        this.secondFormGroup.get('dress')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('bottom')?.valueChanges.subscribe(bottom => {
      this.selectedBottom = bottom;
      if (bottom) {
        this.selectedDress = null;
        this.secondFormGroup.get('dress')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('dress')?.valueChanges.subscribe(dress => {
      this.selectedDress = dress;
      if (dress) {
        this.selectedTop = null;
        this.selectedBottom = null;
        this.secondFormGroup.get('top')?.reset(null, {emitEvent: false});
        this.secondFormGroup.get('bottom')?.reset(null, {emitEvent: false});
      }
    });
    this.secondFormGroup.get('shoes')?.valueChanges.subscribe(shoes => {
      this.selectedShoes = shoes;
    });
  }

  openImageSelector() {
    const dialogRef = this.dialog.open(ImageSelectorComponent, {
      width: '90vw',
      height: '80vh',
      maxWidth: '90vw',
      panelClass: 'image-selector-dialog',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: MediaItem | SourceAssetResponseDto) => {
        if (result) {
          const uploadedModel: Model = {
            id: 'uploaded',
            name: 'Uploaded Model',
            imageUrl:
              'presignedUrl' in result
                ? result.presignedUrl
                : result.presignedUrls![0],
            gcsUri: 'gcsUri' in result ? result.gcsUri : result.gcsUris[0],
            size: 'custom',
          };

          this.firstFormGroup.get('model')?.setValue(uploadedModel);
        }
      });
  }

  private uploadAsset(file: File): Observable<SourceAssetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<SourceAssetResponseDto>(
      `${environment.backendURL}/source_assets/upload`,
      formData,
    );
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.isLoading = true;
      this.uploadAsset(file)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: asset => {
            const uploadedModel: Model = {
              id: 'uploaded',
              name: asset.originalFilename,
              imageUrl: asset.presignedUrl,
              gcsUri: asset.gcsUri,
              size: 'custom',
            };
            this.firstFormGroup.get('model')?.setValue(uploadedModel);
          },
          error: error => {
            handleErrorSnackbar(this._snackBar, error, 'Image upload');
          },
        });
    }
  }

  clearImage(event: MouseEvent) {
    event.stopPropagation();
    this.firstFormGroup.get('model')?.reset();
  }

  selectGarment(garment: Garment, type: 'top' | 'bottom' | 'dress' | 'shoes') {
    const control = this.secondFormGroup.get(type);
    if (control?.value?.id === garment.id) {
      control?.setValue(null);
    } else {
      control?.setValue(garment);
    }
  }

  tryOn() {
    const selectedModel = this.firstFormGroup.get('model')?.value;
    if (!selectedModel) {
      console.error('No model selected.');
      return;
    }

    this.isLoading = true;

    let personGcsUri: string;

    if (
      this.imagenDocuments &&
      this.imagenDocuments.gcsUris &&
      this.imagenDocuments.gcsUris.length > 0
    ) {
      personGcsUri = this.imagenDocuments.gcsUris[0];
    } else if (selectedModel.gcsUri) {
      personGcsUri = selectedModel.gcsUri;
    } else {
      // This case is for pre-loaded models that don't have a GCS URI yet.
      // The backend will need to handle resolving the asset path.
      // For this to work, the backend needs to know how to map this path to a GCS URI.
      // A better long-term solution would be to ensure all models have a GCS URI.
      personGcsUri = selectedModel.imageUrl;
    }

    const payload: VtoRequest = {
      number_of_media: 1, // Defaulting to 1 as per DTO
      person_image: {gcs_uri: personGcsUri},
    };

    // For garments, we assume the imageUrl is a GCS URI or a path the backend can resolve.
    if (this.selectedTop)
      payload.top_image = {gcs_uri: this.selectedTop.imageUrl};
    if (this.selectedBottom)
      payload.bottom_image = {gcs_uri: this.selectedBottom.imageUrl};
    if (this.selectedDress)
      payload.dress_image = {gcs_uri: this.selectedDress.imageUrl};
    if (this.selectedShoes)
      payload.shoe_image = {gcs_uri: this.selectedShoes.imageUrl};

    console.log('Triggering VTO request with:', payload);

    this.http
      .post<MediaItem>(
        `${environment.backendURL}/images/generate-images-for-vto`,
        payload,
      )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: response => {
          this.imagenDocuments = response;
          // Also update the preview model to reflect the latest generation
          // for the next iterative step.
          if (
            selectedModel &&
            response.presignedUrls &&
            response.presignedUrls.length > 0
          ) {
            selectedModel.imageUrl = response.presignedUrls[0];
            if (response.gcsUris && response.gcsUris.length > 0) {
              selectedModel.gcsUri = response.gcsUris[0];
            }
          }
        },
        error: err => {
          handleErrorSnackbar(this._snackBar, err, 'Virtual Try-On');
        },
      });
  }
}
