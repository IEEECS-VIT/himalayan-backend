import { asClass, asValue } from "awilix"
import { DriverRepository } from "../repositories/drivers"
import DriverService from "../services/driver"

export default async ({ container, dataSource }) => {
  // Register the driver repository with proper EntityManager
  container.register({
    driverRepository: asValue(new DriverRepository(dataSource.manager)),
    driverService: asClass(DriverService).singleton(),
  })
}
