import { removeBackground } from '@imgly/background-removal-node'

async function run() {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const inputBuffer = Buffer.concat(chunks)
  
  if (inputBuffer.length === 0) {
    process.exit(1)
  }

  try {
    const mime = process.argv[2] || 'image/png'
    const blob = new Blob([inputBuffer], { type: mime })
    const resultBlob = await removeBackground(blob)
    const arrayBuffer = await resultBlob.arrayBuffer()
    const resultBuffer = Buffer.from(arrayBuffer)
    
    // Write directly to stdout
    process.stdout.write(resultBuffer)
    process.exit(0)
  } catch (err: any) {
    console.error(err.message || err)
    process.exit(1)
  }
}

run()
