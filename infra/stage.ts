export const isPermanentStage = $app.stage === 'prod' || $app.stage === 'dev'
export const isLocal = ['dev', 'local'].includes($app.stage)
