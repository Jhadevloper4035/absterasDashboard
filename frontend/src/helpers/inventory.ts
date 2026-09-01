type InventoryItemSpecs = {
  materialType?: string
  defaultDimensions?: { heightFt?: number; widthFt?: number }
  specs?: Record<string, unknown>
}

export function inventorySpecEntries(item: InventoryItemSpecs) {
  const specs = Object.entries(item.specs || {})
  const height = Number(item.defaultDimensions?.heightFt)
  const width = Number(item.defaultDimensions?.widthFt)

  if (item.materialType !== 'SHEET' || height <= 0 || width <= 0) return specs

  return [
    ['size', `${width} × ${height} ft`],
    ...specs.filter(([key]) => !['size', 'height', 'width', 'length'].includes(key)),
  ]
}
