# Creative Studio Backend

[![linting: pylint](https://img.shields.io/badge/linting-pylint-yellowgreen)](https://github.com/pylint-dev/pylint)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)

Creative Studio is a set of templates that can be deployed out of the box into Cloud Run and work independently. Each one can be run independently connected to the user default google cloud auth credentials, and based on the complexity of each template, may require to deploy more or less resources into our Google Cloud Project.
The architecture always follows the following structure: a folder for the frontend which consists in an Angular app, and a backend folder which consists of a FastAPI Python app.

## Deploying to CloudRun
## Create Image Repository if not created yet
```bash
  # 1. Define image repository and name
  export PROJECT_ID=creative-studio-arena && \
  export REGION="us-central1" && \
  export REPO_NAME="creative-studio-repo" && \
  export IMAGE_NAME="creative-studio-backend"

  # 2. Create an Artifact Registry repository
  gcloud artifacts repositories create $REPO_NAME \
      --repository-format=docker \
      --location=$REGION \
      --description="Docker repository for Creative Studio application"
```

## Build/Rebuild and Push the Container
```bash
  export PROJECT_ID=creative-studio-arena && \
  export REGION="us-central1" && \
  export REPO_NAME="creative-studio-repo" && \
  export IMAGE_NAME="creative-studio-backend"

  # 3. Build the container image and push it to Artifact Registry
  gcloud builds submit --tag "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest" .
```

## Deploy the Cloud Function

```bash
  # 1. Define your function name and frontend URL
  export PROJECT_ID=creative-studio-arena && \
  export REGION="us-central1" && \
  export REPO_NAME="creative-studio-repo" && \
  export IMAGE_CREATION_BUCKET=$PROJECT_ID-genmedia && \
  export FUNCTION_NAME=creative-studio-api && \
  export FRONTEND_PROD_URL="https://your-frontend-app-url.com" && \
  export SIGNING_SA_EMAIL=sa-genmedia-creative-studio@$PROJECT_ID.iam.gserviceaccount.com && \

  # 2. Deploy the function
  gcloud run deploy $FUNCTION_NAME \
    --region=$REGION \
    --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest" \
    --platform=managed \
    --allow-unauthenticated \
    --no-invoker-iam-check \
    --memory="2Gi" \
    --set-env-vars="ENVIRONMENT=development,FRONTEND_URL=${FRONTEND_PROD_URL},SIGNING_SA_EMAIL=${SIGNING_SA_EMAIL},IMAGE_CREATION_BUCKET=${IMAGE_CREATION_BUCKET}" \
    --timeout=300s # Set a reasonable timeout (e.g., 5 minutes)
```
  
## Accessing images
In order fot the pre-signed URLs to work, make sure the SIGNING_SA_EMAIL matches the default CloudRun Service Account assigned, and provide it with access to the bucket.
Make sure your default Service Account MUST have the "Service Account Token Creator" Role and also the "Storage Object Viewer" IAM Role.
```
export SA_NAME=your-default-cloudrun-sa && \

gcloud storage buckets add-iam-policy-binding gs://$IMAGE_CREATION_BUCKET \
  --member="serviceAccount:$SA_NAME" \
  --role="roles/storage.objectViewer"
```

## Setting up
### 1. Create virtualenv inside the backend folder and install dependencies
Create a virtual environment on the root of the application, activate it and install the requirements
```
# check if you are already in the env
pip -V

# if not then
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
```

> **IMPORTANT!** VS Code may not recognize your env, in that case type "ctrl + shift + P", then select "Python: Select Interpreter" and then select "Enter interpreter path..." and then select your .venv python interpreter, in this case .backend/.venv/bin/python


### 2. Setup gcloud credentials
```
gcloud auth list
gcloud config list

gcloud auth login
gcloud config set project <your project id>
gcloud auth application-default set-quota-project <your project id>

gcloud auth list
gcloud config list
```

### 3. Add environment variables

#### If you have Mac or Windows (or if you are using zsh console on Linux)
```
. ./local.env
```

#### If you have Linux
Open the file .venv/bin/activate and paste the env variables from `.local.env` after the PATH export, like this:
```
...

_OLD_VIRTUAL_PATH="$PATH"
PATH="$VIRTUAL_ENV/bin:$PATH"
export PATH

# Creative Studio env variables
export ENVIRONMENT=development
export FRONTEND_URL=http://localhost:4200

...
```

Check that the env variables has been taken into account, running:
```
env
```
You should see the new env variables set there


### 4. Run the application
Finally run using uvicorn
```
uvicorn main:app --reload --port 8080
```

## Code Styling & Commit Guidelines

To maintain code quality and consistency:

* **TypeScript (Frontend):** We follow [Angular Coding Style Guide](https://angular.dev/style-guide) by leveraging the use of [Google's TypeScript Style Guide](https://github.com/google/gts) using `gts`. This includes a formatter, linter, and automatic code fixer.
* **Python (Backend):** We adhere to the [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html), using tools like `pylint` and `black` for linting and formatting.
* **Commit Messages:** We suggest following [Angular's Commit Message Guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md) to create clear and descriptive commit messages.

#### Frontend (TypeScript with `gts`)

1.  **Initialize `gts` (if not already done in the project):**
    Navigate to the `frontend/` directory and run:
    ```bash
    npx gts init
    ```
    This will set up `gts` and create necessary configuration files (like `tsconfig.json`). Ensure your `tsconfig.json` (or a related gts config file like `.gtsrc`) includes an extension for `gts` defaults, typically:
    ```json
    {
      "extends": "./node_modules/gts/tsconfig-google.json",
      // ... other configurations
    }
    ```
2.  **Check for linting issues:**
    ```bash
    npm run lint
    ```
    (This assumes a `lint` script is defined in `package.json`, e.g., `"lint": "gts lint"`)
3.  **Fix linting issues automatically (where possible):**
    ```bash
    npm run fix
    ```
    (This assumes a `fix` script is defined in `package.json`, e.g., `"fix": "gts fix"`)

#### Backend (Python with `pylint` and `black`)

1.  **Ensure Dependencies are Installed:**
    Add `pylint` and `black` to your `backend/requirements.txt` file:
    ```
    pylint
    black
    ```
    Then install them within your virtual environment:
    ```bash
    pip install pylint black
    # or pip install -r requirements.txt
    ```
2.  **Configure `pylint`:**
    It's recommended to have a `.pylintrc` file in your `backend/` directory to configure `pylint` rules. You might need to copy a standard one or generate one (`pylint --generate-rcfile > .pylintrc`).
3.  **Check for linting issues with `pylint`:**
    Navigate to the `backend/` directory and run:
    ```bash
    pylint .
    ```
    (Or specify modules/packages: `pylint your_module_name`)
4.  **Format code with `black`:**
    To automatically format all Python files in the current directory and subdirectories:
    ```bash
    python -m black . --line-length=80
    ```
