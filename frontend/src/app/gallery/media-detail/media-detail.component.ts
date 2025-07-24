import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';

import lightGallery from 'lightgallery';
import { LightGallery } from 'lightgallery/lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import {InitDetail} from 'lightgallery/lg-events';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgShare from 'lightgallery/plugins/share';
import lgVideo from 'lightgallery/plugins/video';
import {additionalShareOptions} from '../../utils/lightgallery-share-options';
import { MediaItem } from '../../common/models/media-item.model';
import { GalleryService } from '../gallery.service';
import {LoadingService} from '../../common/services/loading.service';

@Component({
  selector: 'app-media-detail',
  templateUrl: './media-detail.component.html',
  styleUrls: ['./media-detail.component.scss']
})
export class MediaDetailComponent implements OnInit, OnDestroy {
  private routeSub?: Subscription;
  private mediaSub?: Subscription;
  private lightGalleryInstance?: LightGallery;
  settings = {
    dynamic: false,
    plugins: [lgZoom, lgThumbnail, lgShare, lgVideo],
    download: true,
    share: true,
    additionalShareOptions: additionalShareOptions,
    hash: false,
    closable: true,
    showMaximizeIcon: false,
    slideDelay: 200,
    thumbnail: true,
  };

  public isLoading = true;
  public mediaItem: MediaItem | undefined;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private galleryService: GalleryService,
    private loadingService: LoadingService
  ) {
    // Get the media item from the router state
    this.mediaItem = this.router.getCurrentNavigation()?.extras.state?.['mediaItem'];
    console.log("this.router.getCurrentNavigation()", this.router.getCurrentNavigation())
    console.log("mediaItem", this.mediaItem)

    if (this.mediaItem) {
        // If we have the media item, we don't need to load it
        this.loadingService.hide();
        this.isLoading = false;
    } else {
        // If not, fetch the media item using the ID from the route params
        this.fetchMediaItem();
    }
  }

  ngOnInit(): void {}

  fetchMediaItem() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchMediaDetails(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.mediaSub?.unsubscribe();
    this.lightGalleryInstance?.destroy();
  }

  fetchMediaDetails(id: string): void {
    this.mediaSub = this.galleryService.getMedia(id).subscribe({
      next: (data) => {
        this.mediaItem = data;
        this.isLoading = false;
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Failed to fetch media details', err);
        this.isLoading = false;
        this.loadingService.hide();
      }
    });
  }

  initLightGallery(detail: InitDetail): void {
    this.lightGalleryInstance = detail.instance;
  }

  goBack(): void {
    this.location.back();
  }
}
