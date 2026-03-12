pipeline {
    agent any

    environment {
        VENV_DIR = '.venv'
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
                    .venv\\Scripts\\activate.bat && pip install --upgrade pip
                    .venv\\Scripts\\activate.bat && pip install -r requirements.txt
                    .venv\\Scripts\\activate.bat && pip install -r requirements-dev.txt
                '''
            }
        }

        stage('Lint') {
            steps {
                bat '.venv\\Scripts\\activate.bat && flake8 app/ --max-line-length=120 --statistics'
            }
        }

        stage('Test') {
            steps {
                bat '.venv\\Scripts\\activate.bat && pytest tests/ -v'
            }
        }
    }

    post {
        success { echo 'DocuChat build passed!' }
        failure { echo 'Build failed — check logs above.' }
        cleanup { cleanWs() }
    }
}