// src/utils/csv-parser.ts
import Papa from "papaparse"

export interface ProductVariant {
  title: string
  sku: string
  prices: { amount: number; currency_code: string }[]
  options: Record<string, string>
  stocked_quantity: number
}

export interface ProductData {
  title: string
  options: { title: string; values: string[] }[]
  variants: ProductVariant[]
  collection_name?: string
  category_name?: string
}

export interface CSVRow {
  product_title: string
  variant_title: string
  sku: string
  price: string
  currency_code: string
  option_name: string
  option_value: string
  stocked_quantity: string
  collection?: string
  category?: string
}

/**
 * Parse CSV buffer to structured product data
 */
export function parseCSVToProducts(csvBuffer: Buffer): Promise<ProductData[]> {
  return new Promise((resolve, reject) => {
    const csvString = csvBuffer.toString("utf-8")

    Papa.parse<CSVRow>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimitersToGuess: [",", "\t", "|", ";"],
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            console.warn("CSV parsing warnings:", results.errors)
          }

          // Clean headers by trimming whitespace
          const cleanedData = results.data.map((row) => {
            const cleanedRow: any = {}
            Object.keys(row).forEach((key) => {
              const cleanKey = key.trim()
              cleanedRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key]
            })
            return cleanedRow as CSVRow
          })

          const products = transformCSVToProducts(cleanedData)
          resolve(products)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(error)
      },
    })
  })
}

/**
 * Transform CSV rows to structured product data
 */
function transformCSVToProducts(csvData: CSVRow[]): ProductData[] {
  // Group by product title
  const productGroups = csvData.reduce(
    (acc, row) => {
      const productTitle = row.product_title
      if (!acc[productTitle]) {
        acc[productTitle] = []
      }
      acc[productTitle].push(row)
      return acc
    },
    {} as Record<string, CSVRow[]>,
  )

  return Object.entries(productGroups).map(([productTitle, rows]) => {
    // Get all unique options for this product
    const optionsMap = new Map<string, Set<string>>()

    rows.forEach((row) => {
      if (row.option_name && row.option_value) {
        if (!optionsMap.has(row.option_name)) {
          optionsMap.set(row.option_name, new Set())
        }
        optionsMap.get(row.option_name)!.add(row.option_value)
      }
    })

    const options = Array.from(optionsMap.entries()).map(([title, values]) => ({
      title,
      values: Array.from(values),
    }))

    // Create variants
    const variants: ProductVariant[] = rows.map((row) => ({
      title: row.variant_title,
      sku: row.sku,
      prices: [
        {
          amount: Number.parseInt(row.price) || 0,
          currency_code: row.currency_code || "inr",
        },
      ],
      options:
        row.option_name && row.option_value
          ? {
              [row.option_name]: row.option_value,
            }
          : {},
      stocked_quantity: Number.parseInt(row.stocked_quantity) || 0,
    }))

    // Get collection and category from the first row (assuming all variants of a product have the same collection/category)
    const firstRow = rows[0]
    const collection_name =
      firstRow.collection && firstRow.collection.trim() !== "" ? firstRow.collection.trim() : undefined
    const category_name = firstRow.category && firstRow.category.trim() !== "" ? firstRow.category.trim() : undefined

    return {
      title: productTitle,
      options,
      variants,
      collection_name,
      category_name,
    }
  })
}

/**
 * Validate CSV structure
 */
export function validateCSVStructure(csvData: CSVRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const requiredFields = ["product_title", "variant_title", "sku", "price", "stocked_quantity"]
  const optionalFields = ["collection", "category"]

  if (csvData.length === 0) {
    errors.push("CSV file is empty")
    return { isValid: false, errors }
  }

  // Check required fields
  const firstRow = csvData[0]
  const availableFields = Object.keys(firstRow)

  requiredFields.forEach((field) => {
    if (!availableFields.includes(field)) {
      errors.push(`Missing required field: ${field}`)
    }
  })

  // Log optional fields that are present
  optionalFields.forEach((field) => {
    if (availableFields.includes(field)) {
      console.log(`✅ Optional field found: ${field}`)
    }
  })

  // Validate data types and required values
  csvData.forEach((row, index) => {
    if (!row.product_title) {
      errors.push(`Row ${index + 2}: product_title is required`)
    }
    if (!row.variant_title) {
      errors.push(`Row ${index + 2}: variant_title is required`)
    }
    if (!row.sku) {
      errors.push(`Row ${index + 2}: sku is required`)
    }
    if (!row.price || isNaN(Number.parseInt(row.price))) {
      errors.push(`Row ${index + 2}: price must be a valid number`)
    }
    if (!row.stocked_quantity || isNaN(Number.parseInt(row.stocked_quantity))) {
      errors.push(`Row ${index + 2}: stocked_quantity must be a valid number`)
    }
  })

  return { isValid: errors.length === 0, errors }
}