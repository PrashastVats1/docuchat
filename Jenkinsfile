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
            sh '''
                python3 -m venv $VENV_DIR
                . $VENV_DIR/bin/activate
                 install --upgrade pip
                pip install -r requirements.txt
                pip install -r requirements-dev.txt
            '''
    }
}

        stage('Lint') {
            steps {
                sh '''
                    . $VENV_DIR/bin/activate
                    flake8 app/ --max-line-length=120 --statistics
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    . $VENV_DIR/bin/activate
                    pytest tests/ -v
                '''
            }
        }
    }

    post {
        success { echo 'DocuChat build passed!' }
        failure { echo 'Build failed — check logs above.' }
        cleanup { cleanWs() }
    }
}