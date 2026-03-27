import { Elysia, t } from 'elysia'
import sharp from 'sharp'
const AdmZip = require('adm-zip') as typeof import('adm-zip')

export const imageRoute = new Elysia({ prefix: '/image' })
  // [DEPRECATED] Optimize logic moved to /image-tool SSR route
