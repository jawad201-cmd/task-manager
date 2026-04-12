// ─────────────────────────────────────────────────────────────
// Jenkinsfile  —  Declarative Pipeline for Task Manager App
// Plugins required: Git, Pipeline, Docker Pipeline
// ─────────────────────────────────────────────────────────────

pipeline {

    agent any

    environment {
        // Change these to match your Docker Hub username and repo name
        DOCKER_HUB_USER = 'jawad201'
        IMAGE_NAME      = 'task-manager'
        IMAGE_TAG       = "build-${env.BUILD_NUMBER}"
        COMPOSE_FILE    = 'docker-compose.jenkins.yml'
    }

    triggers {
        // Enables GitHub webhook to trigger this pipeline on every push
        githubPush()
    }

    stages {

        // ── Stage 1: Pull latest code from GitHub ─────────────────
        stage('Checkout') {
            steps {
                echo "Checking out source code from GitHub..."
                checkout scm
                // 'checkout scm' uses the Git repo configured in this Jenkins job
                echo "Code checked out to: ${env.WORKSPACE}"
            }
        }

        // ── Stage 2: Build Docker image from source ────────────────
        stage('Build Docker Image') {
            steps {
                echo "Building Docker image: ${DOCKER_HUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
                script {
                    // Uses Docker Pipeline plugin's docker.build()
                    def appImage = docker.build("${DOCKER_HUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}")
                    // Also tag it as 'latest'
                    appImage.tag('latest')
                }
            }
        }

        // ── Stage 3: Launch app using docker-compose ───────────────
        stage('Deploy with Docker Compose') {
            steps {
                echo "Tearing down any previous build containers..."
                sh "docker compose -f ${COMPOSE_FILE} down --remove-orphans || true"

                echo "Launching containerized environment..."
                // WORKSPACE is passed to docker-compose.jenkins.yml as an env var
                sh "WORKSPACE=${env.WORKSPACE} docker compose -f ${COMPOSE_FILE} up -d --build"

                echo "Waiting for containers to stabilize..."
                sh "sleep 15"
            }
        }

        // ── Stage 4: Verify the app is responding ──────────────────
        stage('Smoke Test') {
            steps {
                echo "Running health check on the deployed application..."
                script {
                    def response = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/health",
                        returnStdout: true
                    ).trim()
                    if (response == '200') {
                        echo "Health check passed. App is running (HTTP ${response})."
                    } else {
                        error "Health check failed. Got HTTP ${response}. Check container logs."
                    }
                }
            }
        }

    }

    post {
        success {
            echo "Pipeline completed successfully. Build #${env.BUILD_NUMBER} is up on port 8081."
        }
        failure {
            echo "Pipeline failed. Cleaning up containers..."
            sh "docker compose -f ${COMPOSE_FILE} down --remove-orphans || true"
        }
        always {
            echo "Pipeline run finished. View logs at: http://<EC2_PUBLIC_IP>:8080/job/task-manager/"
        }
    }
}
