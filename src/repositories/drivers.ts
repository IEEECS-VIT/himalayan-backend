import { type EntityManager, Repository } from "typeorm"
import { Driver } from "../models/drivers"

export class DriverRepository extends Repository<Driver> {
  constructor(manager: EntityManager) {
    super(Driver, manager)
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Driver | null> {
    return this.findOne({
      where: { primary_mobile_number: phoneNumber },
    })
  }

  async findByReferralCode(referralCode: string): Promise<Driver | null> {
    return this.findOne({
      where: { referral_code: referralCode },
    })
  }

  async findActiveDrivers(): Promise<Driver[]> {
    return this.find({
      where: { status: "active" },
    })
  }

  async updateProfileStatus(driverId: string, isComplete: boolean): Promise<void> {
    await this.update(driverId, { is_profile_complete: isComplete })
  }

  async verifyPhone(driverId: string): Promise<void> {
    await this.update(driverId, { is_phone_verified: true })
  }
}
