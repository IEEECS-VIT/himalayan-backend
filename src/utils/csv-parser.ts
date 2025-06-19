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

    // Add better null/undefined checks
    let collection_name: string | undefined
    let category_name: string | undefined

    if (firstRow.collection && typeof firstRow.collection === "string") {
      const trimmed = firstRow.collection.trim()
      collection_name = trimmed !== "" ? trimmed : undefined
    } else {
      collection_name = undefined
    }

    if (firstRow.category && typeof firstRow.category === "string") {
      const trimmed = firstRow.category.trim()
      category_name = trimmed !== "" ? trimmed : undefined
    } else {
      category_name = undefined
    }

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
 * Validate CSV structure and data
 */
export function validateCSVStructure(products: ProductData[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (products.length === 0) {
    errors.push("No valid products found in CSV")
    return { isValid: false, errors }
  }

  // Validate each product
  products.forEach((product, productIndex) => {
    // Validate product title
    if (!product.title || product.title.trim() === "") {
      errors.push(`Product ${productIndex + 1}: Product title is required`)
    }

    // Validate variants
    if (!product.variants || product.variants.length === 0) {
      errors.push(`Product ${productIndex + 1} (${product.title}): At least one variant is required`)
    } else {
      // Track SKUs for duplicate checking
      const skuSet = new Set<string>()

      product.variants.forEach((variant, variantIndex) => {
        const variantLabel = `Product ${productIndex + 1} (${product.title}), Variant ${variantIndex + 1}`

        // Validate variant title
        if (!variant.title || variant.title.trim() === "") {
          errors.push(`${variantLabel}: Variant title is required`)
        }

        // Validate SKU
        if (!variant.sku || variant.sku.trim() === "") {
          errors.push(`${variantLabel}: SKU is required`)
        } else {
          // Check for duplicate SKUs within the same product
          if (skuSet.has(variant.sku)) {
            errors.push(`${variantLabel}: Duplicate SKU "${variant.sku}" found within the same product`)
          }
          skuSet.add(variant.sku)

          // Validate SKU format (alphanumeric, hyphens, underscores only)
          if (!/^[a-zA-Z0-9_-]+$/.test(variant.sku)) {
            errors.push(
              `${variantLabel}: SKU "${variant.sku}" contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed`,
            )
          }
        }

        // Validate prices
        if (!variant.prices || variant.prices.length === 0) {
          errors.push(`${variantLabel}: At least one price is required`)
        } else {
          variant.prices.forEach((price, priceIndex) => {
            if (!price.amount || price.amount <= 0) {
              errors.push(`${variantLabel}, Price ${priceIndex + 1}: Price amount must be greater than 0`)
            }

            if (!price.currency_code || price.currency_code.trim() === "") {
              errors.push(`${variantLabel}, Price ${priceIndex + 1}: Currency code is required`)
            } else if (!/^[A-Z]{3}$/.test(price.currency_code.toUpperCase())) {
              errors.push(
                `${variantLabel}, Price ${priceIndex + 1}: Currency code "${price.currency_code}" must be a valid 3-letter ISO code (e.g., USD, EUR, INR)`,
              )
            }
          })
        }

        // Validate stock quantity
        if (variant.stocked_quantity < 0) {
          errors.push(`${variantLabel}: Stock quantity cannot be negative`)
        }
      })
    }

    // Validate collection name format (if provided)
    if (product.collection_name) {
      if (product.collection_name.length > 100) {
        errors.push(`Product ${productIndex + 1} (${product.title}): Collection name is too long (max 100 characters)`)
      }
    }

    // Validate category name format (if provided)
    if (product.category_name) {
      if (product.category_name.length > 100) {
        errors.push(`Product ${productIndex + 1} (${product.title}): Category name is too long (max 100 characters)`)
      }
    }
  })

  // Check for duplicate SKUs across all products
  const allSkus = products.flatMap((product) => product.variants.map((variant) => variant.sku))
  const skuCounts = allSkus.reduce(
    (acc, sku) => {
      acc[sku] = (acc[sku] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  Object.entries(skuCounts).forEach(([sku, count]) => {
    if (count > 1) {
      errors.push(`Duplicate SKU "${sku}" found across multiple products (${count} occurrences)`)
    }
  })

  return { isValid: errors.length === 0, errors }
}