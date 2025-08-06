import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserWhitelist as User } from './user-whitelist.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  // Add styleUrls if you need specific styles for the form
})
export class UserFormComponent implements OnInit {
  userForm: FormGroup;
  isEditMode: boolean = false;
  emailRegex = environment.EMAIL_REGEX;

  constructor(
    public dialogRef: MatDialogRef<UserFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: User, // Data passed to the dialog (user object for editing)
    private fb: FormBuilder
  ) {
    this.isEditMode = !!data?.id; // If data has an id, it's edit mode

    this.userForm = this.fb.group({
      id: [data?.id || null], // Keep id for updates, null for new
      email: [data?.email || '', [Validators.required, Validators.pattern(this.emailRegex)]],
      // Add other form controls based on your UserWhitelist model if needed
      // e.g., username: [data?.username || '', Validators.required],
    });
  }

  ngOnInit(): void {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      this.dialogRef.close(this.userForm.value); // Pass the form value back
    } else {
      this.userForm.markAllAsTouched(); // Show validation errors
    }
  }
}
