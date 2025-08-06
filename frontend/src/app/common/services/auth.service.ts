/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable, PLATFORM_ID, inject} from '@angular/core';
import {Router} from '@angular/router';
import {UserData} from '../models/user.model';
import {HttpClient, HttpHeaders, HttpErrorResponse} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {Auth, IdTokenResult} from '@angular/fire/auth';
import {UserService} from '../services/user.service';
import {
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
} from '@angular/fire/auth';
import {Observable, from, throwError, of} from 'rxjs';
import {catchError, tap, map, switchMap} from 'rxjs/operators';
import {isPlatformBrowser} from '@angular/common';

// Declare the 'google' global object from the Google Identity Services script
declare const google: any;

const FIREBASE_SESSION_KEY = 'firebase_session';
const USER_DETAILS = 'USER_DETAILS';
const LOGIN_ROUTE = '/login';

interface FirebaseSession {
  token: string;
  expiry: number; // Expiration timestamp in milliseconds
}

const loginInfoUrl = `${environment.backendURL}/login-info`;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth: Auth = inject(Auth);
  private platformId = inject(PLATFORM_ID);
  private readonly provider: GoogleAuthProvider = new GoogleAuthProvider();

  // Store token temporarily in memory for the session
  private currentOAuthAccessToken: string | null = null;
  private firebaseIdToken: string | null = null; // To store the Firebase token for the test
  private firebaseTokenExpiry: number | null = null; // To store token expiration time (in ms)
  private allowedAdminEmails: string[] = [
    'maurocominotti@google.com',
    'robbysingh@google.com',
  ];

  constructor(
    private router: Router,
    private httpClient: HttpClient,
    private userService: UserService,
  ) {
    this.provider.setCustomParameters({
      // Set custom params for the provider
      prompt: 'select_account',
    });
    this.loadSessionFromStorage();
  }

  /**
   * A test sign-in method to get a Google ID token compatible with Firebase.
   *
   * @returns An Observable that emits the Firebase-compatible ID token.
   */
  signInWithGoogleFirebase(): Observable<string> {
    return from(signInWithPopup(this.auth, this.provider)).pipe(
      // Step 1: Get the Firebase ID token from the successful sign-in.
      switchMap((userCredential: UserCredential) => {
        if (!userCredential.user) {
          return throwError(
            () => new Error('Firebase user not found after sign-in.'),
          );
        }
        return from(userCredential.user.getIdTokenResult());
      }),
      // Step 2: Save the session and sync with the backend.
      switchMap((idTokenResult: IdTokenResult) => {
        const token = idTokenResult.token;
        const expirationTime = Date.parse(idTokenResult.expirationTime);

        // Save session details to memory and local storage.
        this.firebaseIdToken = token;
        this.firebaseTokenExpiry = expirationTime;
        const session: FirebaseSession = {token, expiry: expirationTime};
        localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));

        // Call the backend to get or create the user profile.
        return this.syncUserWithBackend$(token).pipe(
          map(() => token), // Pass the token along for the final result.
        );
      }),
      catchError((error: any) => {
        console.error('An error occurred during the sign-in process:', error);
        return throwError(() => new Error('Sign-in failed. Please try again.'));
      }),
    );
  }

  /**
   * Asynchronously gets a valid Firebase token.
   * 1. Checks for a valid, non-expired token in memory/cache.
   * 2. If expired or missing, attempts a silent refresh.
   * 3. If silent refresh fails, it emits an error, signaling a required re-login.
   */
  getValidFirebaseToken$(): Observable<string> {
    // First, check our own session info which is loaded from localStorage.
    // This is synchronous and tells us if we have a valid, non-expired token.
    if (!this.isLoggedIn()) {
      return throwError(
        () => new Error('User session is not valid or has expired.'),
      );
    }

    // If we have a valid session, check if the Firebase Auth instance is ready.
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      // Ideal case: Auth is ready, so we can force a token refresh to ensure it's fresh.
      return from(currentUser.getIdToken(true)).pipe(
        tap((token: string) => {
          // Update the in-memory cache and localStorage with the refreshed token info.
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiry = payload.exp * 1000;

          this.firebaseIdToken = token;
          this.firebaseTokenExpiry = expiry;

          const session: FirebaseSession = {token, expiry};
          localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));
        }),
      );
    }

    // Fallback case: The Firebase Auth instance is not yet initialized, but we
    // have a valid token from localStorage. We can use this for the current
    // request. The next request will likely hit the ideal case above.
    return of(this.firebaseIdToken!);
  }

  private syncUserWithBackend$(token: string): Observable<UserData> {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.httpClient
      .get<UserData>(`${environment.backendURL}/users/me`, {headers})
      .pipe(
        tap((userDetails: UserData) => {
          // The backend is the source of truth. Save the returned profile to local storage.
          localStorage.setItem(USER_DETAILS, JSON.stringify(userDetails));
          console.log('User profile successfully synced with backend.');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Failed to sync user with backend', error);
          // This is a critical error, so we should propagate it.
          return throwError(
            () =>
              new Error('Could not synchronize user profile with the server.'),
          );
        }),
      );
  }

  async logout(route: string = LOGIN_ROUTE) {
    return this.auth
      .signOut()
      .then(() => {
        this.currentOAuthAccessToken = null; // Clear stored token on logout
        // Clear Firebase session data
        this.firebaseIdToken = null;
        this.firebaseTokenExpiry = null;
        localStorage.removeItem(FIREBASE_SESSION_KEY);
        localStorage.removeItem(USER_DETAILS);
        localStorage.removeItem('showTooltip');
        void this.router.navigateByUrl(route);
      })
      .catch(e => {
        console.error('Sign Out Error', e);
        localStorage.removeItem(FIREBASE_SESSION_KEY);
        localStorage.removeItem(USER_DETAILS);
        localStorage.removeItem('showTooltip');
        void this.router.navigate([LOGIN_ROUTE]);
      });
  }

  isLoggedIn() {
    if (!isPlatformBrowser(this.platformId)) return false;

    // Check if the in-memory token is valid
    const now = Date.now();
    const isTokenValid = !!(
      this.firebaseIdToken &&
      this.firebaseTokenExpiry &&
      this.firebaseTokenExpiry > now
    );

    if (!isTokenValid && this.router.url !== LOGIN_ROUTE) {
      void this.router.navigate([LOGIN_ROUTE]);
    }

    return isTokenValid;
  }

  private loadSessionFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const sessionStr = localStorage.getItem(FIREBASE_SESSION_KEY);
    if (sessionStr) {
      const session: FirebaseSession = JSON.parse(sessionStr);
      // Check if the stored session is still valid
      if (session.expiry > Date.now()) {
        this.firebaseIdToken = session.token;
        this.firebaseTokenExpiry = session.expiry;
      } else {
        // If expired, remove it from storage.
        localStorage.removeItem(FIREBASE_SESSION_KEY);
      }
    }
  }

  isUserLoggedIn() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const isUserLoggedIn = localStorage.getItem(FIREBASE_SESSION_KEY) !== null;
    return isUserLoggedIn;
  }

  isUserAdmin() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const user_role = this.userService.getUserDetails()?.roles;
    return user_role?.includes(environment.ADMIN) || false;

    // TODO: Now the role will come in the Firebase JWT
    // const userDetails = this.userService.getUserDetails(); // Get user details from localStorage
    // const userEmail = userDetails?.email?.toLowerCase();
    // return this.allowedAdminEmails.includes(userEmail.toLowerCase());
  }

  getToken() {
    return this.firebaseIdToken;
  }

  setOAuthAccessToken(token: string | null): void {
    this.currentOAuthAccessToken = token;
  }

  getOAuthAccessToken(): string | null {
    // Renamed from getAccessToken for clarity
    return this.currentOAuthAccessToken;
  }

  /**
   * Initiates Google Sign-In Popup, requests cloud-platform scope,
   * and stores the access token upon success.
   */
  signInWithGoogleAdminPermissions(): Observable<string> {
    const provider = new GoogleAuthProvider();

    // --- CRITICAL: Request necessary scopes ---
    // This scope allows calling most Google Cloud APIs
    provider.addScope('https://www.googleapis.com/auth/cloud-platform');
    // You might add 'profile' and 'email' if needed, though Firebase gets basic profile info
    provider.addScope('profile');
    provider.addScope('email');

    // Use custom parameters for forcing account selection
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    // `from` converts the Promise returned by signInWithPopup into an Observable
    return from(signInWithPopup(this.auth, provider)).pipe(
      tap((result: UserCredential) => {
        // Optional: Log user info
        const user = result.user;
      }),
      map((result: UserCredential) => {
        // --- Extract the OAuth Access Token ---
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          this.currentOAuthAccessToken = credential.accessToken;
          return this.currentOAuthAccessToken;
        } else {
          console.error(
            'Could not retrieve OAuth Access Token from credential.',
          );
          // Throw an error that can be caught downstream
          throw new Error('OAuth Access Token not found.');
        }
      }),
      catchError(error => {
        // Handle different errors
        console.error('Google Sign-In Error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
          console.warn('Sign-in popup closed by user.');
        } else if (error.code === 'auth/cancelled-popup-request') {
          console.warn('Multiple popups opened, cancelling this one.');
        } else if (error.code === 'auth/unauthorized-domain') {
          console.error('ERROR: Domain not authorized in Firebase console.');
        } else if (error.message === 'OAuth Access Token not found.') {
          // Keep the specific error message
          return throwError(() => new Error(error.message));
        }
        // For other errors, return a generic error or handle specifically
        return throwError(
          () => new Error('Google Sign-In failed. Please try again.'),
        );
      }),
    );
  }

  /**
   * Retrieves the currently stored access token.
   */
  getAccessToken(): string | null {
    // Note: Tokens expire (usually after 1 hour).
    // A robust implementation would check expiry or refresh the token.
    // Firebase Auth automatically handles ID token refresh, but OAuth access token
    // refresh requires re-authentication or more complex flows not covered here.
    // For a simple deploy button click, getting a fresh token on sign-in might suffice.
    return this.currentOAuthAccessToken;
  }
}
