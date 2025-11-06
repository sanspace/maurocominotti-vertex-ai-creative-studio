import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MediaItem } from '../../common/models/media-item.model';

export interface LyriaRequest {
  prompt: string;
  negative_prompt?: string;
  seed?: number;
  sample_count?: number;
  workspace_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class LyriaService {
  private apiUrl = '/api/audios/lyria';

  constructor(private http: HttpClient) { }

  generateAudio(request: LyriaRequest): Observable<MediaItem> {
    return this.http.post<MediaItem>(this.apiUrl, request);
  }
}
