// src/models/driver.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity()
export class Driver {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 15, unique: true })
  @Index()
  primary_mobile_number: string;

  @Column({ type: "varchar", length: 15, nullable: true })
  whatsapp_number?: string;

  @Column({ type: "varchar", length: 15, nullable: true })
  secondary_number?: string;

  @Column({ type: "varchar", length: 100 })
  first_name: string;

  @Column({ type: "varchar", length: 100 })
  last_name: string;

  @Column({ type: "varchar", length: 100 })
  father_name: string;

  @Column({ type: "date" })
  date_of_birth: Date;

  @Column({ type: "varchar", length: 10 })
  blood_group: string;

  @Column({ type: "text" })
  address: string;

  @Column({ type: "varchar", length: 50 })
  language: string;

  @Column({ type: "varchar", nullable: true })
  profile_picture?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  referral_code?: string;

  @Column({ type: "boolean", default: false })
  is_phone_verified: boolean;

  @Column({ type: "boolean", default: false })
  is_profile_complete: boolean;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "active" | "inactive" | "suspended";

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}