'use strict'

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event) => {
  const recordId = event && event.recordId
  if (!recordId) {
    return {
      success: false,
      error: 'recordId_missing'
    }
  }

  try {
    const res = await db.collection('cooking_records').doc(recordId).remove()
    return {
      success: true,
      removed: res && res.stats ? res.stats.removed : undefined
    }
  } catch (err) {
    return {
      success: false,
      error: err && err.message ? err.message : 'remove_failed',
      code: err && err.errCode ? err.errCode : undefined
    }
  }
}
