// src/api/routes/drivers/index.ts
import { Router } from "express"
import { Driver } from "../../../models/driver"
import  DriverService  from "../../../services/driver"

const route = Router()

export default (app: Router) => {
  app.use("/drivers", route)

  // Step 1: Register driver with phone number
  route.post("/register", async (req, res) => {
    try {
      const { primary_mobile_number } = req.body

      if (!primary_mobile_number) {
        return res.status(400).json({ error: "Phone number is required" })
      }

      const driverService: DriverService = req.scope.resolve("driverService")
      const driver = await driverService.createDriver({ primary_mobile_number })

      res.status(201).json({
        message: "Driver registered successfully. Please verify your phone number.",
        driver_id: driver.id
      })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Step 2: Verify OTP (you'll need to implement OTP logic)
  route.post("/verify-otp", async (req, res) => {
    try {
      const { driver_id, otp } = req.body

      // TODO: Implement OTP verification logic here
      // For now, we'll just mark as verified
      
      const driverService: DriverService = req.scope.resolve("driverService")
      const driver = await driverService.verifyDriverPhone(driver_id)

      res.json({
        message: "Phone number verified successfully",
        driver
      })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Step 3: Complete profile
  route.post("/:id/complete-profile", async (req, res) => {
    try {
      const { id } = req.params
      const profileData = req.body

      // Validate required fields
      const requiredFields = [
        'first_name', 'last_name', 'father_name', 'date_of_birth',
        'blood_group', 'address', 'language'
      ]
      
      for (const field of requiredFields) {
        if (!profileData[field]) {
          return res.status(400).json({ error: `${field} is required` })
        }
      }

      const driverService: DriverService = req.scope.resolve("driverService")
      const driver = await driverService.updateDriverProfile(id, profileData)

      res.json({
        message: "Profile completed successfully",
        driver
      })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get driver by ID
  route.get("/:id", async (req, res) => {
    try {
      const { id } = req.params
      const driverService: DriverService = req.scope.resolve("driverService")
      const driver = await driverService.getDriverById(id)

      if (!driver) {
        return res.status(404).json({ error: "Driver not found" })
      }

      res.json({ driver })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get all drivers
  route.get("/", async (req, res) => {
    try {
      const driverService: DriverService = req.scope.resolve("driverService")
      const drivers = await driverService.getAllDrivers()

      res.json({ drivers })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get active drivers
  route.get("/active", async (req, res) => {
    try {
      const driverService: DriverService = req.scope.resolve("driverService")
      const drivers = await driverService.getActiveDrivers()

      res.json({ drivers })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })
}