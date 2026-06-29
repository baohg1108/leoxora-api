import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHashedRefreshToken1782636139571 implements MigrationInterface {
  name = 'AddHashedRefreshToken1782636139571';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "hashed_refresh_token" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "hashed_refresh_token"`,
    );
  }
}
