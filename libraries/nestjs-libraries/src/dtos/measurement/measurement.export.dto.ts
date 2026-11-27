import { IsISO8601 } from 'class-validator';

// [from, to) instants of the aggregate export; the controller checks the order and span
export class MeasurementExportDto {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;
}
