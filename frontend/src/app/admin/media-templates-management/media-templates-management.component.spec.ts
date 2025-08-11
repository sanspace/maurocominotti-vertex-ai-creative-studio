import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { MediaTemplatesManagementComponent } from './media-templates-management.component';

describe('MediaTemplatesManagementComponent', () => {
  let component: MediaTemplatesManagementComponent;
  let fixture: ComponentFixture<MediaTemplatesManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaTemplatesManagementComponent, NoopAnimationsModule],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MediaTemplatesManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
