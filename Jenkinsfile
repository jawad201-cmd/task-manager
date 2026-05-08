pipeline {
    agent any

    environment {
        DOCKERHUB_USER     = 'jawad201'
        IMAGE_NAME         = 'task-manager'
        IMAGE_TAG          = "${env.BUILD_NUMBER}"
        APP_PORT           = '8081'
        APP_URL            = "http://localhost:8081"

        TEST_REPO_URL      = 'https://github.com/jawad201-cmd/taskmanager-selenium-tests.git'
        TEST_REPO_BRANCH   = 'main'

        TEST_IMAGE         = 'markhobson/maven-chrome:latest'

        SMTP_FROM          = 'jawadtaj201gmail.com'
    }

    triggers {
        githubPush()
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        stage('Checkout App') {
            steps {
                checkout scm
            }
        }

        stage('Build Image') {
            steps {
                sh 'docker compose -f docker-compose.jenkins.yml build'
            }
        }

        stage('Deploy (Bring Up)') {
            steps {
                sh 'docker compose -f docker-compose.jenkins.yml down -v || true'
                sh 'docker compose -f docker-compose.jenkins.yml up -d'
                sh 'sleep 20'
            }
        }

        stage('Smoke Test') {
            steps {
                sh "curl -fsS ${APP_URL}/health"
            }
        }

        stage('Checkout Selenium Tests') {
            steps {
                dir('selenium-tests') {
                    git branch: "${TEST_REPO_BRANCH}", url: "${TEST_REPO_URL}"
                }
            }
        }

        stage('Run Selenium Tests') {
            steps {
                sh """
                    docker run --rm \\
                        --network host \\
                        -v \"\$(pwd)/selenium-tests\":/work \\
                        -w /work \\
                        -e APP_URL=${APP_URL} \\
                        ${TEST_IMAGE} \\
                        mvn -B -Dapp.url=${APP_URL} test
                """
            }
            post {
                always {
                    junit testResults: 'selenium-tests/target/surefire-reports/*.xml',
                          allowEmptyResults: true
                    archiveArtifacts artifacts: 'selenium-tests/target/surefire-reports/*.xml',
                                     allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            script {
                def commitEmail = sh(
                    script: "git log -1 --pretty=format:'%ae'",
                    returnStdout: true
                ).trim()

                if (!commitEmail) {
                    commitEmail = env.SMTP_FROM
                }

                def status = currentBuild.currentResult
                def colour = (status == 'SUCCESS') ? 'green' : 'red'

                emailext(
                    to: commitEmail,
                    from: env.SMTP_FROM,
                    subject: "[Task Manager CI] Build #${env.BUILD_NUMBER} - ${status}",
                    mimeType: 'text/html',
                    body: """
                        <p>Hi,</p>
                        <p>Your push to <b>${env.JOB_NAME}</b> triggered a Jenkins pipeline run.</p>
                        <ul>
                          <li><b>Build:</b> #${env.BUILD_NUMBER}</li>
                          <li><b>Status:</b> <span style="color:${colour}"><b>${status}</b></span></li>
                          <li><b>Triggered by:</b> ${commitEmail}</li>
                          <li><b>Console:</b> <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></li>
                          <li><b>Test Report:</b> <a href="${env.BUILD_URL}testReport">${env.BUILD_URL}testReport</a></li>
                        </ul>
                        <p>JUnit XML reports from the Selenium suite are attached.</p>
                        <hr/>
                        <p style="color:#888;font-size:12px">Sent automatically by Jenkins running on AWS EC2.</p>
                    """,
                    attachmentsPattern: 'selenium-tests/target/surefire-reports/*.xml',
                    attachLog: false
                )
            }
        }
    }
}
