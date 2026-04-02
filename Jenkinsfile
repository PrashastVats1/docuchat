pipeline {
    agent any

    environment {
        OPENAI_API_KEY = credentials('openai-api-key')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Building branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Setup Python') {
            steps {
                bat '''
                    python -m venv .venv
                    .venv\\Scripts\\python.exe -m pip install --upgrade pip
                    .venv\\Scripts\\python.exe -m pip install -r requirements.txt
                    .venv\\Scripts\\python.exe -m pip install -r requirements-dev.txt
                '''
            }
        }

        stage('Lint') {
            steps {
                bat '.venv\\Scripts\\flake8.exe app/ --max-line-length=120 --statistics --exclude=app/services/prompts.py'
            }
        }

        stage('Test') {
            steps {
                bat '.venv\\Scripts\\pytest.exe tests/ -v'
            }
        }

        stage('Build Docker Image') {
            when {
                branch 'main'
            }
            steps {
                echo 'Docker build happens on Linux VM — skipping on Windows Jenkins agent.'
                echo 'Run: git pull && sudo docker compose up -d --build on the VM to deploy.'
            }
        }
    }

    post {
        success { echo 'DocuChat build passed!' }
        failure { echo 'Build failed — check logs above.' }
        cleanup { cleanWs() }
    }
}
