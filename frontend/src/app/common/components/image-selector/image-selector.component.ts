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
  constructor(
    public dialogRef: MatDialogRef<ImageSelectorComponent>,
    private dialog: MatDialog, // Inject MatDialog to open the new dialog
    @Inject(MAT_DIALOG_DATA)
    public data: {
      mimeType: 'image/*' | 'image/png' | 'video/mp4' | null;
      assetType: AssetTypeEnum;
    },
  ) {}

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList[0]) {
      this.openCropperDialog(fileList[0]);
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files[0]) {
      this.openCropperDialog(event.dataTransfer.files[0]);
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
