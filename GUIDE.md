# DevOps Assignment 2 — Complete Step-by-Step Guide
## COMSATS University, Islamabad — Spring 2026

---

## Project Structure

```
task-manager/
├── app.js                        ← Express server (REST API + static serving)
├── package.json                  ← Node.js dependencies
├── Dockerfile                    ← Part I: Build image from source
├── docker-compose.yml            ← Part I: Production deployment
├── docker-compose.jenkins.yml    ← Part II: Jenkins CI/CD build
├── Jenkinsfile                   ← Part II: Pipeline script
├── .gitignore
└── public/
    └── index.html                ← Frontend UI
```

---

## PART I — Containerized Deployment on AWS EC2

---

### Step 1: Launch an EC2 Instance on AWS

1. Go to https://aws.amazon.com → Sign in → Open the EC2 Console
2. Click **Launch Instance**
3. Configure as follows:
   - **Name**: `task-manager-server`
   - **AMI**: Ubuntu Server 22.04 LTS (Free Tier eligible)
   - **Instance type**: t2.micro (Free Tier)
   - **Key pair**: Create a new key pair → name it `devops-key` → Download the `.pem` file
   - **Security Group**: Create a new security group with these inbound rules:
     | Type  | Port | Source    |
     |-------|------|-----------|
     | SSH   | 22   | My IP     |
     | HTTP  | 80   | Anywhere  |
     | Custom TCP | 8080 | Anywhere | ← For Jenkins (Part II)
     | Custom TCP | 8081 | Anywhere | ← For Jenkins deployment (Part II)
4. Click **Launch Instance**
5. Wait ~2 minutes for the instance to reach "Running" state
6. Note the **Public IPv4 address** (e.g. `3.92.145.67`)

---

### Step 2: Connect to EC2 via SSH

```bash
# On your local machine (Linux/Mac terminal or Git Bash on Windows)
chmod 400 devops-key.pem

ssh -i devops-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

### Step 3: Install Docker and Docker Compose on EC2

```bash
# Update package index
sudo apt-get update -y

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow ubuntu user to run Docker without sudo
sudo usermod -aG docker ubuntu
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

### Step 4: Build and Push Docker Image to Docker Hub

**On your LOCAL machine** (not EC2):

```bash
# Make sure Docker Desktop is running on your PC

# Navigate to the project folder
cd task-manager/

# Login to Docker Hub
docker login
# Enter your Docker Hub username and password when prompted

# Build the image (replace YOUR_USERNAME with your actual Docker Hub username)
docker build -t YOUR_USERNAME/task-manager:latest .

# Verify the image was built
docker images | grep task-manager

# Push the image to Docker Hub
docker push YOUR_USERNAME/task-manager:latest
```

> After this step, your image is publicly available at:
> `https://hub.docker.com/r/YOUR_USERNAME/task-manager`

---

### Step 5: Update docker-compose.yml with Your Docker Hub Username

In `docker-compose.yml`, find this line:

```yaml
image: YOUR_DOCKERHUB_USERNAME/task-manager:latest
```

Replace `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username. Commit and push to GitHub.

---

### Step 6: Deploy on EC2 (Part I)

```bash
# On the EC2 instance — transfer project files
# Option A: Clone from GitHub (easiest)
git clone https://github.com/YOUR_USERNAME/task-manager.git
cd task-manager

# Option B: Use SCP from local machine
# scp -i devops-key.pem docker-compose.yml ubuntu@<EC2_IP>:~/

# Pull the Docker image
docker pull YOUR_USERNAME/task-manager:latest

# Start all containers in detached mode
docker compose up -d

# Check that both containers are running
docker ps

# Check app logs
docker logs taskmanager_web

# Test the application
curl http://localhost/health
# Expected: {"status":"ok","uptime":...}
```

Open a browser and visit: `http://<YOUR_EC2_PUBLIC_IP>`

You should see the Task Manager web application running.

---

### Step 7: Verify Persistent Volume

```bash
# Add a task via the UI, then restart the database container
docker compose restart db

# Wait 15 seconds, then refresh the browser
# Your tasks should still be there — this confirms volume persistence

# Inspect the volume
docker volume ls
docker volume inspect devops-assignment_mysql_data
```

---

## PART II — Jenkins CI/CD Pipeline

---

### Step 8: Install Java and Jenkins on EC2

