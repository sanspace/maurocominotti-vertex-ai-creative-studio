import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAssetGalleryComponent } from './user-asset-gallery.component';

describe('UserAssetGalleryComponent', () => {
  let component: UserAssetGalleryComponent;
  let fixture: ComponentFixture<UserAssetGalleryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserAssetGalleryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserAssetGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
