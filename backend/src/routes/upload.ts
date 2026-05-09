import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express, { Router } from 'express'
import { getImagesDir } from '../paths'

export const uploadRouter = Router()
uploadRouter.use(express.json({ limit: '35mb' }))

function safeExt(mime: string): string {
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  return '.jpg'
}

/** 快递拍照留底：POST { fileName?, mimeType?, dataBase64 } → { ok, url } */
uploadRouter.post('/upload/waybill-photo', (req, res) => {
  const mimeType = String(req.body?.mimeType ?? 'image/jpeg')
  const b64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : ''
  if (!b64) {
    res.status(400).json({ ok: false, message: 'missing_dataBase64' })
    return
  }
  let buf: Buffer
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    res.status(400).json({ ok: false, message: 'bad_base64' })
    return
  }
  if (buf.length < 32 || buf.length > 30 * 1024 * 1024) {
    res.status(400).json({ ok: false, message: 'bad_size' })
    return
  }
  const id = crypto.randomUUID().replace(/-/g, '')
  const ext = safeExt(mimeType)
  const diskName = `${id}${ext}`
  const dir = path.join(getImagesDir(), 'kuaidi')
  fs.mkdirSync(dir, { recursive: true })
  const fp = path.join(dir, diskName)
  try {
    fs.writeFileSync(fp, buf)
    const url = `/api/files/kuaidi/${diskName}`
    res.json({ ok: true, url })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' })
  }
})