```bash
# Jenkins requires Java 17+
sudo apt-get install -y fontconfig openjdk-17-jre

java -version   # Should show openjdk 17

# Add Jenkins repository
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key

echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
sudo apt-get update -y
sudo apt-get install -y jenkins

# Start and enable Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Verify Jenkins is running
sudo systemctl status jenkins

# Get the initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

---

### Step 9: Set Up Jenkins (Web UI)

1. Open browser: `http://<EC2_PUBLIC_IP>:8080`
2. Paste the initial admin password from Step 8
3. Click **Install suggested plugins** and wait for installation
4. Create Admin User:
   - Username: `admin`
   - Password: choose a password
   - Full name: your name
   - Email: your email
5. Click **Save and Finish** → **Start using Jenkins**

---

### Step 10: Install Required Jenkins Plugins

1. Go to **Manage Jenkins** → **Plugins** → **Available plugins**
2. Search for and install (check all, then click Install):
   - **Git** (usually pre-installed)
   - **Pipeline** (usually pre-installed)
   - **Docker Pipeline**
   - **GitHub Integration Plugin**
3. Restart Jenkins after installation

---

### Step 11: Allow Jenkins User to Run Docker

```bash
# On EC2 terminal
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins

# Verify
sudo -u jenkins docker ps
```

---

### Step 12: Push Code to GitHub

**On your LOCAL machine:**

```bash
cd task-manager/

# Initialize Git repo (if not already)
git init
git add .
git commit -m "Initial commit - Task Manager app with Docker and Jenkins"

# Create a new repo on GitHub named 'task-manager', then:
git remote add origin https://github.com/YOUR_USERNAME/task-manager.git
git branch -M main
git push -u origin main
```

> Add `qasimalik@gmail.com` as a collaborator:
> GitHub repo → **Settings** → **Collaborators** → **Add people** → enter that email

---

### Step 13: Configure GitHub Webhook

1. In your GitHub repo: **Settings** → **Webhooks** → **Add webhook**
2. Fill in:
   - **Payload URL**: `http://<EC2_PUBLIC_IP>:8080/github-webhook/`
   - **Content type**: `application/json`
   - **Which events**: Just the push event
3. Click **Add webhook**
4. GitHub will send a test ping — check for a green tick ✓

---

### Step 14: Create Jenkins Pipeline Job

1. Jenkins Dashboard → **New Item**
2. Enter name: `task-manager`
3. Select **Pipeline** → **OK**
4. In the job configuration:
   - **General** → check **GitHub project** → paste your repo URL
   - **Build Triggers** → check **GitHub hook trigger for GITScm polling**
   - **Pipeline** section:
     - Definition: **Pipeline script from SCM**
     - SCM: **Git**
     - Repository URL: `https://github.com/YOUR_USERNAME/task-manager.git`
     - Branch: `*/main`
     - Script Path: `Jenkinsfile`
5. Click **Save**

---

### Step 15: Update Jenkinsfile with Your Docker Hub Username

In `Jenkinsfile`, find:
```groovy
DOCKER_HUB_USER = 'YOUR_DOCKERHUB_USERNAME'
```
Replace with your actual username, commit, and push.

---

### Step 16: Trigger and Test the Pipeline

```bash
# On your LOCAL machine — make a small change to trigger webhook
echo "# Trigger build" >> README.md
git add .
git commit -m "Trigger Jenkins pipeline"
git push origin main
```

1. Go to Jenkins → `task-manager` job
2. You should see a new build appear in **Build History** within 30 seconds
3. Click on the build number → **Console Output** to watch it run
4. All 4 stages should show green: Checkout → Build → Deploy → Smoke Test
5. Visit `http://<EC2_PUBLIC_IP>:8081` to see the Jenkins-deployed version

---

## Submission Checklist

- [ ] Part I app is live at `http://<EC2_IP>` (port 80)
- [ ] Part II containers are DOWN initially (instructor will push to trigger)
- [ ] GitHub repo has all files including `Jenkinsfile` and `docker-compose.jenkins.yml`
- [ ] `qasimalik@gmail.com` added as collaborator to GitHub repo
- [ ] Webhook configured and shows green tick on GitHub
- [ ] Google form filled: https://forms.gle/fhQtr2kjM84QJ9Xd6
- [ ] Report submitted with screenshots of every step

---

## Common Troubleshooting

| Problem | Fix |
|---------|-----|
| EC2 port 80 not accessible | Check Security Group inbound rules |
| `docker: permission denied` | Run `sudo usermod -aG docker $USER && newgrp docker` |
| MySQL container keeps restarting | Run `docker logs taskmanager_db` and check credentials |
| Jenkins webhook not triggering | Ensure port 8080 is open in Security Group |
| Jenkins can't run Docker | Run `sudo usermod -aG docker jenkins && sudo systemctl restart jenkins` |
