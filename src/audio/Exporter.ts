/**
 * Records audio from the AudioContext destination stream.
 * Uses the MediaRecorder API to capture and download as WebM.
 */
export class Exporter {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []

  startRecording(stream: MediaStream): void {
    this.chunks = []
    this.mediaRecorder = new MediaRecorder(stream)
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.mediaRecorder.start()
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'))
        return
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' })
        resolve(blob)
      }
      this.mediaRecorder.stop()
    })
  }

  download(blob: Blob, filename = 'websynth-export.webm'): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}
