pipeline {
    agent any

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
                bat '.venv\\Scripts\\flake8.exe app/ --max-line-length=120 --statistics'
            }
        }

        stage('Test') {
            steps {
                bat '.venv\\Scripts\\pytest.exe tests/ -v'
            }
        }
    }

    post {
        success { echo 'DocuChat build passed!' }
        failure { echo 'Build failed — check logs above.' }
        cleanup { cleanWs() }
    }
}
