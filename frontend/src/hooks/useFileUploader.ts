import { useCallback, useState } from 'react'

import type { UploadFileType } from '@/types/component-props'
import { formatFileSize } from '@/utils/other'

export default function useFileUploader(showPreview: boolean = true) {
  const [selectedFiles, setSelectedFiles] = useState<UploadFileType[]>([])

  const handleAcceptedFiles = (files: UploadFileType[], callback?: (files: UploadFileType[]) => void) => {
    files = files.map((file) => ({
      ...file,
      preview: showPreview && file.type?.split('/')[0] === 'image' ? URL.createObjectURL(file) : undefined,
      formattedSize: formatFileSize(file.size),
    }))

    setSelectedFiles((current) => [...current, ...files])

    if (callback) callback(files)
  }

  const removeFile = (file: UploadFileType) => {
    const newFiles = [...selectedFiles]
    newFiles?.splice(newFiles.indexOf(file), 1)
    setSelectedFiles(newFiles)
  }

  const clearFiles = useCallback(() => setSelectedFiles([]), [])

  return {
    selectedFiles,
    handleAcceptedFiles,
    removeFile,
    clearFiles,
  }
}
