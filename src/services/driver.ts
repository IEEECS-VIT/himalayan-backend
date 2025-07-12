// src/services/driver.ts
import { TransactionBaseService } from "@medusajs/medusa"
import { Driver } from "../models/driver"
import { DriverRepository } from "../repositories/drivers"

type CreateDriverData = {
  primary_mobile_number: string
}

type UpdateDriverProfileData = {
  first_name: string
  last_name: string
  father_name: string
  date_of_birth: Date
  whatsapp_number?: string
  secondary_number?: string
  blood_group: string
  address: string
  language: string
  profile_picture?: string
  referral_code?: string
}

class DriverService extends TransactionBaseService {
  protected driverRepository_: typeof DriverRepository

  constructor(container) {
    super(container)
    this.driverRepository_ = container.driverRepository
  }

  async createDriver(data: CreateDriverData): Promise<Driver> {
    return this.atomicPhase_(async (transactionManager) => {
      const driverRepo = transactionManager.withRepository(this.driverRepository_)
      
      // Check if driver already exists
      const existingDriver = await driverRepo.findByPhoneNumber(data.primary_mobile_number)
      if (existingDriver) {
        throw new Error("Driver with this phone number already exists")
      }

      const driver = driverRepo.create(data)
      return await driverRepo.save(driver)
    })
  }

  async updateDriverProfile(driverId: string, data: UpdateDriverProfileData): Promise<Driver> {
    return this.atomicPhase_(async (transactionManager) => {
      const driverRepo = transactionManager.withRepository(this.driverRepository_)
      
      const driver = await driverRepo.findOne({ where: { id: driverId } })
      if (!driver) {
        throw new Error("Driver not found")
      }

      // Update driver with profile data
      Object.assign(driver, data)
      driver.is_profile_complete = true
      driver.status = "active"

      return await driverRepo.save(driver)
    })
  }

  async verifyDriverPhone(driverId: string): Promise<Driver> {
    return this.atomicPhase_(async (transactionManager) => {
      const driverRepo = transactionManager.withRepository(this.driverRepository_)
      
      const driver = await driverRepo.findOne({ where: { id: driverId } })
      if (!driver) {
        throw new Error("Driver not found")
      }

      driver.is_phone_verified = true
      return await driverRepo.save(driver)
    })
  }

  async getDriverByPhoneNumber(phoneNumber: string): Promise<Driver | null> {
    const driverRepo = this.activeManager_.withRepository(this.driverRepository_)
    return await driverRepo.findByPhoneNumber(phoneNumber)
  }

  async getDriverById(driverId: string): Promise<Driver | null> {
    const driverRepo = this.activeManager_.withRepository(this.driverRepository_)
    return await driverRepo.findOne({ where: { id: driverId } })
  }

  async getAllDrivers(): Promise<Driver[]> {
    const driverRepo = this.activeManager_.withRepository(this.driverRepository_)
    return await driverRepo.find()
  }

  async getActiveDrivers(): Promise<Driver[]> {
    const driverRepo = this.activeManager_.withRepository(this.driverRepository_)
    return await driverRepo.findActiveDrivers()
  }
}

export default DriverService