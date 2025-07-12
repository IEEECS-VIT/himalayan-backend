// src/services/driver.ts
import { AwilixContainer } from "awilix"
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

class DriverService {
  protected driverRepository_: DriverRepository

  constructor({ driverRepository }: { driverRepository: DriverRepository }) {
    this.driverRepository_ = driverRepository
  }

  async createDriver(data: CreateDriverData): Promise<Driver> {
    const existingDriver = await this.driverRepository_.findByPhoneNumber(data.primary_mobile_number)

    if (existingDriver) {
      throw new Error("Driver with this phone number already exists")
    }

    const driver = this.driverRepository_.create(data)
    return await this.driverRepository_.save(driver)
  }

  async updateDriverProfile(driverId: string, data: UpdateDriverProfileData): Promise<Driver> {
    const driver = await this.driverRepository_.findOne({ where: { id: driverId } })

    if (!driver) {
      throw new Error("Driver not found")
    }

    Object.assign(driver, data)
    driver.is_profile_complete = true
    driver.status = "active"

    return await this.driverRepository_.save(driver)
  }

  async verifyDriverPhone(driverId: string): Promise<Driver> {
    const driver = await this.driverRepository_.findOne({ where: { id: driverId } })

    if (!driver) {
      throw new Error("Driver not found")
    }

    driver.is_phone_verified = true
    return await this.driverRepository_.save(driver)
  }

  async getDriverByPhoneNumber(phoneNumber: string): Promise<Driver | null> {
    return await this.driverRepository_.findByPhoneNumber(phoneNumber)
  }

  async getDriverById(driverId: string): Promise<Driver | null> {
    return await this.driverRepository_.findOne({ where: { id: driverId } })
  }

  async getAllDrivers(): Promise<Driver[]> {
    return await this.driverRepository_.find()
  }

  async getActiveDrivers(): Promise<Driver[]> {
    return await this.driverRepository_.findActiveDrivers()
  }
}

export default DriverService
