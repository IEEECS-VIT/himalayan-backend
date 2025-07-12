// src/loaders/index.ts
import { asValue } from "awilix"
import { DriverRepository } from "../repositories/drivers"

export default async ({ container }) => {
  // Register the driver repository
  container.register({
    driverRepository: asValue(DriverRepository)
  })
}