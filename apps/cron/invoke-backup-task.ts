import { Resource } from 'sst'
import { task } from 'sst/aws/task'

/**
 * Lambda function that invokes the Database Backup Task
 *
 * This is used by both:
 * - The scheduled cron job (runs daily at 2 AM UTC)
 * - The test function (can be invoked manually via URL)
 */

export const handler = async () => {
  console.log('🚀 Invoking database backup task...')

  try {
    const result = await task.run(Resource.DatabaseBackupTask)

    console.log('✅ Task invoked successfully')
    console.log('Task ARN:', result.arn)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Database backup task started',
        taskArn: result.arn
      })
    }
  } catch (error) {
    console.error('❌ Failed to invoke backup task:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: String(error),
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
