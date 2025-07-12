import { type MigrationInterface, type QueryRunner, Table, TableIndex } from "typeorm"

export class CreateDriverTable1234567890123 implements MigrationInterface {
  name = "CreateDriverTable1234567890123"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.createTable(
      new Table({
        name: "driver",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "primary_mobile_number",
            type: "varchar",
            length: "15",
            isUnique: true,
          },
          {
            name: "whatsapp_number",
            type: "varchar",
            length: "15",
            isNullable: false,
          },
          {
            name: "secondary_number",
            type: "varchar",
            length: "15",
            isNullable: true,
          },
          {
            name: "first_name",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "last_name",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "father_name",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "date_of_birth",
            type: "date",
            isNullable: false,
          },
          {
            name: "blood_group",
            type: "varchar",
            length: "10",
            isNullable: false,
          },
          {
            name: "address",
            type: "text",
            isNullable: false,
          },
          {
            name: "language",
            type: "varchar",
            length: "50",
            isNullable: false,
          },
          {
            name: "profile_picture",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "referral_code",
            type: "varchar",
            length: "20",
            isNullable: true,
          },
          {
            name: "is_phone_verified",
            type: "boolean",
            default: false,
          },
          {
            name: "is_profile_complete",
            type: "boolean",
            default: false,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            default: "'pending'",
          },
          {
            name: "created_at",
            type: "timestamp with time zone",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamp with time zone",
            default: "now()",
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      "driver",
      new TableIndex({
        name: "IDX_driver_primary_mobile_number",
        columnNames: ["primary_mobile_number"],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("driver")
  }
}
