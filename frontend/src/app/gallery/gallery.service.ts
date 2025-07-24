import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, concat } from 'rxjs';
import { tap, catchError, shareReplay } from 'rxjs/operators';
import { MediaItem, PaginatedGalleryResponse } from '../common/models/media-item.model';
import { environment } from '../../environments/environment';
import {GallerySearchDto} from '../common/models/search.model';
import {LoadingService} from '../common/services/loading.service';

export interface GalleryFilters {
  user_email?: string;
  mime_type?: string;
  model?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private imagesCache$ = new BehaviorSubject<MediaItem[]>([]);
  public isLoading$ = new BehaviorSubject<boolean>(false);
  private allImagesLoaded$ = new BehaviorSubject<boolean>(false);
  private nextPageCursor: string | null = null;
  private allFetchedImages: MediaItem[] = [];
  private filters$ = new BehaviorSubject<GalleryFilters>({});

  constructor(private http: HttpClient, private loadingService: LoadingService) {}

  get images$(): Observable<MediaItem[]> {
    return this.imagesCache$.asObservable();
  }

  get allImagesLoaded(): Observable<boolean> {
    return this.allImagesLoaded$.asObservable();
  }

  setFilters(filters: GalleryFilters) {
    this.filters$.next(filters);
    this.loadGallery(true);
  }

  loadGallery(reset = false): void {
    // Do not load more if we are already loading or if all images have been loaded.
    if (this.isLoading$.value) {
      return;
    }

    if (reset) {
      this.allFetchedImages = [];
      this.nextPageCursor = null;
      this.allImagesLoaded$.next(false);
      this.loadingService.hide();
    }

    // Do not try to load more if all items have already been loaded
    if (this.allImagesLoaded$.value) {
      return;
    }

    this.fetchImages().pipe(
      tap(response => {
        this.nextPageCursor = response.next_page_cursor;
        // Accumulate images in our central cache and push the new list to subscribers
        this.allFetchedImages = [...this.allFetchedImages, ...response.items];
        this.imagesCache$.next(this.allFetchedImages);

        if (!this.nextPageCursor) {
          this.allImagesLoaded$.next(true);
        }
        this.isLoading$.next(false);
        this.loadingService.hide();
      }),
      catchError(err => {
        console.error('Failed to fetch gallery images', err);
        this.isLoading$.next(false);
        this.loadingService.hide();
        this.allImagesLoaded$.next(true); // prevent loading more
        return of([]); // Return an empty array observable to prevent breaking the stream
      })
    ).subscribe();
  }

  private fetchImages(): Observable<PaginatedGalleryResponse> {
    this.isLoading$.next(true);
    this.loadingService.show();
    const galleryUrl = `${environment.backendURL}/gallery`;
    const currentFilters = this.filters$.value;

    const body: GallerySearchDto = {
      limit: 20,
      ...currentFilters,
    };

    if (this.nextPageCursor) {
      body.start_after = this.nextPageCursor;
    }
    return this.http.post<PaginatedGalleryResponse>(galleryUrl, body).pipe(
      shareReplay(1) // important to cache the http get response
    );
  }

  getMedia(id: string): Observable<MediaItem> {
    this.loadingService.show();
    const detailUrl = `${environment.backendURL}/gallery/item/${id}`;
    return this.http.get<MediaItem>(detailUrl);
  }
}
