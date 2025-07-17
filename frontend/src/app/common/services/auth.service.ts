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
import {OrgUser, UserData} from '../models/user.model';
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
      switchMap((userCredentials: UserCredential) => {
        // --- Extract the OAuth Access Token ---
        const credential =
          GoogleAuthProvider.credentialFromResult(userCredentials);
        if (!credential?.accessToken) {
          console.error(
            'Could not retrieve OAuth Access Token from credential.',
          );
          // Throw an error that can be caught downstream
          throw new Error('OAuth Access Token not found.');
        }

        const firebaseUser = userCredentials.user;

        return from(firebaseUser.getIdTokenResult()).pipe(
          map((firebaseIdToken: IdTokenResult) => ({
            firebaseUser,
            firebaseIdToken,
            userCredentials,
          })),
        );
      }),
      switchMap(({firebaseUser, firebaseIdToken, userCredentials}) => {
        const userEmail = firebaseUser.email?.toLowerCase();

        this.firebaseTokenExpiry = Date.parse(firebaseIdToken.expirationTime);
        this.firebaseIdToken = firebaseIdToken.token;

        const session: FirebaseSession = {
          token: this.firebaseIdToken,
          expiry: this.firebaseTokenExpiry,
        };
        localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));

        const userDetails: UserData = {
          uid: firebaseUser.uid,
          email: userEmail!,
          photoURL:
            firebaseUser.photoURL ||
            'assets/images/default-profile-picture.svg',
          displayName: firebaseUser.displayName || userEmail!,
          domain: '',
          role: '',
          appRole: '',
          organizationName: '',
          organizationKey: '',
        };
        localStorage.setItem(USER_DETAILS, JSON.stringify(userDetails));

        return this.firebaseIdToken; // Pass the token along on success
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
    const now = Date.now();
    // Check cache first: if token exists and is not expiring in the next 60 seconds.
    if (
      this.firebaseIdToken &&
      this.firebaseTokenExpiry &&
      this.firebaseTokenExpiry > now + 60000
    ) {
      return of(this.firebaseIdToken);
    }

    // If token is missing or expired, request a new one silently.
    return this.refreshFirebaseTokenSilently$();
  }

  private refreshFirebaseTokenSilently$(): Observable<string> {
    return new Observable<string>(observer => {
      if (typeof google === 'undefined') {
        return observer.error(
          new Error('Google Identity Services script not loaded.'),
        );
      }

      // --- Timeout for silent refresh ---
      const refreshTimeout = setTimeout(() => {
        observer.error(new Error('Silent token refresh timed out.'));
      }, 10000); // 10-second timeout for silent refresh

      google.accounts.id.initialize({
        callback: (response: any) => {
          const idToken = response.credential;
          if (idToken) {
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            const expiry = payload.exp * 1000;
            clearTimeout(refreshTimeout); // Success!

            this.firebaseIdToken = idToken;
            this.firebaseTokenExpiry = expiry;

            const session: FirebaseSession = {token: idToken, expiry: expiry};
            localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));

            observer.next(idToken);
            observer.complete();
          } else {
            clearTimeout(refreshTimeout);
            observer.error(
              new Error('Silent refresh failed to return a credential.'),
            );
          }
        },
        auto_select: true, // This enables the silent token refresh behavior
      });

      // Trigger the prompt. The callback is no longer used for flow control.
      google.accounts.id.prompt();
    });
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

  isUserSuperAdmin() {
    if (!isPlatformBrowser(this.platformId)) return false;

    // const user_role = this.userService.getUserDetails().appRole;
    // return environment.SUPER_ADMIN === user_role;

    const userDetails = this.userService.getUserDetails(); // Get user details from localStorage
    const userEmail = userDetails?.email?.toLowerCase();
    return this.allowedAdminEmails.includes(userEmail.toLowerCase());
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

  /**
   * Fetches a boolean from the backend indicating if the email is allowed.
   * @param email - The email to check.
   */
  fetchEmailIsAllowed(email: string): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) return of(false); // Default to false for SSR, client-side will handle actual fetch

    if (!email) return of(false); // If email is not provided, consider it not allowed

    interface WhitelistResponse {
      is_whitelisted: boolean;
    }

    return this.httpClient
      .get<WhitelistResponse>(
        `${environment.CLOUD_FUNCTION_URL_WHITELIST}/login`,
      )
      .pipe(
        map(response => !!response?.is_whitelisted), // Extract the boolean property and ensure it's a boolean
        catchError(err => {
          console.error(`Error checking if email '${email}' is allowed:`, err);
          return of(false); // Default to false on error to be restrictive
        }),
      );
  }
}
