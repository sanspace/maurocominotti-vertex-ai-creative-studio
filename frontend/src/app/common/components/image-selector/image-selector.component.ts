import {Component, Inject} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import {MediaItem} from '../../models/media-item.model';
import {SourceAssetResponseDto} from '../../services/source-asset.service';
import {AssetTypeEnum} from '../../../admin/source-assets-management/source-asset.model';
import {ImageCropperDialogComponent} from '../image-cropper-dialog/image-cropper-dialog.component';
import {finalize, Observable} from 'rxjs';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../../environments/environment';

export interface MediaItemSelection {
  mediaItem: MediaItem;
  selectedIndex: number;
}

@Component({
  selector: 'app-image-selector',
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.scss'],
})
export class ImageSelectorComponent {
  isUploading = false;

  constructor(
    public dialogRef: MatDialogRef<ImageSelectorComponent>,
    private workspaceStateService: WorkspaceStateService,
    private http: HttpClient,
    private dialog: MatDialog, // Inject MatDialog to open the new dialog
    @Inject(MAT_DIALOG_DATA)
    public data: {
      mimeType: 'image/*' | 'image/png' | 'video/mp4' | null;
      assetType: AssetTypeEnum;
    },
  ) {}

  // This method is called by the file input or drop event inside this component
  handleFileSelect(file: File): void {
    if (file.type.startsWith('image/')) {
      // If it's an image, open the cropper dialog
      const cropperDialogRef = this.dialog.open(ImageCropperDialogComponent, {
        data: {
          imageFile: file,
          assetType: this.data.assetType,
        },
        width: '600px',
      });

      cropperDialogRef
        .afterClosed()
        .subscribe((asset: SourceAssetResponseDto) => {
          if (asset) {
            this.dialogRef.close(asset);
          }
        });
    } else if (file.type.startsWith('video/')) {
      // If it's a video, upload it directly from here
      this.isUploading = true;
      this.uploadVideoDirectly(file)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe(asset => {
          this.dialogRef.close(asset);
        });
    } else {
      console.error('Unsupported file type selected.');
    }
  }

  private uploadVideoDirectly(file: File): Observable<SourceAssetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    const activeWorkspaceId = this.workspaceStateService.getActiveWorkspaceId();
    if (activeWorkspaceId) {
      formData.append('workspaceId', activeWorkspaceId);
    }
    // We don't send aspect ratio for videos, backend will deduce it
    return this.http.post<SourceAssetResponseDto>(
      `${environment.backendURL}/source_assets/upload`,
      formData,
    );
  }

  // Update onFileSelected and onDrop to use the new handler
  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList[0]) {
      this.handleFileSelect(fileList[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files[0]) {
      this.handleFileSelect(event.dataTransfer.files[0]);
    }
  }

  openCropperDialog(file: File): void {
    if (file.type.startsWith('image/')) {
      this.dialogRef.close();

      this.dialog.open(ImageCropperDialogComponent, {
        data: {
          imageFile: file,
          assetType: this.data.assetType,
        },
        width: '600px',
      });
    } else {
      console.log('File is not an image, cannot open cropper.');
    }
  }

  onMediaItemSelected(selection: MediaItemSelection): void {
    this.dialogRef.close(selection);
  }

  onAssetSelected(asset: SourceAssetResponseDto): void {
    this.dialogRef.close(asset);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
}
