import {Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {MediaItem} from '../../models/media-item.model';

@Component({
  selector: 'app-image-selector',
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.scss'],
})
export class ImageSelectorComponent {
  constructor(public dialogRef: MatDialogRef<ImageSelectorComponent>) {}

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;

    if (fileList && fileList[0]) {
      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.dialogRef.close(e.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }

  onMediaItemSelected(mediaItem: MediaItem): void {
    if (mediaItem.presignedUrls && mediaItem.presignedUrls.length > 0) {
      this.dialogRef.close(mediaItem.presignedUrls[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files[0]) {
      const file = event.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.dialogRef.close(e.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }
}


