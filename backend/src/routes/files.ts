import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { getImagesDir } from '../paths'

export const filesRouter = Router()

const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/** 读取已上传的留底图：/api/files/kuaidi/<filename> */
filesRouter.get('/files/kuaidi/:name', (req, res) => {
  const name = String(req.params.name ?? '')
  if (!SAFE.test(name)) {
    res.status(400).end()
    return
  }
  const fp = path.join(getImagesDir(), 'kuaidi', name)
  if (!fp.startsWith(path.join(getImagesDir(), 'kuaidi'))) {
    res.status(400).end()
    return
  }
  try {
    if (!fs.existsSync(fp)) {
      res.status(404).end()
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(fp)
  } catch {
    res.status(500).end()
  }
})
