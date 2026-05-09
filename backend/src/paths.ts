import fs from 'node:fs'
import path from 'node:path'

export function resolveProjectPath(relOrAbs: string | undefined, fallbackRel: string): string {
  const raw = (relOrAbs ?? '').trim()
  if (!raw) return path.resolve(process.cwd(), fallbackRel)
  if (path.isAbsolute(raw)) return raw
  return path.resolve(process.cwd(), raw)
}

export function getImagesDir(): string {
  const dir = resolveProjectPath(process.env.IMAGES_ROOT, '../images')
  fs.mkdirSync(path.join(dir, 'kuaidi'), { recursive: true })
  return dir
}
