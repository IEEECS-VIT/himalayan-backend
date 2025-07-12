// src/repositories/driver.ts
import { dataSource } from "@medusajs/medusa/dist/loaders/database"
import { Driver } from "../models/driver"

export const DriverRepository = dataSource.getRepository(Driver).extend({
  async findByPhoneNumber(phoneNumber: string): Promise<Driver | null> {
    return this.findOne({
      where: { primary_mobile_number: phoneNumber }
    })
  },

  async findByReferralCode(referralCode: string): Promise<Driver | null> {
    return this.findOne({
      where: { referral_code: referralCode }
    })
  },

  async findActiveDrivers(): Promise<Driver[]> {
    return this.find({
      where: { status: "active" }
    })
  },

  async updateProfileStatus(driverId: string, isComplete: boolean): Promise<void> {
    await this.update(driverId, { is_profile_complete: isComplete })
  },

  async verifyPhone(driverId: string): Promise<void> {
    await this.update(driverId, { is_phone_verified: true })
  }
})