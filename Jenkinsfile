
pipeline {
	agent any

	tools {nodejs "node8"}

	environment {
		SQL_HOST='127.0.0.1'
		SQL_HOST_READER='127.0.0.1'
		SQL_USER='root'
		SQL_PASSWORD='123'
		SQL_TABLE='taxigo-dev'

		DATA_ENCRYPTION_KEY='123'
		DATA_ENCRYPTION_IV='123'
	}


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
