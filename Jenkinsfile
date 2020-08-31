
pipeline {
	agent any

	tools {nodejs "node8"}

	stages {
		stage('Install') {
				steps {
						sh 'npm install'
				}
		}

		stage('Test') {
			steps {
				sh 'npm run lint'
				sh 'npm test'
			}
		}

		stage('Done') {
			steps {
				slackSend color: "good", message: "Job: ${env.JOB_NAME} with buildnumber ${env.BUILD_NUMBER} was successful, ready to merge"
			}
		}
	}
}
