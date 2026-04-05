# Phase Flag — Jenkins Shared Library

Jenkins Shared Library for gating deployments and managing Phase Flag feature flags in your pipelines.

## Setup

### 1. Add the Shared Library

In Jenkins, go to **Manage Jenkins > Configure System > Global Pipeline Libraries** and add:

- **Name:** `phaseflag`
- **Default version:** `main`
- **Retrieval method:** Modern SCM
- **Source Code Management:** Git
- **Project Repository:** `https://github.com/phaseflag/integrations`

### 2. Set Credentials

Add your Phase Flag API key as a Jenkins secret:

1. Go to **Manage Jenkins > Credentials**
2. Add a **Secret text** credential
3. Set **ID** to `phaseflag-api-key`
4. Paste your API key as the secret value

### 3. Reference the Library

```groovy
// Jenkinsfile
@Library('phaseflag') _
```

## Usage Examples

### Gate a deployment on a flag

```groovy
@Library('phaseflag') _

pipeline {
    agent any

    environment {
        PHASEFLAG_API_URL = 'https://api.phaseflag.com'
    }

    stages {
        stage('Check Feature Flag') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'phaseflag-api-key', variable: 'PHASEFLAG_API_KEY')]) {
                        def isEnabled = phaseflagCheck(
                            apiUrl:  env.PHASEFLAG_API_URL,
                            apiKey:  env.PHASEFLAG_API_KEY,
                            flagKey: 'enable-new-checkout'
                        )
                        if (!isEnabled) {
                            error("Flag 'enable-new-checkout' is disabled — aborting deployment.")
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                sh './deploy.sh'
            }
        }
    }
}
```

### Toggle a flag after deploy

```groovy
stage('Enable Flag') {
    steps {
        script {
            withCredentials([string(credentialsId: 'phaseflag-api-key', variable: 'PHASEFLAG_API_KEY')]) {
                phaseflagCheck.toggle(
                    apiUrl:  env.PHASEFLAG_API_URL,
                    apiKey:  env.PHASEFLAG_API_KEY,
                    flagKey: 'enable-new-checkout',
                    enabled: true
                )
            }
        }
    }
}
```

### Archive a flag after full rollout

```groovy
stage('Archive Flag') {
    steps {
        script {
            withCredentials([string(credentialsId: 'phaseflag-api-key', variable: 'PHASEFLAG_API_KEY')]) {
                phaseflagCheck.archive(
                    apiUrl:  env.PHASEFLAG_API_URL,
                    apiKey:  env.PHASEFLAG_API_KEY,
                    flagKey: 'enable-new-checkout'
                )
            }
        }
    }
}
```

## API Reference

### `phaseflagCheck(args)` → Boolean

Checks whether a flag is enabled. Returns `true` if enabled, `false` if disabled.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiUrl` | String | `$PHASEFLAG_API_URL` | API base URL |
| `apiKey` | String | `$PHASEFLAG_API_KEY` | API key |
| `flagKey` | String | required | Feature flag key |

### `phaseflagCheck.toggle(args)`

Toggles a flag on or off.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiUrl` | String | `$PHASEFLAG_API_URL` | API base URL |
| `apiKey` | String | `$PHASEFLAG_API_KEY` | API key |
| `flagKey` | String | required | Feature flag key |
| `enabled` | Boolean | `true` | Target state |

### `phaseflagCheck.archive(args)`

Archives a flag (soft-delete, excluded from evaluations).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiUrl` | String | `$PHASEFLAG_API_URL` | API base URL |
| `apiKey` | String | `$PHASEFLAG_API_KEY` | API key |
| `flagKey` | String | required | Feature flag key |

## Plugin Requirements

The shared library will automatically use the [HTTP Request Plugin](https://plugins.jenkins.io/http_request/) if installed.
If not installed, it falls back to `curl` (which must be available on the agent).
